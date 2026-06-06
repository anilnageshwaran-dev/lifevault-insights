import * as React from "react";
import { HelpCircle, X, MessageSquare } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ: Array<{ q: string; a: string }> = [
  { q: "Is my data safe?", a: "Yes. All data is encrypted with AES-256-GCM using your PIN before it leaves your device. We cannot read your data." },
  { q: "What if I forget my PIN?", a: "Your PIN cannot be recovered — it is the encryption key. You would need to reset your vault and start fresh. Please note your PIN securely." },
  { q: "Does LifeVault work offline?", a: "Yes. Your last synced data is cached locally and updates sync to the cloud when you reconnect." },
  { q: "Can I use LifeVault on multiple devices?", a: "Yes. Sign in with the same Google account and enter your PIN on each device." },
  { q: "How do I share with my family?", a: "Settings → Family. Create a household and invite members. They get a high-level overview; your vault stays private." },
  { q: "Is LifeVault really free?", a: "Yes, completely free. No ads, no paywalls, no premium tiers." },
  { q: "How do I export my data?", a: "Settings → Data → Export JSON or download CSVs to back up everything you've entered." },
];

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export function HelpDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Help & FAQ
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 text-sm">
          <section>
            <h4 className="font-medium mb-2">Quick Start</h4>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside">
              <li>Add your first asset in <strong>Net Worth</strong></li>
              <li>Set your emergency fund in <strong>Essentials</strong></li>
              <li>Store passwords in <strong>Vault → Passwords</strong></li>
              <li>Track recurring expenses in <strong>Cash Flow → Bills</strong></li>
            </ul>
          </section>
          <section>
            <h4 className="font-medium mb-2">FAQ</h4>
            <Accordion type="single" collapsible>
              {FAQ.map((f, i) => (
                <AccordionItem key={i} value={`q${i}`}>
                  <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
          <section>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Contact
            </h4>
            <p className="text-muted-foreground text-sm">
              Have a question or found a bug? Use the Feedback button (bottom-left) and we'll see it instantly.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const STEPS: { title: string; body: string }[] = [
  { title: "Welcome to LifeVault! 🎉", body: "Your complete financial picture in one secure place. Let's take a quick tour." },
  { title: "Home Dashboard", body: "Net worth, monthly stats, upcoming bills, and quick actions — everything at a glance." },
  { title: "Net Worth", body: "Add all your assets and liabilities here. Snapshot to track growth over time." },
  { title: "Cash Flow", body: "Track income, expenses, accounts, recurring bills, and budgets." },
  { title: "Goals", body: "Set financial goals — we'll inflation-adjust them and tell you exactly how much to save each month." },
  { title: "Essentials", body: "Your financial health check — emergency fund, insurance, savings rate." },
  { title: "Vault", body: "Securely store credentials, documents, and family details. All encrypted with your PIN." },
  { title: "Emergency Page", body: "The Emergency button in your Vault gives your family everything they need in one place." },
];

const TOUR_KEY = "lifevault_tour_completed";

export function useTourState() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_KEY) !== "1") setShow(true);
    } catch {}
  }, []);
  const dismiss = React.useCallback(() => {
    try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
    setShow(false);
  }, []);
  return { show, dismiss, restart: () => setShow(true) };
}

export function AppTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => { if (open) setStep(0); }, [open]);
  if (!open) return null;
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl">{s.title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent" aria-label="Close tour">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-3">{s.body}</p>
        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-4 rounded-full ${i === step ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
              Skip
            </button>
            <button
              onClick={() => isLast ? onClose() : setStep(step + 1)}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm"
            >
              {isLast ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
