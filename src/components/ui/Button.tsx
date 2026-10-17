import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm font-sans font-medium " +
  "transition-[background-color,color,border-color,opacity] duration-200 ease-out " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink border border-accent hover:opacity-90",
  secondary: "bg-transparent text-ink border border-ink hover:bg-ink hover:text-paper-raised",
  ghost: "bg-transparent text-ink border border-transparent hover:border-rule",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-body",
  lg: "h-12 px-6 text-body",
};

// For long labels on narrow screens: the label may wrap and the button grows in height.
const wrapping: Record<ButtonSize, string> = {
  md: "min-h-10 px-4 py-2 text-body text-center",
  lg: "min-h-12 px-6 py-2.5 text-body text-center",
};

/** Class list for elements that should look like a button (e.g. links). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  wrap = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; wrap?: boolean; className?: string } = {}) {
  return cn(base, variants[variant], wrap ? wrapping[size] : cn("whitespace-nowrap", sizes[size]), className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
