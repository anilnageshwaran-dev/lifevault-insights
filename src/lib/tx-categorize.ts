// Heuristic categorizer for bank statement imports.
import type { TxType } from "./finance-context";

interface Rule {
  keywords: string[];
  category: string;
  type: TxType;
}

const RULES: Rule[] = [
  { keywords: ["swiggy", "zomato", "uber eats", "dominos", "kfc", "mcdonald"], category: "Food & Dining", type: "expense" },
  { keywords: ["uber", "ola", "rapido", "blusmart", "metro"], category: "Transport", type: "expense" },
  { keywords: ["netflix", "hotstar", "spotify", "prime video", "youtube premium", "disney"], category: "Subscriptions", type: "expense" },
  { keywords: ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa"], category: "Shopping", type: "expense" },
  { keywords: ["emi", "loan", "hdfc home", "icici loan", "sbi loan", "bajaj fin"], category: "EMI & Loans", type: "expense" },
  { keywords: ["salary", "sal cr", "payroll", "wages"], category: "Salary", type: "income" },
  { keywords: ["atm", "cash wdl", "cash withdrawal"], category: "Cash Withdrawal", type: "expense" },
  { keywords: ["electricity", "bescom", "mseb", "tata power", "torrent power", "adani electric"], category: "Utilities", type: "expense" },
  { keywords: ["hospital", "pharmacy", "medical", "apollo", "1mg", "pharmeasy"], category: "Healthcare", type: "expense" },
  { keywords: ["insurance", "lic", "premium", "policy"], category: "Insurance", type: "expense" },
  { keywords: ["mutual fund", "sip", "bse", "nse", "zerodha", "groww", "kuvera", "kfintech", "cams"], category: "Mutual Fund SIP", type: "investment" },
  { keywords: ["rent", "house rent"], category: "Housing & Rent", type: "expense" },
  { keywords: ["grocery", "bigbasket", "dmart", "reliance fresh", "blinkit", "zepto", "instamart"], category: "Groceries", type: "expense" },
  { keywords: ["interest", "int cr", "fd interest"], category: "Interest", type: "income" },
  { keywords: ["dividend"], category: "Dividends", type: "income" },
  { keywords: ["credit card payment", "cc payment", "card payment"], category: "Credit Card Payment", type: "expense" },
  { keywords: ["irctc", "indigo", "makemytrip", "yatra", "vistara", "airindia", "spicejet"], category: "Travel & Vacations", type: "expense" },
  { keywords: ["jio", "airtel", "vi recharge", "vodafone", "bsnl"], category: "Utilities", type: "expense" },
];

export interface CategorizedTx {
  date: string;
  description: string;
  amount: number;
  type: TxType;
  category: string;
  matched: boolean;
}

export function categorize(description: string, amount: number, isCredit: boolean): { type: TxType; category: string; matched: boolean } {
  const desc = description.toLowerCase();
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (desc.includes(kw)) {
        // Income rule on debit row? Switch to expense fallback.
        if (rule.type === "income" && !isCredit) return { type: "expense", category: "Other Expense", matched: false };
        if (rule.type !== "income" && isCredit && rule.type !== "investment") {
          // credit row matching expense keyword (e.g. refund) → other income
          return { type: "income", category: "Other Income", matched: false };
        }
        return { type: rule.type, category: rule.category, matched: true };
      }
    }
  }
  return {
    type: isCredit ? "income" : "expense",
    category: isCredit ? "Other Income" : "Other Expense",
    matched: false,
  };
}
