import { defineMcp } from "@lovable.dev/mcp-js";
import marketQuotesTool from "./tools/market-quotes";
import currencyConvertTool from "./tools/currency-convert";
import sipCalculatorTool from "./tools/sip-calculator";
import emiCalculatorTool from "./tools/emi-calculator";

export default defineMcp({
  name: "lifevault-mcp",
  title: "LifeVault",
  version: "0.1.0",
  instructions:
    "LifeVault helpers for personal finance. Use `market_quotes` for latest index/commodity/crypto values, `currency_convert` for FX conversion, and `sip_calculator` / `emi_calculator` for standard investment and loan math. Note: personal user vault data (accounts, holdings, goals) is end-to-end encrypted client-side and is not accessible via MCP.",
  tools: [marketQuotesTool, currencyConvertTool, sipCalculatorTool, emiCalculatorTool],
});
