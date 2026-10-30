import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { en } from "@/i18n/messages/en";
import { LanguageSwitch } from "./LanguageSwitch";

let pathname = "/plan";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const QUERY = "?to=BCN&depart=2026-11-14&return=2026-11-18&from=LON&pax=2&cur=GBP&stay=120";

describe("LanguageSwitch", () => {
  afterEach(() => {
    pathname = "/plan";
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("links the Turkish plan to the English one, keeping every parameter the budget wrote since", () => {
    window.history.replaceState(null, "", `/plan${QUERY}#butce`);
    render(<LanguageSwitch />);
    const link = screen.getByRole("link", { name: /^EN/ });
    expect(link).toHaveAttribute("hreflang", "en");
    expect(link).toHaveAttribute("lang", "en");
    // The budget rewrites the query in place: the link reads it when it is used.
    window.history.replaceState(null, "", `/plan${QUERY}&daily=40#butce`);
    fireEvent.focus(link);
    expect(link.getAttribute("href")).toBe(`/en/plan${QUERY}&daily=40#butce`);
  });

  it("goes back to Turkish from the English pages, in a full page load", () => {
    pathname = "/en/plan";
    window.history.replaceState(null, "", `/en/plan${QUERY}`);
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, search: QUERY, hash: "", assign });
    render(
      <I18nProvider locale="en" messages={en}>
        <LanguageSwitch />
      </I18nProvider>,
    );
    expect(screen.getByRole("group", { name: "Language" })).toHaveTextContent("EN/TR");
    fireEvent.click(screen.getByRole("link", { name: /^TR/ }));
    expect(assign).toHaveBeenCalledWith(`/plan${QUERY}`);
  });
});
