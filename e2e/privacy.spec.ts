import { expect, test } from "./fixtures";

const PAGES = [
  { name: "Turkish", home: "/", path: "/gizlilik", lang: "tr", title: "Gizlilik · Vacationist", link: "Gizlilik", h1: /^Hesap yok, çerez yok/ },
  { name: "English", home: "/en", path: "/en/privacy", lang: "en", title: "Privacy · Vacationist", link: "Privacy", h1: /^No accounts, no cookies/ },
] as const;

for (const page of PAGES) {
  test(`the ${page.name} privacy page opens with its language, title and hreflang`, async ({ page: tab }) => {
    const response = await tab.goto(page.path);
    expect(response?.status()).toBe(200);
    await expect(tab.locator("html")).toHaveAttribute("lang", page.lang);
    await expect(tab).toHaveTitle(page.title);
    await expect(tab.getByRole("heading", { level: 1 })).toHaveText(page.h1);
    // Indexed: in the sitemap, no noindex.
    await expect(tab.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(tab.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${page.path}$`));
    await expect(tab.locator('link[rel="alternate"][hreflang="tr"]')).toHaveAttribute("href", /\/gizlilik$/);
    await expect(tab.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/privacy$/);
    await expect(tab.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/gizlilik$/);
  });

  test(`the ${page.name} footer links to the privacy page in its own language`, async ({ page: tab }) => {
    await tab.goto(page.home);
    const link = tab.getByRole("contentinfo").getByRole("link", { name: page.link, exact: true });
    await expect(link).toHaveAttribute("href", page.path);
    await link.click();
    await tab.waitForURL(`**${page.path}`);
    await expect(tab.getByRole("heading", { level: 1 })).toHaveText(page.h1);
  });
}

test("the TR / EN switch moves between /gizlilik and /en/privacy", async ({ page }) => {
  await page.goto("/gizlilik");
  await page.getByRole("link", { name: /^EN/ }).click();
  await page.waitForURL("**/en/privacy");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("link", { name: /^TR/ }).click();
  await page.waitForURL("**/gizlilik");
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
});

test("each language's privacy word is only its own: /privacy and /en/gizlilik are 404", async ({ page }) => {
  expect((await page.goto("/privacy"))?.status()).toBe(404);
  expect((await page.goto("/en/gizlilik"))?.status()).toBe(404);
});

test("other pages do not carry the privacy copy (server-only messages)", async ({ request }) => {
  for (const [path, heading] of [
    ["/", "Hesap yok, çerez yok"],
    ["/en", "No accounts, no cookies"],
  ] as const) {
    const html = await (await request.get(path)).text();
    expect(html).not.toContain(heading);
  }
});

test("the sitemap lists both privacy pages, each naming the other", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("<loc>https://vacationist-app.vercel.app/gizlilik</loc>");
  expect(xml).toContain("<loc>https://vacationist-app.vercel.app/en/privacy</loc>");
  expect(xml).toContain('hreflang="en" href="https://vacationist-app.vercel.app/en/privacy"');
  expect(xml).toContain('hreflang="tr" href="https://vacationist-app.vercel.app/gizlilik"');
});
