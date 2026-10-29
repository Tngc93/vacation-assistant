import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORIGIN_STORAGE_KEY, readRememberedOrigin, rememberOrigin, type OriginOption } from "@/data/origins";
import { BUDGET_FLIGHT_DROPPED_EVENT } from "@/lib/budget/params";
import { searchOrigins } from "@/lib/origins/data";
import { OriginControl } from "./TripControls";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const ISTANBUL: OriginOption = { code: "IST", name: "İstanbul", countryTr: "Türkiye", airports: ["IST", "SAW"] };
const LONDON: OriginOption = { code: "LON", name: "Londra", countryTr: "Birleşik Krallık", airports: ["LCY", "LGW", "LHR", "LTN", "SEN", "STN"] };
const PLAN = "/plan?to=BCN&depart=2026-11-14&return=2026-11-18";

/** /api/origins answered by the real server-side search, as the route does. */
const api = vi.fn(async (input: RequestInfo | URL) => {
  const q = new URL(String(input), "http://localhost").searchParams.get("q") ?? "";
  return Response.json({ results: searchOrigins(q) });
});

beforeEach(() => {
  replace.mockReset();
  api.mockClear();
  vi.stubGlobal("fetch", api);
  window.localStorage.clear();
  window.history.replaceState(null, "", PLAN);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const input = () => screen.getByRole("combobox", { name: "Kalkış" });

describe("OriginControl", () => {
  it("shows İstanbul with its airports by default", () => {
    render(<OriginControl value={ISTANBUL} />);
    expect(input()).toHaveValue("İstanbul");
    expect(screen.getByText("IST + SAW")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("searches on the server as you type, Turkish letters or none, and writes ?from= in place", async () => {
    const user = userEvent.setup();
    render(<OriginControl value={ISTANBUL} />);
    await user.clear(input());
    await user.type(input(), "munchen");
    const option = await screen.findByRole("option", { name: /Münih/ });
    expect(api).toHaveBeenCalledWith(expect.stringContaining("/api/origins?q=munchen"), expect.anything());
    await user.click(option);
    expect(replace).toHaveBeenCalledWith(`${PLAN}&from=MUC`, { scroll: false });
    expect(readRememberedOrigin()?.code).toBe("MUC");
  });

  it("finds a city by an airport code and picks it with the keyboard", async () => {
    const user = userEvent.setup();
    render(<OriginControl value={ISTANBUL} />);
    await user.clear(input());
    await user.type(input(), "LHR");
    await screen.findByRole("option", { name: /Londra/ });
    await waitFor(() => expect(input()).toHaveAttribute("aria-activedescendant"));
    await user.keyboard("{Enter}");
    expect(replace).toHaveBeenCalledWith(`${PLAN}&from=LON`, { scroll: false });
  });

  it("drops the budget's flight when the origin changes, and says so", async () => {
    window.history.replaceState(null, "", `${PLAN}&flight=IST-TK1853-202611140735-202611181310`);
    const dropped = vi.fn();
    window.addEventListener(BUDGET_FLIGHT_DROPPED_EVENT, dropped);
    const user = userEvent.setup();
    render(<OriginControl value={ISTANBUL} />);
    await user.clear(input());
    await user.type(input(), "londra");
    await user.click(await screen.findByRole("option", { name: /Londra/ }));
    expect(replace).toHaveBeenCalledWith(`${PLAN}&from=LON`, { scroll: false });
    expect(dropped).toHaveBeenCalledTimes(1);
    window.removeEventListener(BUDGET_FLIGHT_DROPPED_EVENT, dropped);
  });

  it("forgets the remembered city when İstanbul is chosen again, and never writes the default", async () => {
    window.history.replaceState(null, "", `${PLAN}&from=LON`);
    rememberOrigin(LONDON);
    const user = userEvent.setup();
    render(<OriginControl value={LONDON} />);
    await user.clear(input());
    await user.type(input(), "istanbul");
    await user.click(await screen.findByRole("option", { name: /İstanbul/ }));
    expect(replace).toHaveBeenCalledWith(PLAN, { scroll: false });
    expect(window.localStorage.getItem(ORIGIN_STORAGE_KEY)).toBeNull();
  });

  it("opens a plan without ?from= with the remembered city", async () => {
    rememberOrigin(LONDON);
    render(<OriginControl value={ISTANBUL} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`${PLAN}&from=LON`, { scroll: false }));
  });

  it("keeps the link's origin over the remembered one", async () => {
    window.history.replaceState(null, "", `${PLAN}&from=ESB`);
    rememberOrigin(LONDON);
    render(<OriginControl value={{ code: "ANK", name: "Ankara", countryTr: "Türkiye", airports: ["ESB"] }} />);
    await act(async () => {});
    expect(replace).not.toHaveBeenCalled();
  });

  it("falls back to İstanbul when storage cannot be read or holds something else", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readRememberedOrigin()).toBeNull();
    render(<OriginControl value={ISTANBUL} />);
    await act(async () => {});
    expect(replace).not.toHaveBeenCalled();
    expect(input()).toHaveValue("İstanbul");
    vi.restoreAllMocks();

    window.localStorage.setItem(ORIGIN_STORAGE_KEY, "{not json");
    expect(readRememberedOrigin()).toBeNull();
    window.localStorage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify({ code: "london" }));
    expect(readRememberedOrigin()).toBeNull();
  });

  it("still changes the plan when storage cannot be written", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const user = userEvent.setup();
    render(<OriginControl value={ISTANBUL} />);
    await user.clear(input());
    await user.type(input(), "berlin");
    await user.click(await screen.findByRole("option", { name: /Berlin/ }));
    expect(replace).toHaveBeenCalledWith(`${PLAN}&from=BER`, { scroll: false });
  });

  it("says calmly when the list cannot be fetched", async () => {
    api.mockImplementationOnce(async () => new Response("", { status: 500 }));
    const user = userEvent.setup();
    render(<OriginControl value={ISTANBUL} />);
    await user.clear(input());
    await user.type(input(), "x");
    expect(await screen.findByText(/Şehir listesi şu an alınamadı\. Biraz sonra/)).toBeInTheDocument();
  });
});
