import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Latest known values for market instruments (indices, commodities, crypto).
// Uses the Lovable AI gateway; values are best-effort and may be stale.
export default defineTool({
  name: "market_quotes",
  title: "Market quotes",
  description:
    "Latest known values for stock indices (e.g. NIFTY 50, S&P 500), commodities (Gold, Silver per troy ounce), and cryptocurrencies. Best-effort via AI; may be delayed.",
  inputSchema: {
    instruments: z
      .array(z.string().min(1).max(120))
      .min(1)
      .max(20)
      .describe(
        "Instrument labels to look up, e.g. ['NIFTY 50', 'S&P 500', 'Gold (USD/oz)', 'Bitcoin']",
      ),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ instruments }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        content: [{ type: "text", text: "AI gateway is not configured on this server." }],
        isError: true,
      };
    }

    const list = instruments.map((label, i) => `${i + 1}. ${label}`).join("\n");
    const systemPrompt =
      "You are a market data assistant. Return the most recent known closing/last value for each instrument: stock indices, commodities (per troy ounce for gold/silver, per barrel for crude unless otherwise stated), and cryptocurrencies (per coin). If you do not know a value, return null. Never guess. Respond ONLY with valid JSON matching the schema.";
    const userPrompt =
      `Return latest known values for these instruments:\n${list}\n\n` +
      `Respond as JSON: {"results":[{"label":"<label>","price":<number|null>,"currency":"<ISO|null>","changePct":<number|null>,"asOf":"<YYYY-MM-DD|null>","source":"<short label|null>"}]}.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
        const status = res.status;
        const msg =
          status === 429
            ? "AI rate limit reached. Try again shortly."
            : status === 402
            ? "AI credits exhausted."
            : `AI gateway error (${status}).`;
        return { content: [{ type: "text", text: msg }], isError: true };
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      let parsed: { results?: unknown } = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        return {
          content: [{ type: "text", text: "AI returned an unparseable response." }],
          isError: true,
        };
      }
      const results = Array.isArray(parsed.results) ? parsed.results : [];
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        structuredContent: { results },
      };
    } catch (e) {
      return {
        content: [
          { type: "text", text: `Network error contacting AI gateway: ${(e as Error).message}` },
        ],
        isError: true,
      };
    }
  },
});
