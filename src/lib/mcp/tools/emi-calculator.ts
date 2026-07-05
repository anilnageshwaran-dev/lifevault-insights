import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Standard reducing-balance EMI calculator.
export default defineTool({
  name: "emi_calculator",
  title: "EMI calculator",
  description:
    "Compute the monthly EMI, total interest and total payment for a loan on reducing-balance basis.",
  inputSchema: {
    principal: z.number().positive().describe("Loan principal amount."),
    annualRatePct: z.number().describe("Annual interest rate percent, e.g. 8.5 for 8.5%."),
    years: z.number().positive().describe("Loan tenure in years."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ principal, annualRatePct, years }) => {
    const n = Math.round(years * 12);
    const r = annualRatePct / 100 / 12;
    const emi =
      r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = emi * n;
    const interest = total - principal;
    const round = (x: number) => Math.round(x * 100) / 100;
    return {
      content: [
        {
          type: "text",
          text: `EMI ${round(emi)} × ${n} months. Total paid ${round(total)} (interest ${round(interest)}).`,
        },
      ],
      structuredContent: {
        months: n,
        emi: round(emi),
        totalPayment: round(total),
        totalInterest: round(interest),
      },
    };
  },
});
