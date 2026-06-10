import * as React from "react";
import { toast } from "sonner";
import { useFinance, type AssetItem } from "@/lib/finance-context";
import { applySipProcess, computeDueSips, type DueSip } from "@/lib/sip-engine";
import { formatMoney } from "@/lib/currency";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldLabel, MoneyInput, NumberInput } from "./primitives";

/** Bottom sheet that appears once per session if SIPs are due. */
export function SipDueSheet() {
  const { state, setState } = useFinance();
  const [open, setOpen] = React.useState(false);
  const [reviewIdx, setReviewIdx] = React.useState<number | null>(null);
  const dismissedRef = React.useRef(false);

  const due: DueSip[] = React.useMemo(() => computeDueSips(state), [state]);

  React.useEffect(() => {
    if (dismissedRef.current) return;
    if (due.length > 0 && !open) setOpen(true);
  }, [due.length, open]);

  if (due.length === 0) return null;

  const markAll = () => {
    setState((s) => {
      let next = s;
      const today = new Date().toISOString().slice(0, 10);
      for (const d of due) {
        const fresh = next.assets.find((a) => a.id === d.asset.id);
        if (!fresh) continue;
        next = applySipProcess(next, fresh, d.amount, today);
      }
      return next;
    });
    toast.success(`${due.length} SIP${due.length > 1 ? "s" : ""} processed ✅`);
    dismissedRef.current = true;
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) dismissedRef.current = true; }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📅 {due.length} SIP{due.length > 1 ? "s" : ""} Due</DialogTitle>
          <DialogDescription>Process your scheduled investments.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {due.map((d) => (
            <div key={d.asset.id} className="flex justify-between items-center rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{d.asset.name}</div>
                <div className="text-[11px] text-muted-foreground">Due {d.dueDate}</div>
              </div>
              <div className="tabular text-sm">{formatMoney(d.amount, d.asset.currency)}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button onClick={markAll}>✅ Mark All as Invested</Button>
          <Button variant="secondary" onClick={() => setReviewIdx(0)}>Review Each</Button>
        </div>

        {reviewIdx !== null && due[reviewIdx] && (
          <ReviewStep
            sip={due[reviewIdx]}
            onSkip={() => {
              if (reviewIdx + 1 >= due.length) { setReviewIdx(null); setOpen(false); dismissedRef.current = true; }
              else setReviewIdx(reviewIdx + 1);
            }}
            onConfirm={(amount, units, price) => {
              setState((s) => {
                const fresh = s.assets.find((a) => a.id === due[reviewIdx].asset.id);
                if (!fresh) return s;
                return applySipProcess(s, fresh, amount, undefined, units || undefined, price || undefined);
              });
              toast.success("SIP processed");
              if (reviewIdx + 1 >= due.length) {
                setReviewIdx(null);
                setOpen(false);
                dismissedRef.current = true;
              } else {
                setReviewIdx(reviewIdx + 1);
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewStep({ sip, onConfirm, onSkip }: {
  sip: DueSip;
  onConfirm: (amount: number, units?: number, price?: number) => void;
  onSkip: () => void;
}) {
  const [amount, setAmount] = React.useState(sip.amount);
  const [units, setUnits] = React.useState(0);
  const [price, setPrice] = React.useState(sip.asset.currentPrice || sip.asset.avgPrice || 0);
  return (
    <div className="mt-2 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 space-y-2">
      <div className="text-sm font-medium">{sip.asset.name}</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <FieldLabel>Amount</FieldLabel>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div>
          <FieldLabel>NAV/Price</FieldLabel>
          <MoneyInput value={price} onChange={setPrice} />
        </div>
        <div>
          <FieldLabel>Units</FieldLabel>
          <NumberInput value={units} onChange={setUnits} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => onConfirm(amount, units, price)}>Confirm</Button>
        <Button variant="ghost" onClick={onSkip}>Skip</Button>
      </div>
    </div>
  );
}

/** Helper for the Bills page "Mark as Invested" button. */
export function processSingleSip(
  state: ReturnType<typeof useFinance>["state"],
  setState: ReturnType<typeof useFinance>["setState"],
  asset: AssetItem,
) {
  setState((s) => applySipProcess(s, asset, asset.sipAmount || 0));
  toast.success(`${asset.name} SIP processed ✅`);
}
