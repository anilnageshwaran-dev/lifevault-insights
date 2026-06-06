import * as React from "react";
import { MessageSquare, X, Star } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { submitFeedback } from "@/lib/feedback.functions";
import { useAuth } from "@/lib/auth-context";
import { APP_VERSION } from "@/lib/changelog";

type FbType = "bug" | "idea" | "general";

export function FeedbackButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed left-3 bottom-20 md:bottom-4 z-30 flex items-center gap-2 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground px-3 py-2 shadow-lg shadow-primary/20 backdrop-blur transition-all"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="text-xs hidden sm:inline">Feedback</span>
      </button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const { user } = useAuth();
  const submit = useServerFn(submitFeedback);
  const [type, setType] = React.useState<FbType>("general");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [rating, setRating] = React.useState<number | undefined>(undefined);
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setEmail(user?.email ?? "");
  }, [open, user]);

  const send = async () => {
    if (description.trim().length < 3) {
      toast.error("Please add a bit more detail");
      return;
    }
    setBusy(true);
    try {
      const composed = title.trim() ? `${title.trim()}\n\n${description.trim()}` : description.trim();
      await submit({
        data: {
          category: type,
          message: composed.slice(0, 2000),
          rating: type === "general" ? rating : undefined,
          email: email.trim(),
          appVersion: APP_VERSION,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : undefined,
        },
      });
      toast.success("Thanks for your feedback! 🙏 We read every submission.");
      setTitle("");
      setDescription("");
      setRating(undefined);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Could not send feedback");
    } finally {
      setBusy(false);
    }
  };

  const types: { id: FbType; label: string }[] = [
    { id: "bug", label: "Bug Report" },
    { id: "idea", label: "Feature Request" },
    { id: "general", label: "General" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Share your feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div className="grid grid-cols-3 gap-2">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                  type === t.id
                    ? "bg-primary/15 text-foreground border-primary/30"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="Short summary"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-muted-foreground">Description *</label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{description.length}/500</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="What happened, or what would you like to see?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y"
            />
          </div>

          {type === "general" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rating:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? undefined : n)}
                  aria-label={`${n} stars`}
                  className={`p-1 rounded-md ${rating && n <= rating ? "text-warning" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Star className="h-4 w-4" fill={rating && n <= rating ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Tip: You can attach a screenshot by emailing us directly.
          </p>

          <div className="flex gap-2 pt-1">
            <Button onClick={send} disabled={busy || description.trim().length < 3} className="flex-1">
              {busy ? "Sending…" : "Send Feedback"}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
