import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Standard SIP future value calculator.
export default defineTool({
  name: "sip_calculator",
  title: "SIP calculator",
  description:
    "Project the future value of a monthly SIP given monthly contribution, expected annual return, and duration in years.",
  inputSchema: {
    monthly: z.number().positive().describe("Monthly SIP contribution."),
    annualReturnPct: z.number().describe("Expected annual return, e.g. 12 for 12%."),
    years: z.number().positive().describe("Investment horizon in years."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ monthly, annualReturnPct, years }) => {
    const n = Math.round(years * 12);
    const r = annualReturnPct / 100 / 12;
    const fv = r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const invested = monthly * n;
    const gains = fv - invested;
    const round = (x: number) => Math.round(x * 100) / 100;
    return {
      content: [
        {
          type: "text",
          text: `Invested ${round(invested)} over ${n} months → future value ${round(fv)} (gains ${round(gains)}) at ${annualReturnPct}% p.a.`,
        },
      ],
      structuredContent: {
        months: n,
        invested: round(invested),
        futureValue: round(fv),
        gains: round(gains),
      },
    };
  },
});
