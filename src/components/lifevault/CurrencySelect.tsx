import * as React from "react";
import { CURRENCIES, getCurrency } from "@/lib/currency";

export function CurrencySelect({
  value,
  onChange,
  className,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary disabled:opacity-60"
      }
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.symbol} {c.code} — {c.name}
        </option>
      ))}
    </select>
  );
}

export function CurrencySymbol({ code }: { code: string }) {
  return <span className="tabular">{getCurrency(code).symbol}</span>;
}
