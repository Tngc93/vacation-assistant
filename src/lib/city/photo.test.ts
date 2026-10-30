import { describe, expect, it } from "vitest";
import type { Fetcher } from "@/lib/places/overpass";
import commons from "./__fixtures__/commons-imageinfo.json";
import { fetchCityPhoto, isAllowedLicense, photoFromImageInfo, plainText } from "./photo";

const info = commons.query.pages[0].imageinfo[0];
const withLicense = (License: string, LicenseShortName: string) => ({
  ...info,
  extmetadata: { ...info.extmetadata, License: { value: License }, LicenseShortName: { value: LicenseShortName } },
});

describe("licence filter", () => {
  it.each([
    ["cc0", "CC0"],
    ["pd", "Public domain"],
    ["cc-by-2.0", "CC BY 2.0"],
    ["cc-by-4.0", "CC BY 4.0"],
    ["cc-by-sa-3.0", "CC BY-SA 3.0"],
    ["cc-by-sa-2.5-es", "CC BY-SA 2.5 es"],
    ["", "CC BY-SA 4.0"],
  ])("allows %s / %s", (license, short) => {
    expect(isAllowedLicense(license, short)).toBe(true);
  });

  it.each([
    ["cc-by-nc-2.0", "CC BY-NC 2.0"],
    ["cc-by-nd-4.0", "CC BY-ND 4.0"],
    ["gfdl", "GFDL"],
    ["fal", "FAL"],
    ["", ""],
  ])("refuses %s / %s", (license, short) => {
    expect(isAllowedLicense(license, short)).toBe(false);
  });
});

describe("Commons photo", () => {
  it("builds a credited photo from imageinfo, without tracking parameters", () => {
    expect(photoFromImageInfo(info)).toEqual({
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Sarajevo_City_Panorama.JPG/1280px-Sarajevo_City_Panorama.JPG",
      width: 1280,
      height: 765,
      author: "Julian Nyča",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      fileUrl: "https://commons.wikimedia.org/wiki/File:Sarajevo_City_Panorama.JPG",
    });
  });

  it("shows no photo for a licence outside the allowed set", () => {
    expect(photoFromImageInfo(withLicense("cc-by-nc-4.0", "CC BY-NC 4.0"))).toBeNull();
  });

  it("links to the file page when a public-domain file has no licence URL", () => {
    const pd = { ...withLicense("pd", "Public domain"), extmetadata: { ...withLicense("pd", "Public domain").extmetadata, LicenseUrl: undefined } };
    expect(photoFromImageInfo(pd)?.licenseUrl).toBe(info.descriptionurl);
  });

  it("refuses thumbnails from other hosts", () => {
    expect(photoFromImageInfo({ ...info, thumburl: "https://example.org/a.jpg" })).toBeNull();
  });

  it("reads the author as plain text", () => {
    expect(plainText('<a href="x">dronepicr</a> &amp; <b>friends</b>')).toBe("dronepicr & friends");
  });

  it("follows Wikidata P18 (preferred rank first) to Commons", async () => {
    const urls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      urls.push(url);
      if (url.includes("wikidata")) {
        return new Response(
          JSON.stringify({
            claims: {
              P18: [
                { rank: "normal", mainsnak: { datavalue: { value: "Other.jpg" } } },
                { rank: "preferred", mainsnak: { datavalue: { value: "Sarajevo City Panorama.JPG" } } },
              ],
            },
          }),
        );
      }
      return new Response(JSON.stringify(commons));
    };
    const photo = await fetchCityPhoto("Q11194", { fetcher });
    expect(photo?.author).toBe("Julian Nyča");
    expect(new URL(urls[1]).searchParams.get("titles")).toBe("File:Sarajevo City Panorama.JPG");
  });

  it("returns null without P18 and throws on HTTP errors", async () => {
    const empty: Fetcher = async () => new Response(JSON.stringify({ claims: {} }));
    await expect(fetchCityPhoto("Q1", { fetcher: empty })).resolves.toBeNull();
    const down: Fetcher = async () => new Response("", { status: 500 });
    await expect(fetchCityPhoto("Q1", { fetcher: down })).rejects.toThrow(/500/);
  });
});
