import type { ButtonHTMLAttributes } from "react";

/**
 * The one button every page should reach for going forward, replacing the
 * "bg-brass text-surface-0 font-medium px-4 py-1.5 rounded-full" string that
 * was copy-pasted into roughly 15 different files (Trades filters, Settings
 * forms, Reports toolbar, Login...). Those existing raw buttons still work
 * (brass is aliased to the new teal in tailwind.config.ts), but Step 4
 * should swap each one over to <Button> as it touches that page.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-full transition-all duration-fast ease-out disabled:opacity-50 disabled:pointer-events-none";

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-1.5",
};

const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-glow to-glow-violet text-surface-0 shadow-glow hover:brightness-110",
  secondary:
    "bg-surface-2 backdrop-blur-md border border-surface-border text-ink-primary hover:border-glow/50 hover:text-glow",
  ghost: "text-ink-secondary hover:text-ink-primary",
  danger: "border border-loss/40 text-loss hover:bg-loss/10",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}
