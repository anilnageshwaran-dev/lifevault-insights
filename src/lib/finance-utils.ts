export const formatINR = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return "₹0";
  const num = Math.round(Number(n));
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num).toString();
  // Indian comma format
  let lastThree = abs.slice(-3);
  const otherNumbers = abs.slice(0, -3);
  const formatted =
    otherNumbers.length > 0
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
  return `${sign}₹${formatted}`;
};

export const formatCompactINR = (n: number): string => {
  if (!n) return "₹0";
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return formatINR(n);
};

export const pct = (n: number, decimals = 0) =>
  `${(isFinite(n) ? n : 0).toFixed(decimals)}%`;

export const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));

export const uid = () => Math.random().toString(36).slice(2, 10);
