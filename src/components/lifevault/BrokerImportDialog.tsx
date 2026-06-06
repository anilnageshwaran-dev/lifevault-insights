import * as React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2 } from "lucide-react";
import Papa from "papaparse";
import { useFinance } from "@/lib/finance-context";
import { uid } from "@/lib/finance-utils";
import { toast } from "sonner";
import type { AssetItem } from "@/lib/finance-context";

type Broker = "zerodha" | "groww" | "other";

interface Row {
  name: string;
  units: number;
  avgPrice: number;
  value: number;
  invested: number;
  include: boolean;
}

interface Props { open: boolean; onClose: () => void; }

export function BrokerImportDialog({ open, onClose }: Props) {
  const { state, setState } = useFinance();
  const base = state.baseCurrency || "INR";
  const [broker, setBroker] = React.useState<Broker>("zerodha");
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [replace, setReplace] = React.useState(false);

  const parseFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const mapped = mapRows(res.data, broker);
          if (mapped.length === 0) {
            toast.error("Couldn't find any holdings. Check the CSV format.");
            return;
          }
          setRows(mapped);
        } catch (e) {
          toast.error((e as Error).message || "Parse failed");
        }
      },
      error: (e) => toast.error(e.message),
    });
  };

  const doImport = () => {
    if (!rows) return;
    const incl = rows.filter((r) => r.include);
    if (incl.length === 0) {
      toast.error("No rows selected");
      return;
    }
    const newAssets: AssetItem[] = incl.map((r) => ({
      id: uid(),
      category: "equity",
      subtype: "Direct Stock",
      name: r.name,
      value: r.value,
      invested: r.invested,
      units: r.units,
      avgPrice: r.avgPrice,
      currency: base,
      notes: `Imported from ${broker} on ${new Date().toLocaleDateString()}`,
    }));
    setState((s) => ({
      ...s,
      assets: replace
        ? [...s.assets.filter((a) => a.category !== "equity"), ...newAssets]
        : [...s.assets, ...newAssets],
    }));
    toast.success(`Imported ${incl.length} holding${incl.length === 1 ? "" : "s"}`);
    setRows(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Import from Broker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {(["zerodha", "groww", "other"] as Broker[]).map((b) => (
              <button key={b} onClick={() => { setBroker(b); setRows(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm border capitalize ${
                  broker === b ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                }`}>
                {b === "other" ? "Other CSV" : b}
              </button>
            ))}
          </div>

          {/* Instructions */}
          {broker === "zerodha" && (
            <Hint title="How to export from Zerodha"
              steps={["Log in to console.zerodha.com", "Portfolio → Holdings", "Click Download (↓) → CSV", "Upload the file below"]} />
          )}
          {broker === "groww" && (
            <Hint title="How to export from Groww"
              steps={["Open the Groww web/app", "Portfolio → Download statement", "Choose CSV format", "Upload the file below"]} />
          )}
          {broker === "other" && (
            <Hint title="Generic CSV"
              steps={["Headers should include something like Name/Instrument and Current Value", "We'll match common columns automatically"]} />
          )}

          {/* File upload */}
          {!rows && (
            <label className="rounded-2xl border-2 border-dashed border-border p-8 flex flex-col items-center gap-3 cursor-pointer hover:bg-accent/30">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm font-medium">Drop CSV or click to choose</div>
              <div className="text-xs text-muted-foreground">.csv files only · max 5MB</div>
              <input
                type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
              />
            </label>
          )}

          {/* Preview */}
          {rows && (
            <div className="space-y-3">
              <div className="text-sm font-medium">{rows.length} holdings parsed · review before importing</div>
              <div className="border border-border rounded-lg overflow-x-auto max-h-72">
                <table className="w-full text-xs tabular">
                  <thead className="sticky top-0 bg-card text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Stock</th>
                      <th className="px-2 py-2 text-right">Units</th>
                      <th className="px-2 py-2 text-right">Avg</th>
                      <th className="px-2 py-2 text-right">Value</th>
                      <th className="px-2 py-2 text-right">Invested</th>
                      <th className="px-2 py-2 text-center">Incl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1.5">{r.name}</td>
                        <td className="px-2 py-1.5 text-right">{r.units.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right">{r.avgPrice.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right">{r.value.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right">{r.invested.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={r.include}
                            onChange={(e) => setRows(rows.map((row, j) => j === i ? { ...row, include: e.target.checked } : row))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                Replace existing equity assets (otherwise add alongside)
              </label>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setRows(null)}>Back</Button>
                <Button size="sm" onClick={doImport} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Import {rows.filter((r) => r.include).length}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Hint({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 text-xs">
      <div className="font-medium mb-1.5 flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" /> {title}
      </div>
      <ol className="list-decimal list-inside text-muted-foreground space-y-0.5">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

const num = (s: string | undefined): number => {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^\d.-]/g, ""));
  return isFinite(n) ? n : 0;
};

function mapRows(data: Record<string, string>[], broker: Broker): Row[] {
  const findKey = (row: Record<string, string>, ...candidates: string[]): string | undefined => {
    const keys = Object.keys(row);
    for (const c of candidates) {
      const found = keys.find((k) => k.toLowerCase().trim() === c.toLowerCase());
      if (found) return found;
    }
    // Fuzzy match: contains
    for (const c of candidates) {
      const found = keys.find((k) => k.toLowerCase().includes(c.toLowerCase()));
      if (found) return found;
    }
    return undefined;
  };

  return data
    .map((row) => {
      const nameKey = findKey(row, "Instrument", "Stock", "Symbol", "Name", "Scrip");
      const qtyKey = findKey(row, "Qty", "Quantity", "Units", "Shares");
      const avgKey = findKey(row, "Avg cost", "Avg Cost", "Average Cost", "Avg price", "Buy Avg");
      const valKey = findKey(row, "Cur val", "Current value", "Current Value", "LTP value", "Market Value");
      const ltpKey = findKey(row, "LTP", "Last Price");

      const name = nameKey ? row[nameKey] : "";
      if (!name || /^total|^sum/i.test(name)) return null;
      const units = qtyKey ? num(row[qtyKey]) : 0;
      const avgPrice = avgKey ? num(row[avgKey]) : 0;
      let value = valKey ? num(row[valKey]) : 0;
      if (!value && ltpKey) value = num(row[ltpKey]) * units;
      const invested = units * avgPrice;
      if (!units && !value) return null;
      return { name, units, avgPrice, value, invested, include: true } as Row;
    })
    .filter((r): r is Row => r !== null);
}
