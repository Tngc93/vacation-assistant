import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItineraryView } from "@/components/itinerary/ItineraryView";
import { mockProvider } from "@/lib/ai/mockProvider";
import { EVENING, SIGHTS } from "@/lib/itinerary/testCity";
import { AI_PANEL_ID, AiDrawerProvider, AiTabButton } from "./AiDrawer";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="map" /> }));

const SEARCH = "to=BCN&depart=2026-11-14&return=2026-11-18";
const input = { depart: "2026-11-14", return: "2026-11-18", timeZone: "Europe/Madrid", flight: null, daytime: SIGHTS, evening: EVENING };
const edit = JSON.stringify({ commands: [{ op: "remove", id: "n101" }], reply: "2. günden bir müzeyi çıkardım." });

function renderPlan(fetcher: typeof fetch = mockProvider("gemini", []).fetcher) {
  return render(
    <AiDrawerProvider>
      <AiTabButton />
      <ItineraryView input={input} initialSkip={[]} cityName="Barselona" center={{ lat: 41.39, lon: 2.17 }} aiFetch={fetcher} />
    </AiDrawerProvider>,
  );
}
const tab = () => screen.getByRole("button", { name: /^Yapay zekâ ile planla/ });
const panel = () => document.getElementById(AI_PANEL_ID)!;
const day = (n: number) => screen.getByRole("region", { name: new RegExp(`^${n}\\. gün · `) });
const narrow = window.matchMedia;
const desktop = () => {
  window.matchMedia = (query: string) => ({ ...narrow(query), matches: true });
};

async function connectGemini(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Google Gemini" }));
  await user.type(screen.getByLabelText("API anahtarı"), "test-key-not-real");
  await user.click(screen.getByRole("button", { name: "Bağlan" }));
  await screen.findByLabelText(/^Model/);
  await user.click(screen.getByRole("button", { name: "Bağlandı, devam et" }));
}

describe("AI tab and side panel", () => {
  beforeEach(() => window.history.replaceState(null, "", `/plan?${SEARCH}#gun-gun-plan`));
  afterEach(() => {
    window.matchMedia = narrow;
    window.sessionStorage.clear();
  });

  it("puts the plan first: the days come before the panel, which starts closed", () => {
    renderPlan();
    expect(day(1).compareDocumentPosition(panel()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel()).not.toBeVisible();
    expect(screen.queryByRole("region", { name: "Yapay zekâ ile planla" })).not.toBeInTheDocument();
    expect(tab()).toHaveAttribute("aria-expanded", "false");
    expect(tab()).toHaveAttribute("aria-controls", AI_PANEL_ID);
  });

  it("opens and closes from the tab, the close button and Escape, moving the focus in and back", async () => {
    const user = userEvent.setup();
    desktop();
    renderPlan();
    await user.click(tab());
    expect(tab()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Yapay zekâ ile planla" })).toBeVisible();
    expect(panel()).toHaveFocus();
    // Desktop: a side panel, not modal; the days stay on screen.
    expect(panel()).not.toHaveAttribute("role", "dialog");
    expect(day(1)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Yapay zekâ panelini kapat" }));
    expect(panel()).not.toBeVisible();
    await vi.waitFor(() => expect(tab()).toHaveFocus());

    await user.click(tab());
    await user.click(screen.getByLabelText("API anahtarı"));
    await user.keyboard("{Escape}");
    expect(panel()).not.toBeVisible();
    await vi.waitFor(() => expect(tab()).toHaveFocus());

    await user.click(tab());
    await user.click(tab());
    expect(panel()).not.toBeVisible();
    // Open or closed, the panel is not part of the link.
    expect(window.location.search).toBe(`?${SEARCH}`);
  });

  it("on a phone opens as a full-screen sheet that closes after a change, marking the changed day and the tab", async () => {
    const user = userEvent.setup();
    renderPlan(mockProvider("gemini", [edit], ["gemini-2.5-flash"]).fetcher);
    await user.click(tab());
    const sheet = screen.getByRole("dialog", { name: "Yapay zekâ ile planla" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(sheet.className).toContain("fixed");
    await connectGemini(user);

    expect(within(day(2)).getByText("Sight 0-1")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Planı sohbetle değiştir"), "2. günü müzesiz yap");
    await user.click(screen.getByRole("button", { name: "Uygula" }));
    await vi.waitFor(() => expect(panel()).not.toBeVisible());
    expect(within(day(2)).queryByText("Sight 0-1")).not.toBeInTheDocument();
    expect(day(2)).toHaveAttribute("data-changed", "true");
    expect(day(1)).not.toHaveAttribute("data-changed");
    // The closed tab shows a dot for the change the panel can summarise.
    expect(tab()).toHaveAccessibleName(/^Yapay zekâ ile planla ?\(yeni değişiklik\)$/);

    await user.click(tab());
    expect(screen.getByText("2. günden bir müzeyi çıkardım.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Geri al" })).toBeInTheDocument();
  });

  it("on a desktop keeps the panel open after a change, so it shows on the plan beside it", async () => {
    const user = userEvent.setup();
    desktop();
    renderPlan(mockProvider("gemini", [edit], ["gemini-2.5-flash"]).fetcher);
    fireEvent.click(tab());
    await connectGemini(user);
    await user.type(screen.getByLabelText("Planı sohbetle değiştir"), "2. günü müzesiz yap");
    await user.click(screen.getByRole("button", { name: "Uygula" }));
    await screen.findByText("2. günden bir müzeyi çıkardım.");
    expect(panel()).toBeVisible();
    expect(within(day(2)).queryByText("Sight 0-1")).not.toBeInTheDocument();
    expect(day(2)).toBeVisible();
  });
});
