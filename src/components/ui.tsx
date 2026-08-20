import type { ReactNode } from "react";
import type { Position } from "../types";

export function PosBadge({ pos }: { pos: Position | string }) {
  const cls =
    pos === "QB"
      ? "pos-qb bg-amber-400/10 border-amber-400/30"
      : pos === "RB"
        ? "pos-rb bg-emerald-400/10 border-emerald-400/30"
        : pos === "WR"
          ? "pos-wr bg-sky-400/10 border-sky-400/30"
          : pos === "TE"
            ? "pos-te bg-pink-400/10 border-pink-400/30"
            : pos === "K"
              ? "pos-k bg-violet-400/10 border-violet-400/30"
              : "pos-dst bg-rose-400/10 border-rose-400/30";
  return (
    <span className={`inline-flex min-w-10 justify-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium ${cls}`}>
      {pos}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "gold" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-field-500 text-ink-950 hover:bg-field-400",
    ghost: "bg-white/5 text-white hover:bg-white/10 border border-white/10",
    gold: "bg-gold-400 text-ink-950 hover:bg-gold-500",
    danger: "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 border border-rose-500/30",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/60">
      {label}
      <input
        type="number"
        className="rounded-md border border-white/10 bg-ink-900 px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-field-500"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-ink-900 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
            value === o.id ? "bg-field-500 text-ink-950" : "text-white/70 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Shell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <div className="min-h-screen field-grid">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-ink-950/85 px-4 py-3 backdrop-blur">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.25em] text-field-500">Fantasy Draft Coach</p>
          <h1 className="font-display text-xl uppercase tracking-wide">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6">{children}</main>
    </div>
  );
}
