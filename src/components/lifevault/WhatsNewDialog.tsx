import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHANGELOG, APP_VERSION } from "@/lib/changelog";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsNewDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            What's new
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Currently on v{APP_VERSION} · only major changes listed
          </p>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {CHANGELOG.map((entry, i) => (
            <div key={entry.version} className="relative pl-4">
              <div
                className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${
                  i === 0 ? "bg-primary" : "bg-foreground/30"
                }`}
              />
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-medium text-sm">
                  v{entry.version}{" "}
                  <span className="text-muted-foreground font-normal">· {entry.title}</span>
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(entry.date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground list-disc list-outside ml-4">
                {entry.highlights.map((h, j) => (
                  <li key={j}>{h}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
