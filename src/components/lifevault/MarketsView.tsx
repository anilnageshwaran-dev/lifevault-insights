import * as React from "react";
import { GlassCard } from "./primitives";
import { CurrencyRatesCard } from "./CurrencyRatesCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, Minus, LineChart, Coins, Bitcoin } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { refreshMarketQuotes, type QuoteResult } from "@/lib/market-data.functions";
import { toast } from "sonner";

type Instrument = { id: string; label: string; hint?: string; sub?: string };

const INDICES: Instrument[] = [
  { id: "nifty50", label: "NIFTY 50", hint: "NSE India benchmark", sub: "India" },
  { id: "sensex", label: "SENSEX", hint: "BSE 30 India", sub: "India" },
  { id: "banknifty", label: "BANK NIFTY", hint: "NSE India banking index", sub: "India" },
  { id: "niftynext50", label: "NIFTY Next 50", hint: "NSE India", sub: "India" },
  { id: "giftnifty", label: "GIFT NIFTY", hint: "SGX/NSE IX Nifty futures, Gandhinagar", sub: "India / SGX" },
  { id: "sp500", label: "S&P 500", hint: "US large-cap index", sub: "US" },
  { id: "nasdaq", label: "NASDAQ Composite", hint: "US tech-heavy index", sub: "US" },
  { id: "dowjones", label: "Dow Jones", hint: "DJIA US 30", sub: "US" },
  { id: "ftse100", label: "FTSE 100", hint: "UK large-cap", sub: "UK" },
  { id: "nikkei", label: "Nikkei 225", hint: "Japan", sub: "Asia" },
  { id: "hangseng", label: "Hang Seng", hint: "Hong Kong", sub: "Asia" },
];

const COMMODITIES: Instrument[] = [
  { id: "gold", label: "Gold", hint: "spot, per troy ounce in USD" },
  { id: "silver", label: "Silver", hint: "spot, per troy ounce in USD" },
  { id: "gold_inr_10g", label: "Gold (India, 10g 24k)", hint: "approx retail INR per 10 grams" },
  { id: "silver_inr_kg", label: "Silver (India, 1kg)", hint: "approx retail INR per kg" },
  { id: "crude_brent", label: "Brent Crude", hint: "USD per barrel" },
  { id: "crude_wti", label: "WTI Crude", hint: "USD per barrel" },
];

const CRYPTO: Instrument[] = [
  { id: "btc", label: "Bitcoin (BTC)", hint: "USD per coin" },
  { id: "eth", label: "Ethereum (ETH)", hint: "USD per coin" },
  { id: "sol", label: "Solana (SOL)", hint: "USD per coin" },
  { id: "bnb", label: "BNB", hint: "USD per coin" },
  { id: "xrp", label: "XRP", hint: "USD per coin" },
  { id: "ada", label: "Cardano (ADA)", hint: "USD per coin" },
];

const ALL = [...INDICES, ...COMMODITIES, ...CRYPTO];
const CACHE_KEY = "lifevault_market_quotes";
const CACHE_TTL = 15 * 60 * 1000; // 15 min

interface Cache { ts: number; results: QuoteResult[] }

function loadCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function fmt(n: number | null, currency: string | null): string {
  if (n === null) return "—";
  const cur = currency || "";
  const opts: Intl.NumberFormatOptions = {
    maximumFractionDigits: n >= 1000 ? 2 : n >= 1 ? 2 : 4,
    minimumFractionDigits: 2,
  };
  return `${cur ? cur + " " : ""}${n.toLocaleString(undefined, opts)}`;
}

export function MarketsView() {
  const refresh = useServerFn(refreshMarketQuotes);
  const [cache, setCache] = React.useState<Cache | null>(() => loadCache());
  const [busy, setBusy] = React.useState(false);

  const byId = React.useMemo(() => {
    const m = new Map<string, QuoteResult>();
    (cache?.results ?? []).forEach((r) => m.set(r.id, r));
    return m;
  }, [cache]);

  const doRefresh = React.useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.ts < CACHE_TTL) return;
    setBusy(true);
    try {
      const res = await refresh({ data: { quotes: ALL.map(({ id, label, hint }) => ({ id, label, hint })) } });
      if (res.error) {
        toast.error(res.error);
      } else {
        const next = { ts: Date.now(), results: res.results };
        setCache(next);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
        toast.success("Markets updated");
      }
    } catch {
      toast.error("Failed to refresh markets");
    } finally {
      setBusy(false);
    }
  }, [cache, refresh]);

  React.useEffect(() => {
    if (!cache) void doRefresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updated = cache?.ts ? new Date(cache.ts) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-2xl">Markets</div>
          <p className="text-xs text-muted-foreground mt-1">
            Live indices, commodities, crypto and currency rates · AI-powered, for reference only.
          </p>
        </div>

        <Button onClick={() => doRefresh(true)} disabled={busy} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {updated && (
        <p className="text-[11px] text-muted-foreground -mt-2">Updated {updated.toLocaleString()}</p>
      )}

      <CurrencyRatesCard />

      <Section title="Stock Indices" icon={<LineChart className="h-4 w-4 text-primary" />} items={INDICES} byId={byId} loading={busy && !cache} />
      <Section title="Commodities" icon={<Coins className="h-4 w-4 text-primary" />} items={COMMODITIES} byId={byId} loading={busy && !cache} />
      <Section title="Cryptocurrencies" icon={<Bitcoin className="h-4 w-4 text-primary" />} items={CRYPTO} byId={byId} loading={busy && !cache} />

      <p className="text-[11px] text-muted-foreground text-center pb-4">
        Values are AI-sourced approximations and may be delayed. Not investment advice.
      </p>
    </div>
  );
}

function Section({
  title, icon, items, byId, loading,
}: {
  title: string;
  icon: React.ReactNode;
  items: Instrument[];
  byId: Map<string, QuoteResult>;
  loading: boolean;
}) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="font-display text-lg">{title}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((it) => {
          const q = byId.get(it.id);
          const change = q?.changePct ?? null;
          const Trend = change === null ? Minus : change >= 0 ? TrendingUp : TrendingDown;
          const trendColor = change === null
            ? "text-muted-foreground"
            : change >= 0 ? "text-emerald-400" : "text-rose-400";
          return (
            <div key={it.id} className="rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{it.label}</div>
                  {it.sub && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.sub}</div>}
                </div>
                <Trend className={`h-3.5 w-3.5 shrink-0 ${trendColor}`} />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <div className="font-display text-base tabular truncate">
                  {loading && !q ? "…" : fmt(q?.price ?? null, q?.currency ?? null)}
                </div>
                {change !== null && (
                  <div className={`text-xs tabular ${trendColor}`}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
