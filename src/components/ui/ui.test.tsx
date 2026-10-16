import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonClasses, Caption, Chip, Skeleton, SkeletonTicket, Stamp, Ticket } from "@/components/ui";

describe("Button", () => {
  it("renders a non-submitting button by default", () => {
    render(<Button>Planı çıkar</Button>);
    expect(screen.getByRole("button", { name: "Planı çıkar" })).toHaveAttribute("type", "button");
  });

  it("uses the accent only for the primary variant", () => {
    expect(buttonClasses({ variant: "primary" })).toContain("bg-accent");
    expect(buttonClasses({ variant: "secondary" })).not.toContain("bg-accent");
    expect(buttonClasses({ variant: "ghost" })).not.toContain("bg-accent");
  });

  it("calls onClick, and not when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Ara</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Ara
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Chip", () => {
  it("exposes its selected state through aria-pressed", () => {
    const { rerender } = render(<Chip>Müze</Chip>);
    const chip = screen.getByRole("button", { name: "Müze" });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    rerender(<Chip selected>Müze</Chip>);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip.className).toContain("bg-ink");
    expect(chip.className).not.toContain("bg-accent");
  });

  it("hides the icon from assistive technology", () => {
    render(<Chip icon={<svg data-testid="icon" />}>Kafe</Chip>);
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Kafe" })).toBeInTheDocument();
  });
});

describe("Caption", () => {
  it("is mono and uppercase with the requested tone", () => {
    render(<Caption tone="warn">Tahmini</Caption>);
    const caption = screen.getByText("Tahmini");
    expect(caption.className).toEqual(expect.stringContaining("font-mono"));
    expect(caption.className).toEqual(expect.stringContaining("uppercase"));
    expect(caption.className).toEqual(expect.stringContaining("text-warn"));
  });

  it("renders as the requested element", () => {
    render(<Caption as="p">Kaynak</Caption>);
    expect(screen.getByText("Kaynak").tagName).toBe("P");
  });
});

describe("Ticket", () => {
  it("renders body and stub with a decorative perforation", () => {
    const { container } = render(
      <Ticket aria-label="Uçuş" stub={<p>Koçan</p>}>
        <p>Gövde</p>
      </Ticket>,
    );
    expect(screen.getByRole("article", { name: "Uçuş" })).toBeInTheDocument();
    expect(screen.getByText("Gövde")).toBeInTheDocument();
    expect(screen.getByText("Koçan")).toBeInTheDocument();
    const perforation = container.querySelector('[data-slot="perforation"]');
    expect(perforation).toHaveAttribute("aria-hidden", "true");
    // Two half-circle notches plus the dashed rule.
    expect(perforation?.children).toHaveLength(3);
  });

  it("omits the perforation when there is no stub", () => {
    const { container } = render(<Ticket>Gövde</Ticket>);
    expect(container.querySelector('[data-slot="perforation"]')).toBeNull();
  });
});

describe("Stamp", () => {
  it("announces its full text and is tilted by default", () => {
    render(<Stamp label="Vizesiz" detail="90 gün" />);
    const stamp = screen.getByRole("img", { name: "Vizesiz, 90 gün" });
    expect(stamp.className).toContain("-rotate-6");
    expect(stamp.className).toContain("text-ok");
  });

  it("can sit straight at 0° and use the warning tone", () => {
    render(<Stamp label="Vize gerekli" tone="warn" tilted={false} />);
    const stamp = screen.getByRole("img", { name: "Vize gerekli" });
    expect(stamp.className).not.toContain("rotate");
    expect(stamp.className).toContain("text-warn");
  });
});

describe("Skeleton", () => {
  it("is decorative and uses the rule colour", () => {
    const { container } = render(<Skeleton className="h-4" />);
    const block = container.firstElementChild;
    expect(block).toHaveAttribute("aria-hidden", "true");
    expect(block?.className).toContain("bg-rule");
  });

  it("skeleton ticket exposes a status label", () => {
    render(<SkeletonTicket label="Uçuşlar yükleniyor" />);
    expect(screen.getByRole("status")).toHaveTextContent("Uçuşlar yükleniyor");
  });
});
