import * as React from "react";
import { cn } from "@/lib/utils";

export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = React.useState(value ? String(value) : "");
  React.useEffect(() => {
    setText(value ? String(value) : "");
  }, [value]);
  return (
    <input
      inputMode="decimal"
      className={cn("underline-input", className)}
      placeholder={placeholder ?? "0"}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        setText(raw);
        onChange(raw ? Number(raw) : 0);
      }}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  className,
  min,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  min?: number;
}) {
  return (
    <input
      type="number"
      min={min}
      className={cn("underline-input", className)}
      placeholder={placeholder}
      value={value || ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : 0)}
    />
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">
      {children}
    </label>
  );
}

export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div>
        <h3 className="font-display text-lg sm:text-xl text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="rounded-full bg-white/[0.04] p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h4 className="font-display text-lg text-foreground">{title}</h4>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {description}
      </p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
