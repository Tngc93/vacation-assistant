import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteStrip } from "./RouteStrip";

const strip = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-route-strip]")!;

describe("RouteStrip", () => {
  it("names the origin and the destination at either end of the route", () => {
    const { container } = render(<RouteStrip from="IST" to="BCN" />);
    expect(strip(container)).toHaveAttribute("aria-hidden", "true");
    expect(strip(container)).toHaveTextContent(/^ISTBCN$/);
    expect(strip(container)).toHaveClass("print:hidden");
    expect(container.querySelector("[data-route-line]")).toHaveClass("plan-route-line");
  });

  it("draws a new line when the origin changes", () => {
    const { container, rerender } = render(<RouteStrip from="IST" to="BCN" />);
    const before = container.querySelector("[data-route-line]");
    rerender(<RouteStrip from="IST" to="BCN" />);
    expect(container.querySelector("[data-route-line]")).toBe(before);
    rerender(<RouteStrip from="LON" to="BCN" />);
    expect(strip(container)).toHaveAttribute("data-from", "LON");
    expect(strip(container)).toHaveTextContent(/^LONBCN$/);
    // A new element: its draw animation starts again.
    expect(container.querySelector("[data-route-line]")).not.toBe(before);
  });

  it("draws no route from a city to itself", () => {
    const { container } = render(<RouteStrip from="BCN" to="BCN" />);
    expect(container.querySelector("[data-route-line]")).toBeNull();
    expect(strip(container)).toHaveTextContent(/^BCN$/);
  });
});
