/**
 * Vacationist's service worker, written by hand (no Workbox or Serwist: Next.js 16 builds with Turbopack, and the
 * rules below are short enough to read in one file). Registered by src/components/pwa/PwaClient.tsx as
 * /sw.js?v=<build>; the build names this version's cache, and a new build is a new worker that waits until the
 * visitor presses "Yenile". The rules (AGENTS.md "PWA"):
 *
 * - Only GET requests to this site and to the map tiles and Wikimedia Commons are handled. Everything else,
 *   the three AI providers included, never reaches respondWith: the browser sends it as if there were no worker,
 *   and this worker's own CSP (next.config.ts) does not let it connect to them either.
 * - Never cached: /api/* (flights, rates, origin search), /_vercel/* (Analytics), React Server Component
 *   requests, this script.
 * - Build files (/_next/static, hashed): cache first. Other files (/vendor, /icons, manifests): network first.
 * - Pages: network first. Plans (/plan, /en/plan with a destination) are saved, the last ten, and come back
 *   offline with data-va-offline on <html> (the page shows the offline strip). The start pages and the offline
 *   pages are saved at install; any other page offline redirects to the offline page.
 * - Map tiles and Commons photos requested by a plan: network first, saved up to 50 MB, least recently used out.
 *
 * Kept free of time: recency is the order of a cache's entries (an entry is deleted and put again to move it last).
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "local";
const STATIC_PREFIX = "va-static-";
const STATIC_CACHE = STATIC_PREFIX + VERSION;
// src/lib/pwa/sw.ts repeats these two names; sw.test.ts checks they match.
const PLAN_CACHE = "va-plans";
const TITLE_HEADER = "x-va-title";
const OFFLINE_ATTRIBUTE = "data-va-offline";
const MEDIA_CACHE = "va-media";
const VERSION_HEADER = "x-va-version";
const SIZE_HEADER = "x-va-size";
const PLAN_LIMIT = 10;
const MEDIA_LIMIT_BYTES = 50 * 1024 * 1024;
const MEDIA_ORIGINS = ["https://tiles.openfreemap.org", "https://upload.wikimedia.org", "https://thumb.wikimedia.org"];
const START_PAGES = ["/", "/en"];
const OFFLINE_PAGES = { tr: "/offline", en: "/en/offline" };
const SAVED_PAGES = [...START_PAGES, OFFLINE_PAGES.tr, OFFLINE_PAGES.en];
const PRECACHE_FILES = [
  "/manifest.webmanifest",
  "/en/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const localeOf = (pathname) => (pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr");
const isPlanPath = (pathname) => pathname === "/plan" || pathname === "/en/plan";

/** What happens to a request: "bypass" (not handled), "static", "asset", "plan", "page" or "media". */
function routeFor(request) {
  if (request.method !== "GET") return "bypass";
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return MEDIA_ORIGINS.includes(url.origin) ? "media" : "bypass";
  const path = url.pathname;
  if (path.startsWith("/api/") || path.startsWith("/_vercel/") || path === "/sw.js") return "bypass";
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return "bypass";
  if (request.mode === "navigate") return isPlanPath(path) && url.searchParams.has("to") ? "plan" : "page";
  if (path.startsWith("/_next/static/")) return "static";
  if (path.startsWith("/vendor/") || path.startsWith("/icons/") || path === "/favicon.ico" || path.endsWith("/manifest.webmanifest")) {
    return "asset";
  }
  return "bypass";
}

/** One write at a time, so the plan and media limits count right. */
let queue = Promise.resolve();
function serial(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

const isHtml = (response) => (response.headers.get("Content-Type") || "").includes("text/html");

/** A response to store: the body read in full, headers that no longer describe an encoded transfer. */
function stored(body, response, extra) {
  const headers = new Headers(response.headers);
  for (const name of ["Content-Encoding", "Content-Length", "Transfer-Encoding"]) headers.delete(name);
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

async function navigationResponse(event) {
  const preloaded = await event.preloadResponse;
  return preloaded || fetch(event.request);
}

/** A saved page, marked so the page knows it is not the network's. */
async function offlineCopy(cached) {
  const html = (await cached.text()).replace("<html", `<html ${OFFLINE_ATTRIBUTE}=""`);
  return new Response(html, { status: 200, statusText: "OK", headers: cached.headers });
}

/** The offline page of the request's language; ?from= lets "Yeniden dene" go back. */
function offlineRedirect(url) {
  const target = new URL(OFFLINE_PAGES[localeOf(url.pathname)], self.location.origin);
  target.searchParams.set("from", url.pathname + url.search);
  return Response.redirect(target.href, 302);
}

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Saves an opened plan as the most recent one, drops the eleventh, then the build files nothing needs. */
function savePlan(url, response) {
  return serial(async () => {
    const html = await response.text();
    const title = decodeEntities(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "");
    const cache = await caches.open(PLAN_CACHE);
    await cache.delete(url);
    await cache.put(url, stored(html, response, { [VERSION_HEADER]: VERSION, [TITLE_HEADER]: encodeURIComponent(title) }));
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - PLAN_LIMIT))) await cache.delete(old);
    await pruneVersions();
  });
}

/** Deletes older versions' build files unless a saved plan was served with them. */
async function pruneVersions() {
  const plans = await caches.open(PLAN_CACHE);
  const needed = new Set([VERSION]);
  for (const response of await plans.matchAll()) needed.add(response.headers.get(VERSION_HEADER));
  for (const name of await caches.keys()) {
    if (name.startsWith(STATIC_PREFIX) && !needed.has(name.slice(STATIC_PREFIX.length))) await caches.delete(name);
  }
}

async function plan(event) {
  const url = new URL(event.request.url);
  try {
    const response = await navigationResponse(event);
    if (response.ok && !response.redirected && isHtml(response)) event.waitUntil(savePlan(url.href, response.clone()));
    return response;
  } catch {
    const cached = await (await caches.open(PLAN_CACHE)).match(url.href);
    return cached ? offlineCopy(cached) : offlineRedirect(url);
  }
}

async function page(event) {
  const url = new URL(event.request.url);
  const saved = SAVED_PAGES.includes(url.pathname) ? new URL(url.pathname, self.location.origin).href : null;
  try {
    const response = await navigationResponse(event);
    if (saved && START_PAGES.includes(url.pathname) && !url.search && response.ok && !response.redirected && isHtml(response)) {
      const copy = response.clone();
      event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(saved, copy)));
    }
    return response;
  } catch {
    const cached = saved && ((await (await caches.open(STATIC_CACHE)).match(saved)) || (await caches.match(saved)));
    if (!cached) return offlineRedirect(url);
    return Object.values(OFFLINE_PAGES).includes(url.pathname) ? cached : offlineCopy(cached);
  }
}

async function cacheFirst(event) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok && response.type === "basic") {
    const copy = response.clone();
    event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy)));
  }
  return response;
}

async function networkFirst(event) {
  try {
    const response = await fetch(event.request);
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy)));
    }
    return response;
  } catch (error) {
    const cached = (await (await caches.open(STATIC_CACHE)).match(event.request)) || (await caches.match(event.request));
    if (cached) return cached;
    throw error;
  }
}

/** url → bytes, oldest use first; read from the cache once per worker start. */
let mediaIndex = null;
let mediaBytes = 0;
async function openMedia() {
  const cache = await caches.open(MEDIA_CACHE);
  if (!mediaIndex) {
    mediaIndex = new Map();
    mediaBytes = 0;
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      const size = Number(response?.headers.get(SIZE_HEADER)) || 0;
      mediaIndex.set(request.url, size);
      mediaBytes += size;
    }
  }
  return cache;
}

/** Puts a tile or photo last in line, then drops the least recently used until the cache fits in 50 MB. */
function saveMedia(url, response) {
  return serial(async () => {
    const body = await response.blob();
    const cache = await openMedia();
    if (mediaIndex.has(url)) {
      mediaBytes -= mediaIndex.get(url);
      mediaIndex.delete(url);
      await cache.delete(url);
    }
    if (body.size > MEDIA_LIMIT_BYTES) return;
    await cache.put(url, stored(body, response, { [SIZE_HEADER]: String(body.size) }));
    mediaIndex.set(url, body.size);
    mediaBytes += body.size;
    for (const [old, size] of mediaIndex) {
      if (mediaBytes <= MEDIA_LIMIT_BYTES) break;
      await cache.delete(old);
      mediaIndex.delete(old);
      mediaBytes -= size;
    }
  });
}

/** Tiles come from MapLibre's worker, photos from the plan page; any other page's media is not saved. */
async function requestedByPlan(event) {
  const client = event.clientId ? await self.clients.get(event.clientId) : null;
  if (!client) return false;
  return client.type === "worker" || isPlanPath(new URL(client.url).pathname);
}

async function media(event) {
  const url = event.request.url;
  try {
    const response = await fetch(event.request);
    if (response.ok && (response.type === "cors" || response.type === "basic") && (await requestedByPlan(event))) {
      event.waitUntil(saveMedia(url, response.clone()));
    }
    return response;
  } catch (error) {
    const cached = await (await caches.open(MEDIA_CACHE)).match(url, { ignoreVary: true });
    if (!cached) throw error;
    event.waitUntil(saveMedia(url, cached.clone()));
    return cached;
  }
}

const HANDLERS = { static: cacheFirst, asset: networkFirst, plan, page, media };

self.addEventListener("fetch", (event) => {
  const route = routeFor(event.request);
  if (route === "bypass") return;
  event.respondWith(HANDLERS[route](event));
});

/** The build files a page names in its HTML. */
const namedFiles = (html) => [...html.matchAll(/\/_next\/static\/[^"'\s<>\\]+/g)].map(([file]) => file);

/** Build files of this site not cached yet; one that fails is left for the page to fetch. */
async function saveBuildFiles(files) {
  const cache = await caches.open(STATIC_CACHE);
  const own = files.flatMap((file) => {
    const url = new URL(file, self.location.origin);
    return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/") ? [url.href] : [];
  });
  await Promise.all(
    [...new Set(own)].map(async (file) => {
      if (await caches.match(file)) return;
      try {
        const response = await fetch(file);
        if (response.ok && response.type === "basic") await cache.put(file, response);
      } catch {
        // Offline again, or gone: nothing to keep.
      }
    }),
  );
}

/** The start and offline pages, the icons and the build files those pages name. */
async function precache() {
  const cache = await caches.open(STATIC_CACHE);
  const files = [];
  for (const path of SAVED_PAGES) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    files.push(...namedFiles(await response.clone().text()));
    await cache.put(new URL(path, self.location.origin).href, response);
  }
  await cache.addAll(PRECACHE_FILES);
  await saveBuildFiles(files);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await pruneVersions();
      await self.clients.claim();
    })(),
  );
});

/** Tiles and photos a plan loaded before this worker controlled it, fetched again (CORS) and kept. */
async function saveMediaFiles(files) {
  const media = files.filter((file) => MEDIA_ORIGINS.includes(new URL(file, self.location.origin).origin));
  const cache = await caches.open(MEDIA_CACHE);
  await Promise.all(
    [...new Set(media)].map(async (file) => {
      if (await cache.match(file, { ignoreVary: true })) return;
      try {
        const response = await fetch(file, { mode: "cors", credentials: "omit" });
        if (response.ok) await saveMedia(file, response);
      } catch {
        // Not reachable now: the page shows it without a photo offline.
      }
    }),
  );
}

/**
 * A page loaded before this worker controlled it: the build files it loaded (`files`, from the page's resource
 * timing; only this site's /_next/static ones are taken) and, for a plan, the plan itself, fetched again from the
 * network with the build files its HTML names, and the tiles and photos it loaded.
 */
async function savePageFromNetwork(href, files) {
  await saveBuildFiles(files);
  const url = new URL(href, self.location.origin);
  if (url.origin !== self.location.origin || !isPlanPath(url.pathname) || !url.searchParams.has("to")) return;
  await saveMediaFiles(files);
  if (await (await caches.open(PLAN_CACHE)).match(url.href)) return;
  const response = await fetch(url.href, { credentials: "same-origin" });
  if (!response.ok || response.redirected || !isHtml(response)) return;
  const html = await response.clone().text();
  await savePlan(url.href, response);
  await saveBuildFiles(namedFiles(html));
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "SAVE_PAGE" && typeof data.url === "string") {
    const files = Array.isArray(data.files) ? data.files.filter((file) => typeof file === "string") : [];
    event.waitUntil(savePageFromNetwork(data.url, files));
  }
});

// For sw.test.ts and debugging in the browser console.
self.vaServiceWorker = { VERSION, PLAN_CACHE, TITLE_HEADER, OFFLINE_ATTRIBUTE, MEDIA_ORIGINS, PLAN_LIMIT, MEDIA_LIMIT_BYTES, routeFor };
