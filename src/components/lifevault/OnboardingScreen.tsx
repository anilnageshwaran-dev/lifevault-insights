import * as React from "react";
import { Lock, Cloud, LayoutGrid } from "lucide-react";
import { useLock } from "@/lib/lock-context";
import { LifeVaultIcon } from "./LifeVaultIcon";

const SLIDES = [
  {
    icon: Lock,
    title: "Zero-Knowledge Security",
    body:
      "Your data is encrypted with your PIN before it ever leaves your device. Not even we can read it.",
    color: "text-primary",
    bg: "bg-primary/15",
  },
  {
    icon: Cloud,
    title: "Encrypted Cloud Sync",
    body:
      "LifeVault stores an encrypted copy of your data in secure cloud storage so it follows you across devices. We can never decrypt it — only your PIN can.",
    color: "text-positive",
    bg: "bg-positive/15",
  },
  {
    icon: LayoutGrid,
    title: "Everything in One Place",
    body:
      "Track net worth, cash flow, goals, and store all your important credentials — securely.",
    color: "text-warning",
    bg: "bg-warning/15",
  },
];

export function OnboardingScreen() {
  const { completeOnboarding } = useLock();
  const [i, setI] = React.useState(0);
  const last = i === SLIDES.length - 1;
  const S = SLIDES[i];
  const Icon = S.icon;

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 py-8 bg-background overflow-x-hidden">
      <div className="w-full max-w-md text-center">
        {i === 0 ? (
          <LifeVaultIcon className="mx-auto h-24 w-24 mb-8 shadow-2xl shadow-primary/20" />
        ) : (
          <div className={`mx-auto h-24 w-24 rounded-3xl ${S.bg} flex items-center justify-center mb-8`}>
            <Icon className={`h-12 w-12 ${S.color}`} />
          </div>
        )}
        <h1 className="font-display text-3xl text-foreground">{S.title}</h1>
        <p className="text-base text-muted-foreground mt-4 leading-relaxed">{S.body}</p>

        <div className="flex justify-center gap-2 mt-10">
          {SLIDES.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-8 bg-primary" : "w-1.5 bg-foreground/15"
              }`}
            />
          ))}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={completeOnboarding}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => (last ? completeOnboarding() : setI(i + 1))}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            {last ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
