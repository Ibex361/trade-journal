import type { ReactNode } from "react";

type Tone = "glow" | "loss" | "neutral";

const tones: Record<Tone, string> = {
  glow: "bg-glow/15 text-glow",
  loss: "bg-loss/15 text-loss",
  neutral: "bg-surface-2 text-ink-muted",
};

export default function Badge({
  children,
  tone = "glow",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
