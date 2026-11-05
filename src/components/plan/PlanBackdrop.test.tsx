import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanBackdrop } from "./PlanBackdrop";

const backdrop = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-plan-backdrop]")!;

/** The hero zone as the plan renders it: the backdrop, then the hero with the masthead photo. */
function Zone({ hasPhoto, photo = true }: { hasPhoto: boolean; photo?: boolean }) {
  return (
    <div>
      <PlanBackdrop hasPhoto={hasPhoto} lat={52.37} lon={4.89} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img data-city-photo="" alt="" src="https://upload.wikimedia.org/x.jpg" /> : null}
    </div>
  );
}

/** jsdom has no 2D canvas: a stand-in that returns the drawn photo's pixels (warm sandstone) and records the paint. */
function stubDrawing() {
  const drawImage = vi.fn();
  const putImageData = vi.fn();
  const getImageData = vi.fn((_x: number, _y: number, w: number, h: number) => {
    const data = Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => [196, 150, 110, 255][i % 4]);
    return { data, width: w, height: h } as ImageData;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage, getImageData, putImageData } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal("ImageData", class {
    constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
  });
  document.documentElement.style.setProperty("--ink", "#16181d");
  document.documentElement.style.setProperty("--paper", "#f4efe6");
  document.documentElement.style.setProperty("--accent", "#b8492a");
  document.documentElement.style.setProperty("--sea", "#1f5560");
  return { drawImage, putImageData };
}

function loadImage(img: HTMLImageElement, size: { width: number; height: number } | null) {
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: size?.width ?? 0 });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: size?.height ?? 0 });
  act(() => {
    img.dispatchEvent(new Event(size ? "load" : "error"));
  });
}

describe("PlanBackdrop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is decoration only: hidden from assistive technology and never in the way", () => {
    const { container } = render(<Zone hasPhoto={false} />);
    const root = backdrop(container);
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.querySelector("[tabindex], a, button")).toBeNull();
    expect(root).toHaveClass("plan-backdrop");
  });

  it("shows the city's gradient when there is no photo, with nothing to load", () => {
    const { container } = render(<Zone hasPhoto={false} photo={false} />);
    expect(backdrop(container)).toHaveAttribute("data-state", "gradient");
    const gradient = container.querySelector<HTMLElement>(".plan-backdrop-gradient")!;
    expect(gradient.style.getPropertyValue("--pb-warm")).toMatch(/%$/);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("waits for the masthead photo, then copies it into a canvas in the city's tritone: no image of its own, no new request", () => {
    const { drawImage, putImageData } = stubDrawing();
    const { container } = render(<Zone hasPhoto />);
    expect(backdrop(container)).toHaveAttribute("data-state", "pending");
    expect(backdrop(container).querySelector("img")).toBeNull();
    const img = container.querySelector<HTMLImageElement>("img[data-city-photo]")!;
    loadImage(img, { width: 1280, height: 853 });
    expect(backdrop(container)).toHaveAttribute("data-state", "photo");
    expect(backdrop(container)).toHaveAttribute("data-tone", "warm");
    const canvas = container.querySelector("canvas")!;
    expect(drawImage).toHaveBeenCalledWith(img, 0, 0, 256, 171);
    expect([canvas.width, canvas.height]).toEqual([256, 171]);
    // Recoloured: the sandstone is no longer itself, it lies between ink and paper through the accent.
    const painted = putImageData.mock.calls[0][0] as ImageData;
    expect([...painted.data.slice(0, 3)]).not.toEqual([196, 150, 110]);
  });

  it("paints again when the theme changes", async () => {
    const { putImageData } = stubDrawing();
    const { container } = render(<Zone hasPhoto />);
    loadImage(container.querySelector<HTMLImageElement>("img[data-city-photo]")!, { width: 100, height: 50 });
    expect(putImageData).toHaveBeenCalledTimes(1);
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    expect(putImageData).toHaveBeenCalledTimes(2);
    document.documentElement.removeAttribute("data-theme");
  });

  it("falls back to the gradient when the photo fails to load", () => {
    stubDrawing();
    const { container } = render(<Zone hasPhoto />);
    loadImage(container.querySelector<HTMLImageElement>("img[data-city-photo]")!, null);
    expect(backdrop(container)).toHaveAttribute("data-state", "gradient");
    expect(container.querySelector(".plan-backdrop-gradient")).not.toBeNull();
  });

  it("falls back to the gradient when the masthead has no photo element", () => {
    const { container } = render(<Zone hasPhoto photo={false} />);
    expect(backdrop(container)).toHaveAttribute("data-state", "gradient");
  });
});
