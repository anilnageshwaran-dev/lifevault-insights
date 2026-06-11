import * as React from "react";
import { GlassCard } from "./primitives";
import { useFinance } from "@/lib/finance-context";
import { CURRENCIES, convert, getCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, ArrowRightLeft, Globe2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const POPULAR = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "AUD", "CAD", "JPY"];

export function CurrencyRatesCard() {
  const { state, fx, refreshFx } = useFinance();
  const base = state.baseCurrency || "INR";
  const [from, setFrom] = React.useState<string>(base);
  const [to, setTo] = React.useState<string>(base === "USD" ? "INR" : "USD");
  const [amount, setAmount] = React.useState<string>("1");
  const [busy, setBusy] = React.useState(false);

  const onRefresh = async () => {
    setBusy(true);
    try {
      await refreshFx(true);
      toast.success("Currency rates refreshed");
    } catch {
      toast.error("Failed to refresh rates");
    } finally {
      setBusy(false);
    }
  };

  const updated = fx?.ts ? new Date(fx.ts) : null;
  const amt = Number(amount) || 0;
  const converted = convert(amt, from, to, fx);
  const rate = convert(1, from, to, fx);

  // Comparison table: 1 unit of base → popular currencies
  const watchlist = React.useMemo(() => {
    const list = Array.from(new Set([base, ...POPULAR])).filter((c) => c !== base);
    return list.slice(0, 8).map((code) => ({
      code,
      symbol: getCurrency(code).symbol,
      name: getCurrency(code).name,
      rate: convert(1, base, code, fx),
    }));
  }, [base, fx]);

  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-primary" />
          <div>
            <div className="font-display text-lg">Live Currency Rates</div>
            <div className="text-xs text-muted-foreground">
              {updated ? `Updated ${updated.toLocaleString()}` : "Rates not loaded yet"}
            </div>
          </div>
        </div>
        <Button onClick={onRefresh} disabled={busy} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Converter */}
      <div className="mt-4 rounded-xl border border-border bg-white/[0.02] p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</label>
            <div className="flex gap-2 mt-1">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="flex-1 min-w-0 rounded-md bg-background border border-border px-2 py-1.5 text-sm tabular"
              />
              <CcySelect value={from} onChange={setFrom} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setFrom(to); setTo(from); }}
            className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-md border border-border hover:bg-white/[0.04]"
            title="Swap"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </button>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</label>
            <div className="flex gap-2 mt-1">
              <div className="flex-1 min-w-0 rounded-md bg-background border border-border px-2 py-1.5 text-sm tabular truncate">
                {fx ? converted.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
              </div>
              <CcySelect value={to} onChange={setTo} />
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          1 {from} = <span className="text-foreground tabular">{fx ? rate.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}</span> {to}
        </div>
      </div>

      {/* Watchlist */}
      <div className="mt-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          1 {base} equals
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {watchlist.map((w) => (
            <div key={w.code} className="rounded-lg border border-border bg-white/[0.02] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{w.code}</span>
                <span className="text-[10px] text-muted-foreground truncate">{w.name}</span>
              </div>
              <div className="font-display text-base tabular mt-0.5">
                {w.symbol} {fx ? w.rate.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}
              </div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground mt-3">
          Rates from exchangerate-api · refreshed daily · for reference only.
        </div>
      </div>
    </GlassCard>
  );
}

function CcySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[92px] h-9 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
