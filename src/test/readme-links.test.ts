import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const READMES = ["README.md", "README.tr.md"];
const SCREENSHOTS = "docs/screenshots";

/** The text without fenced code blocks (their contents are not links). */
function withoutCode(markdown: string): string {
  return markdown.replace(/^```[\s\S]*?^```/gm, "");
}

/** Every link and image target: Markdown `[..](x)` / `![..](x)` and HTML `src`/`href`. */
function linkTargets(markdown: string): string[] {
  const text = withoutCode(markdown);
  const targets: string[] = [];
  for (const [, target] of text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) targets.push(target);
  for (const [, target] of text.matchAll(/\s(?:src|href)="([^"]+)"/g)) targets.push(target);
  return targets;
}

/** GitHub's heading anchors (github-slugger): lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
function headingAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const [, heading] of withoutCode(markdown).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const plain = heading
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[`*]/g, "");
    const base = plain.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "").replace(/ /g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count ? `${base}-${count}` : base);
  }
  for (const [, id] of markdown.matchAll(/\s(?:id|name)="([^"]+)"/g)) anchors.add(id);
  return anchors;
}

const isExternal = (target: string) => /^[a-z][a-z0-9+.-]*:/i.test(target);

describe.each(READMES)("%s", (readme) => {
  const markdown = readFileSync(path.join(ROOT, readme), "utf8");
  const relative = linkTargets(markdown).filter((t) => !isExternal(t));

  it("has relative links and images to check", () => {
    expect(relative.length).toBeGreaterThan(10);
  });

  it.each(relative)("resolves %s", (target) => {
    const [file, anchor] = target.split("#") as [string, string | undefined];
    const resolved = file ? path.join(ROOT, path.dirname(readme), decodeURI(file)) : path.join(ROOT, readme);
    expect(existsSync(resolved), `${target} does not exist`).toBe(true);
    if (anchor && resolved.endsWith(".md")) {
      expect(headingAnchors(readFileSync(resolved, "utf8")), `no heading for #${anchor} in ${file || readme}`).toContain(decodeURIComponent(anchor));
    }
  });

  it("links the other language at the top", () => {
    const other = readme === "README.md" ? "README.tr.md" : "README.md";
    expect(markdown.split("\n").slice(0, 3).join("\n")).toContain(`href="${other}"`);
  });
});

describe("README images", () => {
  const files = readdirSync(path.join(ROOT, SCREENSHOTS));
  const used = new Set(READMES.flatMap((r) => linkTargets(readFileSync(path.join(ROOT, r), "utf8"))).filter((t) => t.startsWith(`${SCREENSHOTS}/`)));

  it("are optimised WebP files, each used by a README", () => {
    for (const file of files) {
      expect(file).toMatch(/\.webp$/);
      expect(used, `${file} is not used by a README`).toContain(`${SCREENSHOTS}/${file}`);
    }
  });

  it("stay within 10 MB in all, the animated demo within 6 MB", () => {
    const size = (file: string) => statSync(path.join(ROOT, SCREENSHOTS, file)).size;
    expect(files.reduce((sum, file) => sum + size(file), 0)).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(size("demo.webp")).toBeLessThanOrEqual(6 * 1024 * 1024);
  });
});

describe("headingAnchors", () => {
  it("follows GitHub's rules, Turkish letters included", () => {
    const anchors = headingAnchors("## 7. Ölçüm (Vercel Web Analytics)\n### Son Lighthouse ölçümü\n## Features\n## Features\n```\n## Not a heading\n```");
    expect([...anchors]).toEqual(["7-ölçüm-vercel-web-analytics", "son-lighthouse-ölçümü", "features", "features-1"]);
  });
});
