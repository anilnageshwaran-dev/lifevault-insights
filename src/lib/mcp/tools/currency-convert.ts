import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Convert an amount between two ISO currency codes using live FX rates
// (exchangerate-api.com free endpoint, INR base).
export default defineTool({
  name: "currency_convert",
  title: "Currency converter",
  description:
    "Convert an amount from one ISO 4217 currency to another using current mid-market rates.",
  inputSchema: {
    amount: z.number().describe("Amount in the source currency."),
    from: z.string().length(3).describe("Source ISO 4217 code, e.g. USD, INR, EUR."),
    to: z.string().length(3).describe("Target ISO 4217 code, e.g. USD, INR, EUR."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ amount, from, to }) => {
    const src = from.toUpperCase();
    const dst = to.toUpperCase();
    if (src === dst) {
      return {
        content: [{ type: "text", text: `${amount} ${src} = ${amount} ${dst}` }],
        structuredContent: { amount, from: src, to: dst, converted: amount, rate: 1 },
      };
    }
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/INR");
      if (!res.ok) throw new Error(`FX API returned ${res.status}`);
      const data = (await res.json()) as { rates: Record<string, number> };
      const rFrom = src === "INR" ? 1 : data.rates[src];
      const rTo = dst === "INR" ? 1 : data.rates[dst];
      if (!rFrom || !rTo) {
        return {
          content: [{ type: "text", text: `Unknown currency: ${!rFrom ? src : dst}` }],
          isError: true,
        };
      }
      const converted = (amount / rFrom) * rTo;
      const rate = rTo / rFrom;
      return {
        content: [
          {
            type: "text",
            text: `${amount} ${src} = ${converted.toFixed(4)} ${dst} (1 ${src} = ${rate.toFixed(6)} ${dst})`,
          },
        ],
        structuredContent: { amount, from: src, to: dst, converted, rate },
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `FX lookup failed: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
});
