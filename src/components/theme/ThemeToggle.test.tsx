import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("is one button that follows the system theme by default and names the next mode", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName("Tema: Sistem. Basınca: Açık");
    expect(button).toHaveAttribute("title", "Tema: Sistem. Basınca: Açık");
    expect(button).not.toHaveAttribute("aria-pressed");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("cycles system → light → dark → system with the mouse, remembers the choice and reads it out", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button");

    await user.click(button);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(button).toHaveAccessibleName("Tema: Açık. Basınca: Koyu");
    expect(screen.getByRole("status")).toHaveTextContent("Tema: Açık");

    await user.click(button);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(button).toHaveAccessibleName("Tema: Koyu. Basınca: Sistem");

    await user.click(button);
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(button).toHaveAccessibleName("Tema: Sistem. Basınca: Açık");
    expect(screen.getByRole("status")).toHaveTextContent("Tema: Sistem");
  });

  it("works from the keyboard: Tab reaches it, Enter and Space move it on", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.tab();
    const button = screen.getByRole("button");
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await user.keyboard(" ");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleName("Tema: Koyu. Basınca: Sistem");
  });

  it("reads a stored preference", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Tema: Koyu. Basınca: Sistem");
  });
});
