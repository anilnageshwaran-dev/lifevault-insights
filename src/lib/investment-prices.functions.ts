// Refresh market prices for investment holdings using the Lovable AI gateway.
// Best-effort: the model is asked to return JSON; if a price is unknown it
// returns null and we skip that holding.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HoldingSchema = z.object({
  id: z.string().min(1).max(64),
  ticker: z.string().trim().min(1).max(128),
  name: z.string().trim().max(200).optional(),
  kind: z.enum(["stock", "mutualfund", "crypto"]).default("stock"),
  currency: z.string().trim().min(2).max(8).optional(),
});

const InputSchema = z.object({
  holdings: z.array(HoldingSchema).min(1).max(40),
});

export interface PriceResult {
  id: string;
  price: number | null;
  currency: string | null;
  asOf: string | null;
  source: string | null;
}

export const refreshInvestmentPrices = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ results: PriceResult[]; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { results: [], error: "AI gateway is not configured" };
    }

    const list = data.holdings
      .map((h, i) => `${i + 1}. id=${h.id} | ${h.kind} | ${h.ticker}${h.name ? ` (${h.name})` : ""}${h.currency ? ` [${h.currency}]` : ""}`)
      .join("\n");

    const systemPrompt =
      "You are a market data assistant. Return the latest known price per unit for each holding. " +
      "If you do not know a price, return null. Never guess. Respond ONLY with valid JSON matching the schema.";

    const userPrompt =
      `Return latest known price per unit for these holdings:\n${list}\n\n` +
      `Respond as JSON: {"results":[{"id":"<id>","price":<number|null>,"currency":"<ISO|null>","asOf":"<YYYY-MM-DD|null>","source":"<short label|null>"}]}.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 429) return { results: [], error: "AI rate limit reached. Try again shortly." };
        if (res.status === 402) return { results: [], error: "AI credits exhausted. Add credits to continue." };
        console.error("AI gateway error", res.status, text);
        return { results: [], error: `AI gateway error (${res.status})` };
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      let parsed: { results?: Array<Partial<PriceResult>> } = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        return { results: [], error: "AI returned an unparseable response" };
      }

      const results: PriceResult[] = (parsed.results ?? [])
        .filter((r): r is Partial<PriceResult> & { id: string } => typeof r?.id === "string")
        .map((r) => ({
          id: r.id,
          price: typeof r.price === "number" && isFinite(r.price) && r.price >= 0 ? r.price : null,
          currency: typeof r.currency === "string" ? r.currency : null,
          asOf: typeof r.asOf === "string" ? r.asOf : null,
          source: typeof r.source === "string" ? r.source : null,
        }));

      return { results, error: null };
    } catch (e) {
      console.error("refreshInvestmentPrices failed", e);
      return { results: [], error: "Network error while contacting AI gateway" };
    }
  });
