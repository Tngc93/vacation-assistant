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

/** Where two same-sized PNG screenshots differ, decoded in the page (no image package). */
async function pixelDiff(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ([a64, b64]) => {
      const read = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      };
      const [x, y] = [await read(a64), await read(b64)];
      if (x.width !== y.width || x.height !== y.height) return { size: `${x.width}x${x.height} vs ${y.width}x${y.height}` };
      let count = 0;
      let max = 0;
      const samples: string[] = [];
      for (let i = 0; i < x.data.length; i += 4) {
        const d = Math.max(...[0, 1, 2, 3].map((k) => Math.abs(x.data[i + k] - y.data[i + k])));
        if (!d) continue;
        count++;
        max = Math.max(max, d);
        if (samples.length < 6) samples.push(`(${(i / 4) % x.width},${Math.floor(i / 4 / x.width)}) ${x.data.slice(i, i + 4).join("/")} vs ${y.data.slice(i, i + 4).join("/")}`);
      }
      return { size: `${x.width}x${x.height}`, count, max, samples };
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

/** The background colour an element paints itself, and whether it is opaque. */
const ownBackground = (el: Locator) => el.evaluate((e) => getComputedStyle(e).backgroundColor);
const opaque = (colour: string) => /^rgb\(/.test(colour) || /^rgba\(.*,\s*1\)$/.test(colour);

for (const colorScheme of ["light", "dark"] as const) {
  test(`keeps every word of the hero readable over the atmosphere, in the ${colorScheme} theme`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await servePhotos(page);
    await page.goto(plan("BCN"));
    await heroReady(page);
    await expect(backdrop(page)).toHaveAttribute("data-state", "photo");

    // Words over the atmosphere sit on paper scrims: the country, the city, the info line, the photo credit, the
    // carousel's counter, the data line and the strip's codes.
    const scrimmed = page.locator("main .plan-scrim");
    expect(await scrimmed.count()).toBeGreaterThanOrEqual(8);
    const words = await scrimmed.all();
    for (const word of words) {
      const { name, text, scrim, covers } = await word.evaluate((el) => {
        const before = getComputedStyle(el, "::before");
        return {
          name: el.textContent?.trim().slice(0, 24),
          text: getComputedStyle(el).color,
          scrim: before.backgroundColor,
          covers: ["top", "right", "bottom", "left"].every((side) => parseFloat(before.getPropertyValue(side)) <= 0),
        };
      });
      expect(covers, `"${name}": its scrim covers it`).toBe(true);
      expect(contrast(text, scrim), `"${name}": ${text} on ${scrim}`).toBeGreaterThanOrEqual(4.5);
    }

    // Behind the words, the page looks the same with and without the atmosphere (a black-and-white photo under
    // them). The glyphs are transparent for this comparison: how text is antialiased depends on the layers under it
    // (Linux Chromium uses LCD antialiasing on an opaque layer and grayscale over a composited one), which is not
    // the photo showing. The same paper may round one level apart where a neighbour's scrim edge overlaps it in a
    // composited layer: at most 2 of 255 per channel is rounding, the photo would show as far more.
    await page.addStyleTag({ content: ".plan-scrim, .plan-scrim * { color: transparent !important; text-decoration-color: transparent !important; }" });
    for (const word of words) {
      const name = (await word.textContent())?.trim().slice(0, 24);
      const withBackdrop = await word.screenshot();
      await backdrop(page).evaluate((el) => ((el as HTMLElement).style.visibility = "hidden"));
      const withoutBackdrop = await word.screenshot();
      await backdrop(page).evaluate((el) => ((el as HTMLElement).style.visibility = ""));
      if (withBackdrop.equals(withoutBackdrop)) continue;
      const diff = await pixelDiff(page, withBackdrop, withoutBackdrop);
      if ("max" in diff && (diff.max ?? 0) <= 2) continue;
      await testInfo.attach(`${name} with the atmosphere`, { body: withBackdrop, contentType: "image/png" });
      await testInfo.attach(`${name} without it`, { body: withoutBackdrop, contentType: "image/png" });
      expect(diff, `"${name}" differs with the atmosphere under it`).toEqual({});
    }

    // Chips, carousel cards, the arrows and the map paint their own opaque surface: their contrast is the tokens'.
    const surfaces = [
      ...(await page.getByRole("group", { name: "Mekân kategorileri" }).getByRole("button").all()),
      ...(await page.getByRole("list", { name: "Görülecek yerler" }).getByRole("button").all()).slice(0, 3),
      page.getByRole("button", { name: "Sonraki yer" }),
      page.getByRole("region", { name: "Mekân haritası" }),
    ];
    for (const surface of surfaces) {
      const background = await ownBackground(surface);
      expect(opaque(background), `${await surface.getAttribute("aria-label") ?? await surface.textContent()}: ${background}`).toBe(true);
      const text = await surface.evaluate((el) => getComputedStyle(el).color);
      expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
}
