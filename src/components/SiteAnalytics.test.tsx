import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pathOnly } from "@/lib/analytics";
import { SiteAnalytics } from "./SiteAnalytics";

vi.mock("next/navigation", () => ({ usePathname: () => "/plan" }));

afterEach(() => {
  document.head.querySelectorAll("script").forEach((script) => script.remove());
  delete window.va;
  delete window.vaq;
  delete window.vai;
  delete window.vam;
});

describe("SiteAnalytics", () => {
  it("loads the script from our own origin, which the CSP allows as 'self'", () => {
    render(<SiteAnalytics />);
    const scripts = [...document.head.querySelectorAll("script")].map((script) => script.getAttribute("src"));
    expect(scripts).toEqual(["/_vercel/insights/script.js"]);
  });

  it("strips the query before sending and counts the page by its path alone", () => {
    render(<SiteAnalytics />);
    expect(window.vaq).toContainEqual(["beforeSend", pathOnly]);
    expect(window.vaq).toContainEqual(["pageview", { route: "/plan", path: "/plan" }]);
    expect(window.vaq?.map(([name]) => name)).not.toContain("event");
  });
});
