// Fetch market data (indices, commodities, crypto) via Lovable AI gateway.
// Best-effort: model returns JSON; unknowns are null and skipped on the UI.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const QuoteSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  hint: z.string().max(200).optional(),
});

const InputSchema = z.object({
  quotes: z.array(QuoteSchema).min(1).max(40),
});

export interface QuoteResult {
  id: string;
  price: number | null;
  currency: string | null;
  changePct: number | null;
  asOf: string | null;
  source: string | null;
}

export const refreshMarketQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ results: QuoteResult[]; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { results: [], error: "AI gateway is not configured" };
    }

    const list = data.quotes
      .map((q, i) => `${i + 1}. id=${q.id} | ${q.label}${q.hint ? ` — ${q.hint}` : ""}`)
      .join("\n");

    const systemPrompt =
      "You are a market data assistant. Return the most recent known closing/last value for each instrument: stock indices, commodities (per troy ounce for gold/silver, per barrel for crude unless otherwise stated), and cryptocurrencies (per coin). " +
      "If you do not know a value, return null. Never guess. Respond ONLY with valid JSON matching the schema.";

    const userPrompt =
      `Return latest known values for these instruments:\n${list}\n\n` +
      `Respond as JSON: {"results":[{"id":"<id>","price":<number|null>,"currency":"<ISO|null>","changePct":<number|null>,"asOf":"<YYYY-MM-DD|null>","source":"<short label|null>"}]}.\n` +
      `changePct is the most recent daily % change. Use ISO currency codes (USD, INR, etc.).`;

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
      let parsed: { results?: Array<Partial<QuoteResult>> } = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        return { results: [], error: "AI returned an unparseable response" };
      }

      const results: QuoteResult[] = (parsed.results ?? [])
        .filter((r): r is Partial<QuoteResult> & { id: string } => typeof r?.id === "string")
        .map((r) => ({
          id: r.id,
          price: typeof r.price === "number" && isFinite(r.price) ? r.price : null,
          currency: typeof r.currency === "string" ? r.currency : null,
          changePct: typeof r.changePct === "number" && isFinite(r.changePct) ? r.changePct : null,
          asOf: typeof r.asOf === "string" ? r.asOf : null,
          source: typeof r.source === "string" ? r.source : null,
        }));

      return { results, error: null };
    } catch (e) {
      console.error("refreshMarketQuotes failed", e);
      return { results: [], error: "Network error while contacting AI gateway" };
    }
  });
