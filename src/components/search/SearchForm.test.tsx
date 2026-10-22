import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "./SearchForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const TODAY = "2026-10-16";

describe("SearchForm", () => {
  beforeEach(() => push.mockReset());

  it("asks only where and when: no origin or passenger controls", () => {
    render(<SearchForm today={TODAY} />);
    expect(screen.getByRole("combobox", { name: "Varış şehri" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Gidiş/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Dönüş/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Nereden|Yolcu|Kişi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /artır|azalt/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Planla" })).toHaveClass("bg-accent");
  });

  it("is fillable end to end with the keyboard and 'Planla' opens /plan with the city and dates only", async () => {
    const user = userEvent.setup();
    render(<SearchForm today={TODAY} />);

    // Destination.
    await user.click(screen.getByRole("combobox", { name: "Varış şehri" }));
    await user.keyboard("barse{Enter}");
    expect(screen.getByRole("combobox", { name: "Varış şehri" })).toHaveValue("Barselona");

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

    await user.click(screen.getByRole("button", { name: "Planla" }));
    expect(push).toHaveBeenCalledWith("/plan?to=BCN&depart=2026-11-14&return=2026-11-18");
  });

  it("a discover city chip picks the city and opens the calendar", async () => {
    const user = userEvent.setup();
    render(<SearchForm today={TODAY} />);
    const discover = screen.getByRole("list", { name: "Keşfet:" });
    expect(within(discover).getAllByRole("button")).toHaveLength(6);
    await user.click(within(discover).getByRole("button", { name: "Roma" }));
    expect(screen.getByRole("combobox", { name: "Varış şehri" })).toHaveValue("Roma");
    expect(within(discover).getByRole("button", { name: "Roma" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("dialog", { name: "Gidiş tarihini seç" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /20 Ekim 2026/ }));
    await user.click(screen.getByRole("button", { name: /23 Ekim 2026/ }));
    await user.click(screen.getByRole("button", { name: "Planla" }));
    expect(push).toHaveBeenCalledWith("/plan?to=ROM&depart=2026-10-20&return=2026-10-23");
  });

  it("keeps a link's origin and group when the city or dates are edited", async () => {
    const user = userEvent.setup();
    render(<SearchForm today={TODAY} initial={{ from: "ESB", pax: 3, to: "BCN", depart: "2026-11-14", return: "2026-11-18" }} />);
    await user.click(screen.getByRole("button", { name: "Planla" }));
    expect(push).toHaveBeenCalledWith("/plan?from=ESB&to=BCN&depart=2026-11-14&return=2026-11-18&pax=3");
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
    await user.click(screen.getByRole("button", { name: "Planla" }));
    expect(push).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Bir varış şehri seç.");
    expect(alert).toHaveTextContent("Gidiş tarihini seç.");
    expect(alert).toHaveTextContent("Dönüş tarihini seç.");
    expect(screen.getByRole("combobox", { name: "Varış şehri" })).toHaveAttribute("aria-invalid", "true");
  });
});
