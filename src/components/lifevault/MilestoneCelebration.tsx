import * as React from "react";
import confetti from "canvas-confetti";
import { X, Share2, Trophy } from "lucide-react";
import { formatINR } from "@/lib/finance-utils";
import type { MilestoneAchieved } from "@/lib/milestones";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  milestone: MilestoneAchieved | null;
  onClose: () => void;
}

export function MilestoneCelebration({ milestone, onClose }: Props) {
  const cardRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!milestone) return;
    // Fire confetti bursts
    const end = Date.now() + 1200;
    const burst = () => {
      confetti({ particleCount: 80, startVelocity: 45, spread: 60, origin: { x: 0.2, y: 0.7 } });
      confetti({ particleCount: 80, startVelocity: 45, spread: 60, origin: { x: 0.8, y: 0.7 } });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    burst();
  }, [milestone]);

  const downloadShare = async () => {
    if (!milestone) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const node = cardRef.current;
      if (!node) return;
      const canvas = await html2canvas(node, { backgroundColor: "#0A0F1E", scale: 2 });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifevault_${milestone.label.replace(/\s+/g, "_").toLowerCase()}.png`;
      a.click();
      toast.success("Image downloaded");
    } catch {
      toast.error("Couldn't generate image");
    }
  };

  if (!milestone) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative max-w-sm w-full">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-2 -right-2 z-10 p-1.5 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Shareable card */}
        <div
          ref={cardRef}
          className="rounded-3xl p-8 text-center"
          style={{
            background: "linear-gradient(180deg, #0A0F1E 0%, #1a1f3a 100%)",
            width: 320,
            maxWidth: "100%",
          }}
        >
          <div className="text-xs uppercase tracking-widest text-white/50 mb-3">LifeVault</div>
          <div className="text-7xl mb-4 leading-none">{milestone.emoji}</div>
          <div className="font-display text-2xl text-white mb-2">
            I crossed {milestone.label}!
          </div>
          <div className="text-4xl font-display tabular text-emerald-400 my-4">
            {formatINR(milestone.netWorth)}
          </div>
          <div className="text-[11px] text-white/40">
            {new Date(milestone.date).toLocaleDateString()}
          </div>
          <div className="mt-6 text-[11px] text-white/40">
            Tracked with LifeVault · lifevaultapp.lovable.app
          </div>
        </div>

        <div className="mt-4 flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={downloadShare} className="gap-2">
            <Share2 className="h-4 w-4" /> Download image
          </Button>
          <Button size="sm" onClick={onClose} className="gap-2">
            <Trophy className="h-4 w-4" /> Awesome!
          </Button>
        </div>
      </div>
    </div>
  );
}
