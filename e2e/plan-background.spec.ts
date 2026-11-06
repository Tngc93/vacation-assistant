import { expect, test, type Locator, type Page } from "./fixtures";

/** The plan's background (DESIGN.md "Plan background"): the hero's atmosphere, the route strip and the section gaps. */

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const dates = `depart=${isoDaysFromNow(30)}&return=${isoDaysFromNow(34)}`;
const plan = (to: string, extra = "") => `/plan?from=IST&to=${to}&${dates}${extra}`;

const backdrop = (page: Page) => page.locator("[data-plan-backdrop]");
const strip = (page: Page) => page.locator("[data-route-strip]");
const routeLine = (page: Page) => page.locator("[data-route-line]");
const gaps = (page: Page) => page.locator("[data-section-gap]");

/**
 * A 16×16 black-and-white checkerboard as a BMP (no image package, no checksum): served for every Commons image, so
 * the masthead photo loads without the network, and the darkest and the lightest photo both sit under the words.
 */
function checkerboard(): Buffer {
  const size = 16;
  const row = size * 3;
  const pixels = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) pixels.fill((x + y) % 2 ? 255 : 0, y * row + x * 3, y * row + x * 3 + 3);
  const header = Buffer.alloc(54);
  header.write("BM", 0);
  header.writeUInt32LE(54 + pixels.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(size, 18);
  header.writeInt32LE(size, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixels.length, 34);
  return Buffer.concat([header, pixels]);
}

/** Serves Commons images from here (later routes win over the fixture's abort); returns every URL asked for. */
async function servePhotos(page: Page): Promise<string[]> {
  const asked: string[] = [];
  const body = checkerboard();
  await page.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) => {
    asked.push(route.request().url());
    return route.fulfill({ status: 200, body, headers: { "content-type": "image/bmp", "access-control-allow-origin": "*" } });
  });
  return asked;
}

async function heroReady(page: Page) {
  await expect(page.locator("#yerler").getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("list", { name: "Görülecek yerler" }).getByRole("button").first()).toBeVisible();
}

test("the atmosphere and the route strip are decoration only: hidden, never focusable, never in the way", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await servePhotos(page);
  await page.goto(plan("BCN"));
  await heroReady(page);
  await expect(backdrop(page)).toHaveAttribute("data-state", "photo");
  for (const decoration of [backdrop(page), strip(page)]) {
    await expect(decoration).toHaveAttribute("aria-hidden", "true");
    expect(await decoration.evaluate((el) => el.querySelectorAll("a, button, input, [tabindex]").length)).toBe(0);
  }
  await expect(backdrop(page)).toHaveCSS("pointer-events", "none");
  // Full width behind the hero, under the site header; the margin outside the content hits the page, not the layer.
  const box = (await backdrop(page).boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBe(1440);
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-plan-backdrop]") !== null, [8, box.y + 200]);
  expect(hit).toBe(false);
  // The page's largest paint is still an image of the page (the masthead photo): the atmosphere is a canvas.
  await expect(backdrop(page).locator("img")).toHaveCount(0);
  await expect(backdrop(page).locator("canvas")).toHaveCount(1);
});

test("copies the masthead photo: one request for it, no new one", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const asked = await servePhotos(page);
  await page.goto(plan("BCN"));
  await heroReady(page);
  await expect(backdrop(page)).toHaveAttribute("data-state", "photo");
  const photo = await page.locator("img[data-city-photo]").evaluate((img: HTMLImageElement) => img.currentSrc);
  expect(photo).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
  expect(asked.filter((url) => url === photo)).toHaveLength(1);
  // The same file at any other width is not asked for either (a second, smaller copy would be a new request).
  const file = decodeURIComponent(photo).split("/").pop()!.replace(/^\d+px-/, "");
  expect(asked.filter((url) => decodeURIComponent(url).endsWith(file) && url !== photo)).toEqual([]);
});

test("drifts slowly and draws the route once, back and forth for 40–60 s, in 2 s", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await servePhotos(page);
  await page.goto(plan("BCN"));
  await heroReady(page);
  const layer = backdrop(page).locator(".plan-backdrop-layer");
  await expect(layer).toHaveCSS("animation-name", "plan-drift");
  await expect(layer).toHaveCSS("animation-iteration-count", "infinite");
  await expect(layer).toHaveCSS("animation-direction", "alternate");
  const seconds = parseFloat(await layer.evaluate((el) => getComputedStyle(el).animationDuration));
  expect(seconds).toBeGreaterThanOrEqual(40);
  expect(seconds).toBeLessThanOrEqual(60);
  await expect(routeLine(page)).toHaveCSS("animation-name", "plan-route-draw");
  await expect(routeLine(page)).toHaveCSS("animation-duration", "2s");
  await expect(routeLine(page)).toHaveCSS("animation-iteration-count", "1");
});

test("is still with reduced motion: no drift, the route already drawn", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await servePhotos(page);
  await page.goto(plan("BCN"));
  await heroReady(page);
  await expect(backdrop(page)).toHaveAttribute("data-state", "photo");
  const layer = backdrop(page).locator(".plan-backdrop-layer");
  await expect(layer).toHaveCSS("animation-name", "none");
  await expect(layer).toHaveCSS("transform", "none");
  await expect(routeLine(page)).toHaveCSS("animation-name", "none");
  await expect(routeLine(page)).toHaveCSS("clip-path", "none");
  expect((await routeLine(page).boundingBox())!.width).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a instanceof CSSAnimation && a.animationName.startsWith("plan-")).length)).toBe(0);
});

test("a city without a photo gets its gradient", async ({ page }) => {
  // Amsterdam has no city photo in its data (src/data/places/AMS.json).
  await page.goto(plan("AMS"));
  await expect(page.locator("#yerler").getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("img[data-city-photo]")).toHaveCount(0);
  await expect(backdrop(page)).toHaveAttribute("data-state", "gradient");
  const gradient = backdrop(page).locator(".plan-backdrop-gradient");
  await expect(gradient).toHaveCSS("background-image", /^radial-gradient\(.*linear-gradient\(/);
  await expect(backdrop(page).locator("canvas")).toHaveCount(0);
});

test("a photo that fails to load falls back to the gradient", async ({ page }) => {
  // The fixture aborts every Commons image.
  await page.goto(plan("BCN"));
  await heroReady(page);
  await expect(page.locator("img[data-city-photo]")).toHaveCount(1);
  await expect(backdrop(page)).toHaveAttribute("data-state", "gradient");
});

test("the route strip names the origin and the destination, and draws again for a new origin", async ({ page }) => {
  await page.goto(plan("BCN"));
  await heroReady(page);
  await expect(strip(page)).toHaveAttribute("data-from", "IST");
  await expect(strip(page)).toHaveAttribute("data-to", "BCN");
  await expect(strip(page)).toHaveText(/^\s*IST\s*BCN\s*$/);
  // Right under the site header, above the hero.
  const header = (await page.locator("body > header").boundingBox())!;
  const top = (await strip(page).boundingBox())!;
  expect(Math.round(top.y)).toBe(Math.round(header.y + header.height));
  const line = await routeLine(page).elementHandle();

  const input = page.locator("#ucuslar").getByRole("combobox", { name: "Kalkış" });
  await input.fill("Londra");
  await page.locator("#ucuslar").getByRole("option", { name: /Londra/ }).first().click();
  await expect(page).toHaveURL(/from=LON/);
  await expect(strip(page)).toHaveAttribute("data-from", "LON");
  await expect(strip(page)).toHaveText(/^\s*LON\s*BCN\s*$/);
  // A new line element: its draw starts again.
  expect(await line!.evaluate((el) => el.isConnected)).toBe(false);
  await expect(routeLine(page)).toHaveCount(1);
});

test("English pages: the strip and the coordinates in the gaps use English compass letters", async ({ page }) => {
  await page.goto(`/en${plan("BCN")}`);
  await expect(strip(page)).toHaveText(/^\s*IST\s*BCN\s*$/);
  await expect(gaps(page)).toHaveCount(3);
  await expect(gaps(page)).toHaveText(["41°23′ N", "2°11′ E", "41°23′ N"]);
});

test("between the sections, and only there: faint lines and the city's coordinate", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(plan("BCN"));
  for (const id of ["gun-gun-plan", "konaklama", "ucuslar", "butce"]) await expect(page.locator(`main section#${id}`)).toBeVisible();
  await expect(gaps(page)).toHaveCount(3);
  await expect(gaps(page)).toHaveText(["41°23′ K", "2°11′ D", "41°23′ K"]);
  const grid = gaps(page).first().locator(".plan-graticule");
  // Lines of --ink at 5–8%.
  const line = await grid.evaluate((el) => getComputedStyle(el).getPropertyValue("--pg-opacity"));
  expect(parseFloat(line)).toBeGreaterThanOrEqual(5);
  expect(parseFloat(line)).toBeLessThanOrEqual(8);
  // Nothing behind a section's content: every gap lies between two sections, overlapping neither.
  const boxes = await page.evaluate(() => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
    };
    return {
      sections: [...document.querySelectorAll("main section[id]")].map(rect),
      gaps: [...document.querySelectorAll("[data-section-gap]")].map(rect),
    };
  });
  for (const gap of boxes.gaps) {
    for (const section of boxes.sections) expect(gap.bottom <= section.top + 0.5 || gap.top >= section.bottom - 0.5).toBe(true);
  }
  // The same 64/80 px the sections' grid gap had.
  expect(Math.round(boxes.gaps[0].bottom - boxes.gaps[0].top)).toBe(80);
});

test("printing leaves out the atmosphere, the route strip and the lines in the gaps", async ({ page }) => {
  await page.goto(plan("BCN"));
  await heroReady(page);
  await page.emulateMedia({ media: "print" });
  await expect(backdrop(page)).toBeAttached();
  await expect(backdrop(page)).toBeHidden();
  await expect(strip(page)).toBeHidden();
  await expect(gaps(page).first().locator(".plan-graticule")).toBeHidden();
  await expect(gaps(page).first().getByText("41°23′ K")).toBeHidden();
  await expect(page.locator("#gun-gun-plan")).toBeVisible();
});

/** WCAG relative luminance contrast of two `rgb()` colours. */
function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = c.match(/[\d.]+/g)!.slice(0, 3).map((v) => {
      const x = Number(v) / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The lowest WCAG contrast between a text colour and any pixel of a PNG screenshot, decoded in the page (no image
 * package), with where it is.
 */
async function lowestContrast(page: Page, png: Buffer, text: string) {
  return page.evaluate(
    async ([b64, colour]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      const lin = (v: number) => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const [tr, tg, tb] = colour.match(/[\d.]+/g)!.map(Number);
      const t = lum(tr, tg, tb);
      let min = Infinity;
      let at = "";
      for (let i = 0; i < data.length; i += 4) {
        const l = lum(data[i], data[i + 1], data[i + 2]);
        const ratio = (Math.max(l, t) + 0.05) / (Math.min(l, t) + 0.05);
        if (ratio < min) {
          min = ratio;
          at = `(${(i / 4) % c.width},${Math.floor(i / 4 / c.width)}) ${data.slice(i, i + 3).join("/")}`;
        }
      }
      return { min, at };
    },
    [png.toString("base64"), text] as const,
  );
}

/** The background colour an element paints itself, and whether it is opaque. */
const ownBackground = (el: Locator) => el.evaluate((e) => getComputedStyle(e).backgroundColor);
const opaque = (colour: string) => /^rgb\(/.test(colour) || /^rgba\(.*,\s*1\)$/.test(colour);

/**
 * Every bit of text on the plan page above the footer: over the atmosphere (the strip's codes, the hero's words, the
 * gaps' coordinates, the menu) and inside the section cards. Leaves only: an element with its own text. Not measured:
 * buttons, chips and the carousel's cards and map (opaque, token colours, checked below), disabled controls (exempt
 * from AA) and the maps' own attributions.
 */
async function wordsOnThePage(page: Page) {
  const count = await page.evaluate(() => {
    const skip = [
      "button",
      "[role=dialog]",
      "#yerler [role=region]",
      "#yerler [role=list]",
      "#yerler [role=group]",
      "[aria-disabled=true]",
      ":disabled",
      ".maplibregl-map",
      "svg",
    ].join(", ");
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement>("main *")) {
      if (el.closest(skip)) continue;
      const own = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim());
      const box = el.getBoundingClientRect();
      if (!own || box.width <= 2 || box.height <= 2) continue;
      el.setAttribute("data-contrast-probe", String(n++));
    }
    return n;
  });
  return Array.from({ length: count }, (_, i) => page.locator(`[data-contrast-probe="${i}"]`));
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const [width, height] of [
    [1440, 900],
    [375, 812],
  ] as const) {
    test(`every word on the plan keeps AA, over the atmosphere and in the cards, ${colorScheme} theme at ${width}px`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      // The hardest photo there is: pure black and white, so the tritone's two ends both sit somewhere under the words.
      await servePhotos(page);
      await page.goto(plan("BCN"));
      await heroReady(page);
      await expect(backdrop(page)).toHaveAttribute("data-state", "photo");
      await expect(page.locator(".plan-scrim")).toHaveCount(0);

      for (const id of ["gun-gun-plan", "konaklama", "ucuslar", "butce"]) await expect(page.locator(`main section#${id}`)).toBeVisible();
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
      const words = await wordsOnThePage(page);
      expect(words.length).toBeGreaterThanOrEqual(60);
      const colours = await Promise.all(words.map((w) => w.evaluate((el) => [el.textContent!.trim().slice(0, 24), getComputedStyle(el).color] as const)));
      // Measured behind the glyphs: each word made transparent, so the screenshot is only what lies under it.
      await page.addStyleTag({ content: "main * { color: transparent !important; text-decoration-color: transparent !important; caret-color: transparent !important; }" });
      for (const [i, word] of words.entries()) {
        const [name, colour] = colours[i];
        if (!(await word.isVisible())) continue;
        await word.scrollIntoViewIfNeeded();
        // Only where the text is: each line box of its own text, not the empty rest of a wide block.
        const lines = await word.evaluate((el) =>
          [...el.childNodes]
            .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim())
            .flatMap((node) => {
              const range = document.createRange();
              range.selectNodeContents(node);
              return [...range.getClientRects()].map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
            })
            .filter((r) => r.width >= 1 && r.height >= 1),
        );
        for (const clip of lines) {
          const shot = await page.screenshot({ clip });
          const { min, at } = await lowestContrast(page, shot, colour);
          if (min < 4.5) await testInfo.attach(`${name} (${colorScheme}, ${width}px)`, { body: shot, contentType: "image/png" });
          expect(min, `"${name}" in ${colour}: lowest ${min.toFixed(2)} at ${at}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  test(`chips, cards, arrows, the photo card, the map, the section cards and the menu paint their own surface, ${colorScheme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await servePhotos(page);
    await page.goto(plan("BCN"));
    await heroReady(page);
    const surfaces = [
      ...(await page.getByRole("group", { name: "Mekân kategorileri" }).getByRole("button").all()),
      ...(await page.getByRole("list", { name: "Görülecek yerler" }).getByRole("button").all()).slice(0, 3),
      page.getByRole("button", { name: "Sonraki yer" }),
      page.getByRole("region", { name: "Mekân haritası" }),
      page.locator("#yerler figure"),
      ...(await page.locator("main section[id]:not(#yerler)").all()),
      page.getByRole("navigation", { name: "Plan bölümleri" }),
    ];
    for (const surface of surfaces) {
      const background = await ownBackground(surface);
      expect(opaque(background), `${(await surface.getAttribute("aria-label")) ?? (await surface.textContent())}: ${background}`).toBe(true);
      const text = await surface.evaluate((el) => getComputedStyle(el).color);
      expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test("the tone follows the photo: a warm photo takes the accent, a cool or grey one the sea", async ({ page }) => {
  await servePhotos(page);
  await page.goto(plan("BCN"));
  await heroReady(page);
  // The test photo is black and white: no colour, so cool.
  await expect(backdrop(page)).toHaveAttribute("data-tone", "cool");
});

test("the atmosphere is a fixed layer, strongest over the photo and map column, almost paper behind the words", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await servePhotos(page);
  await page.goto(plan("BCN"));
  await heroReady(page);
  const mask = await backdrop(page).evaluate((el) => getComputedStyle(el).maskImage);
  expect(mask).toMatch(/linear-gradient\(to right, rgba\(0, 0, 0, 0\.05\) 58\.5%, rgb\(0, 0, 0\) 72%\)/);
  // Fixed to the viewport: the same place after a scroll, and it never moves with it.
  await expect(backdrop(page)).toHaveCSS("position", "fixed");
  const before = await backdrop(page).boundingBox();
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  expect(await backdrop(page).boundingBox()).toEqual(before);
});
