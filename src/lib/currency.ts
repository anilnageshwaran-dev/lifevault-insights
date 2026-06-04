// Multi-currency support: base currency, FX rates, formatters.

export interface CurrencyDef {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", locale: "ar-AE" },
  { code: "SAR", symbol: "ر.س", name: "Saudi Riyal", locale: "ar-SA" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", locale: "bn-BD" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee", locale: "en-PK" },
  { code: "LKR", symbol: "රු", name: "Sri Lankan Rupee", locale: "si-LK" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", locale: "de-CH" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", locale: "en-HK" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", locale: "en-NZ" },
  { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA" },
  { code: "THB", symbol: "฿", name: "Thai Baht", locale: "th-TH" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", locale: "ms-MY" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", locale: "id-ID" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", locale: "en-PH" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong", locale: "vi-VN" },
  { code: "KRW", symbol: "₩", name: "South Korean Won", locale: "ko-KR" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", locale: "tr-TR" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", locale: "pt-BR" },
  { code: "MXN", symbol: "$", name: "Mexican Peso", locale: "es-MX" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", locale: "sv-SE" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", locale: "nb-NO" },
  { code: "DKK", symbol: "kr", name: "Danish Krone", locale: "da-DK" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", locale: "pl-PL" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble", locale: "ru-RU" },
  { code: "EGP", symbol: "E£", name: "Egyptian Pound", locale: "ar-EG" },
  { code: "NPR", symbol: "रू", name: "Nepalese Rupee", locale: "ne-NP" },
];

export const CURRENCY_MAP: Record<string, CurrencyDef> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
);

export function getCurrency(code: string | undefined): CurrencyDef {
  return CURRENCY_MAP[code || "INR"] || CURRENCY_MAP.INR;
}

export function formatMoney(
  amount: number | undefined | null,
  code = "INR",
): string {
  const c = getCurrency(code);
  if (amount === undefined || amount === null || isNaN(Number(amount)))
    return `${c.symbol}0`;
  const num = Math.round(Number(amount));
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  if (c.code === "INR") {
    const s = abs.toString();
    const last = s.slice(-3);
    const rest = s.slice(0, -3);
    const fmt = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last : last;
    return `${sign}${c.symbol}${fmt}`;
  }
  return `${sign}${c.symbol}${abs.toLocaleString("en-US")}`;
}

export function formatCompact(amount: number, code = "INR"): string {
  const c = getCurrency(code);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (c.code === "INR") {
    if (abs >= 1_00_00_000) return `${sign}${c.symbol}${(abs / 1_00_00_000).toFixed(2)}Cr`;
    if (abs >= 1_00_000) return `${sign}${c.symbol}${(abs / 1_00_000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}${c.symbol}${(abs / 1000).toFixed(1)}K`;
  } else {
    if (abs >= 1_000_000) return `${sign}${c.symbol}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1000) return `${sign}${c.symbol}${(abs / 1000).toFixed(1)}K`;
  }
  return formatMoney(amount, code);
}

// FX rates: cached in localStorage, fetched from exchangerate-api (free).
export interface FxCache {
  base: string; // base currency of rates (we always fetch in INR)
  rates: Record<string, number>; // 1 INR = rates[code] units of code
  ts: number;
}

const FX_KEY = "lifevault_fx_rates";
const ONE_DAY = 24 * 60 * 60 * 1000;

export function loadFxCache(): FxCache | null {
  try {
    const raw = localStorage.getItem(FX_KEY);
    return raw ? (JSON.parse(raw) as FxCache) : null;
  } catch {
    return null;
  }
}

export async function fetchFxRates(force = false): Promise<FxCache | null> {
  const cached = loadFxCache();
  if (!force && cached && Date.now() - cached.ts < ONE_DAY) return cached;
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/INR");
    if (!res.ok) throw new Error("fx fetch failed");
    const data = (await res.json()) as { base: string; rates: Record<string, number> };
    const cache: FxCache = { base: "INR", rates: data.rates, ts: Date.now() };
    try {
      localStorage.setItem(FX_KEY, JSON.stringify(cache));
    } catch {}
    return cache;
  } catch {
    return cached;
  }
}

/**
 * Convert `amount` denominated in `from` currency to `to` currency.
 * Rates are stored as 1 INR = rates[code] foreign units.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  fx: FxCache | null,
): number {
  if (!amount) return 0;
  if (from === to) return amount;
  if (!fx) return amount; // no rates: return original (caller should warn)
  const rFrom = from === "INR" ? 1 : fx.rates[from];
  const rTo = to === "INR" ? 1 : fx.rates[to];
  if (!rFrom || !rTo) return amount;
  // amount(from) → INR → to
  const inr = amount / rFrom;
  return inr * rTo;
}
