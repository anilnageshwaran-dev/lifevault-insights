import * as React from "react";
import { Delete } from "lucide-react";

export function PinKeypad({
  value,
  onChange,
  maxLength = 4,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
}) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === "back") onChange(value.slice(0, -1));
    else if (value.length < maxLength) onChange(value + k);
  };

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex justify-center gap-4 mb-8" aria-label="PIN progress">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition-colors ${
              i < value.length ? "bg-primary" : "bg-foreground/15"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => press(n)}
            className="h-14 rounded-2xl bg-card hover:bg-accent border border-border text-2xl font-display transition-colors disabled:opacity-40"
          >
            {n}
          </button>
        ))}
        <div />
        <button
          type="button"
          disabled={disabled}
          onClick={() => press("0")}
          className="h-14 rounded-2xl bg-card hover:bg-accent border border-border text-2xl font-display transition-colors disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => press("back")}
          className="h-14 rounded-2xl bg-card hover:bg-accent border border-border flex items-center justify-center transition-colors disabled:opacity-40"
          aria-label="Backspace"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
