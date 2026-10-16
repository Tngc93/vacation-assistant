import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "./SearchForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const TODAY = "2026-10-16";

describe("SearchForm", () => {
  beforeEach(() => push.mockReset());

  it("defaults to Istanbul and shows its airports on the ticket", () => {
    render(<SearchForm today={TODAY} />);
    expect(screen.getByRole("radio", { name: /İstanbul/ })).toBeChecked();
    expect(screen.getByText("IST · SAW")).toBeInTheDocument();
  });

  it("is fillable end to end with the keyboard and sends the user to /plan", async () => {
    const user = userEvent.setup();
    render(<SearchForm today={TODAY} />);

    // Origin: arrow keys move within the native radio group.
    await user.click(screen.getByRole("radio", { name: /İstanbul/ }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /Ankara/ })).toBeChecked();
    expect(screen.getByText("ESB", { selector: "p" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");

    // Destination.
    await user.tab();
    expect(screen.getByRole("combobox", { name: "Varış şehri" })).toHaveFocus();
    await user.keyboard("barse{Enter}");
    expect(screen.getByText("BCN", { selector: "p" })).toBeInTheDocument();

    // Dates: the calendar opens on Enter and takes focus.
    await user.tab();
    expect(screen.getByRole("button", { name: /^Gidiş/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "Gidiş tarihini seç" });
    await user.click(within(dialog).getByRole("button", { name: "Sonraki aya git" }));
    await user.click(within(dialog).getByRole("button", { name: /14 Kasım 2026/ }));
    expect(screen.getByRole("dialog", { name: "Dönüş tarihini seç" })).toBeInTheDocument();
    // The departure stays highlighted while the return is picked.
    expect(screen.getByRole("button", { name: /14 Kasım 2026/ }).closest("td")?.className).toContain("bg-accent");
    await user.click(screen.getByRole("button", { name: /18 Kasım 2026/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Dönüş/ })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Gidiş: 14 Kas Cmt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dönüş: 18 Kas Çar" })).toBeInTheDocument();

    // Passengers.
    await user.click(screen.getByRole("button", { name: "Yolcu artır" }));
    expect(screen.getAllByText("2 kişi", { exact: false }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Planı çıkar" }));
    expect(push).toHaveBeenCalledWith("/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2");
  });

  it("disables past days and days beyond 30 nights", async () => {
    const user = userEvent.setup();
    render(<SearchForm today={TODAY} />);
    await user.click(screen.getByRole("button", { name: /^Gidiş/ }));
    expect(screen.getByRole("button", { name: /15 Ekim 2026/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /20 Ekim 2026/ }));
    await user.click(screen.getByRole("button", { name: "Sonraki aya git" }));
    expect(screen.getByRole("button", { name: /19 Kasım 2026/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /20 Kasım 2026/ })).toBeDisabled();
  });

  it("shows what is missing instead of navigating", async () => {
    const user = userEvent.setup();
    render(<SearchForm today={TODAY} />);
    await user.click(screen.getByRole("button", { name: "Planı çıkar" }));
    expect(push).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Bir varış şehri seç.");
    expect(alert).toHaveTextContent("Gidiş tarihini seç.");
    expect(alert).toHaveTextContent("Dönüş tarihini seç.");
    expect(screen.getByRole("combobox", { name: "Varış şehri" })).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps passengers between 1 and 9", async () => {
    const user = userEvent.setup();
    render(<SearchForm today={TODAY} initial={{ pax: 9 }} />);
    expect(screen.getByRole("button", { name: "Yolcu artır" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Yolcu azalt" }));
    expect(screen.getByRole("button", { name: "Yolcu artır" })).toBeEnabled();
  });
});
