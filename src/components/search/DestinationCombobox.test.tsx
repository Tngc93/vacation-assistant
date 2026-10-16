import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DESTINATIONS } from "@/data/destinations";
import { DestinationCombobox } from "./DestinationCombobox";

function Harness({ onChange, initial }: { onChange?: (code: string | undefined) => void; initial?: string }) {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <>
      <DestinationCombobox
        value={value}
        onChange={(code) => {
          setValue(code);
          onChange?.(code);
        }}
        label="Varış şehri"
      />
      <output data-testid="value">{value ?? ""}</output>
      <button type="button">Sonraki alan</button>
    </>
  );
}

const combobox = () => screen.getByRole("combobox", { name: "Varış şehri" });
const activeOption = () => {
  const id = combobox().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

describe("DestinationCombobox", () => {
  it("follows the combobox pattern", () => {
    render(<Harness />);
    const input = combobox();
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(input.getAttribute("aria-controls")!)).toHaveAttribute("role", "listbox");
  });

  it("opens with ArrowDown and moves through options, wrapping at both ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(combobox()).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(DESTINATIONS.length);
    const first = activeOption();
    expect(first).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toBe(screen.getAllByRole("option").at(-1));
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe(first);
    // Focus never leaves the input.
    expect(combobox()).toHaveFocus();
  });

  it("filters while typing, picks with Enter and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(combobox());
    await user.keyboard("KOPENH");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(activeOption()).toHaveTextContent("Kopenhag");
    expect(activeOption()).toHaveTextContent("Danimarka");
    expect(activeOption()).toHaveTextContent("CPH");

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("CPH");
    expect(combobox()).toHaveValue("Kopenhag");
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(combobox()).not.toHaveAttribute("aria-activedescendant");
  });

  it("matches English spellings and IATA codes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(combobox());
    await user.keyboard("barcelona{Enter}");
    expect(screen.getByTestId("value")).toHaveTextContent("BCN");

    await user.clear(combobox());
    await user.keyboard("lhr{Enter}");
    expect(screen.getByTestId("value")).toHaveTextContent("LON");
    expect(combobox()).toHaveValue("Londra");
  });

  it("Escape closes the list first, then clears the field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial="BCN" />);
    expect(combobox()).toHaveValue("Barselona");

    await user.click(combobox());
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(combobox()).toHaveValue("Barselona");

    await user.keyboard("{Escape}");
    expect(combobox()).toHaveValue("");
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("Tab leaves without changing the choice", async () => {
    const user = userEvent.setup();
    render(<Harness initial="BCN" />);
    await user.click(combobox());
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.tab();
    expect(screen.getByRole("button", { name: "Sonraki alan" })).toHaveFocus();
    expect(screen.getByTestId("value")).toHaveTextContent("BCN");
    expect(combobox()).toHaveValue("Barselona");
  });

  it("selects an option by mouse", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(combobox());
    await user.keyboard("tok");
    await user.click(screen.getByRole("option", { name: /Tokyo/ }));
    expect(screen.getByTestId("value")).toHaveTextContent("TYO");
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(combobox());
    await user.keyboard("qqqq");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(within(screen.getByRole("listbox")).getByText(/eşleşen şehir yok/i)).toBeInTheDocument();
    expect(screen.getByText("Eşleşen şehir yok.")).toHaveAttribute("aria-live", "polite");
  });
});
