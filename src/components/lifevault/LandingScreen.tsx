import * as React from "react";
import {
  ArrowRight, Lock, Shield, Server, Eye, Check, X, PlusCircle,
  BarChart3, Wallet, Target, HeartPulse, KeyRound, Menu, Star,
} from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { LifeVaultIcon } from "./LifeVaultIcon";

/* ------------------------------------------------------------------ */
/*  Google logo (coloured)                                            */
/* ------------------------------------------------------------------ */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.3 0-11.5-5.2-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.1 0 9.7-1.7 13.3-4.7l-6.2-5c-1.9 1.3-4.3 2.2-7.1 2.2-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.5 39 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5c-.4.4 6.7-4.9 6.7-14.6 0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Reveal-on-scroll wrapper                                          */
/* ------------------------------------------------------------------ */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 700ms ease ${delay}ms, transform 700ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated counter                                                  */
/* ------------------------------------------------------------------ */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setV(Math.round(to * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString()}{suffix}</span>;
}

/* ------------------------------------------------------------------ */
/*  Feedback form                                                     */
/* ------------------------------------------------------------------ */
function FeedbackForm() {
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [name, setName] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { toast.error("Please pick a star rating"); return; }
    if (!comment.trim()) { toast.error("Please add a short comment"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("landing_feedback").insert({
      rating,
      name: name.trim() || null,
      comment: comment.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error(error.message || "Could not submit feedback"); return; }
    setSubmitted(true);
    toast.success("Thanks for the feedback!");
  };

  if (submitted) {
    return (
      <div className="lv-card rounded-2xl bg-[#141417] border border-[#27272A] p-8 text-center">
        <div className="text-3xl mb-2">🙏</div>
        <div className="lv-display text-xl font-semibold text-[#F5F5F7]">Thank you!</div>
        <p className="text-[15px] text-[#9CA3AF] mt-2">Your feedback helps us make LifeVault better.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="lv-card rounded-2xl bg-[#141417] border border-[#27272A] p-6 sm:p-8 space-y-5">
      <div>
        <label className="block text-sm font-medium text-[#F5F5F7] mb-2">Your rating</label>
        <div className="flex gap-1.5">
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} star${n>1?"s":""}`}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star className={`h-8 w-8 ${(hover || rating) >= n ? "fill-[#FBBF24] text-[#FBBF24]" : "text-[#3F3F46]"}`} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#F5F5F7] mb-2">Name <span className="text-[#71717A] font-normal">(optional)</span></label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Your name"
          className="w-full rounded-xl bg-[#0A0A0C] border border-[#27272A] text-[#F5F5F7] placeholder:text-[#52525B] px-4 py-3 focus:outline-none focus:border-[#6366F1]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#F5F5F7] mb-2">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Tell us what you love or what could be better…"
          className="w-full rounded-xl bg-[#0A0A0C] border border-[#27272A] text-[#F5F5F7] placeholder:text-[#52525B] px-4 py-3 focus:outline-none focus:border-[#6366F1] resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-3.5 transition-all hover:scale-[1.02] disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit feedback"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Sign-in modal                                                     */
/* ------------------------------------------------------------------ */
function SignInModal({ open, onClose, onEmail }: { open: boolean; onClose: () => void; onEmail: () => void }) {
  const [busy, setBusy] = React.useState(false);
  if (!open) return null;
  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) { toast.error(result.error.message || "Google sign-in failed"); setBusy(false); }
    } catch (e) {
      toast.error((e as Error).message || "Google sign-in failed");
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-[440px] rounded-3xl bg-[#141417] p-8 sm:p-12 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#0A0A0C] transition-colors" aria-label="Close">
          <X className="h-5 w-5 text-[#9CA3AF]" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-8">
          <LifeVaultIcon className="h-8 w-8" />
          <span style={{ fontFamily: "Playfair Display, serif" }} className="text-xl font-semibold text-[#F5F5F7]">LifeVault</span>
        </div>

        <h2 style={{ fontFamily: "Playfair Display, serif" }} className="text-[28px] font-bold text-[#F5F5F7] text-center leading-tight">
          Welcome to LifeVault
        </h2>
        <p className="text-[15px] text-[#9CA3AF] text-center mt-3 mb-8 leading-relaxed">
          Sign in securely with your Google account. No password needed.
        </p>

        <button
          onClick={google}
          disabled={busy}
          className="w-full h-[52px] inline-flex items-center justify-center gap-3 rounded-full border-[1.5px] border-[#27272A] bg-[#141417] text-[#F5F5F7] text-base font-medium hover:bg-[#0A0A0C] hover:shadow-sm transition-all disabled:opacity-60"
        >
          <GoogleIcon className="h-5 w-5" />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[#27272A]" />
          <span className="text-xs text-[#71717A] uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-[#27272A]" />
        </div>

        <button
          onClick={() => { onClose(); onEmail(); }}
          className="w-full text-sm text-[#6366F1] hover:text-[#4F46E5] font-medium transition-colors"
        >
          Use email instead
        </button>

        <div className="mt-8 space-y-3">
          {[
            { icon: GoogleIcon, text: "Sign in with Google" },
            { icon: Lock, text: "Create your 4-digit PIN" },
            { icon: BarChart3, text: "Start tracking" },
          ].map((s, i) => {
            const Ico = s.icon as any;
            return (
              <div key={i} className="flex items-center gap-3 text-[13px] text-[#9CA3AF]">
                <div className="h-6 w-6 rounded-full bg-[#0A0A0C] flex items-center justify-center shrink-0">
                  <Ico className="h-3.5 w-3.5 text-[#6366F1]" />
                </div>
                <span><span className="text-[#71717A] font-medium">Step {i+1}:</span> {s.text}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-[#1F1F22] text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs text-[#71717A]">
            <Lock className="h-3 w-3" /> Your financial data is encrypted with your PIN. We cannot access it.
          </p>
          <p className="text-xs text-[#71717A] mt-3">
            By continuing you agree to our{" "}
            <a href="/privacy" className="text-[#6366F1] hover:underline">Privacy Policy</a> and{" "}
            <a href="/privacy" className="text-[#6366F1] hover:underline">Terms</a>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero mockup (HTML/CSS, no screenshot needed)                      */
/* ------------------------------------------------------------------ */
function HeroMockup() {
  return (
    <div className="relative mx-auto max-w-[920px]" style={{ perspective: "1200px" }}>
      <div
        className="rounded-2xl overflow-hidden border border-[#27272A] bg-[#0A0F1E]"
        style={{
          transform: "rotateX(4deg)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* fake browser chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 bg-[#11172A] border-b border-white/5">
          <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <div className="h-3 w-3 rounded-full bg-[#28C840]" />
          <div className="ml-4 text-[11px] text-white/40">lifevaultapp.lovable.app</div>
        </div>
        {/* fake app */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/50">Net Worth</div>
              <div className="text-3xl sm:text-4xl font-semibold text-[#10B981] mt-1" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "Plus Jakarta Sans" }}>
                ₹24,50,000
              </div>
              <div className="text-xs text-white/40 mt-1">+ ₹1,12,400 this month</div>
            </div>
            <div className="hidden sm:flex flex-col items-end text-right">
              <div className="text-[11px] text-white/40">Health Score</div>
              <div className="text-2xl font-semibold text-white" style={{ fontVariantNumeric: "tabular-nums" }}>8.2<span className="text-sm text-white/40">/10</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              ["Income", "₹1,80,000", "#10B981"],
              ["Expense", "₹84,200", "#F87171"],
              ["Savings", "53%", "#6366F1"],
              ["Runway", "11 mo", "#FBBF24"],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-xl bg-[#141417]/5 border border-white/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/50">{l}</div>
                <div className="text-base font-semibold mt-1" style={{ color: c as string, fontVariantNumeric: "tabular-nums" }}>{v}</div>
              </div>
            ))}
          </div>
          {/* sparkline */}
          <div className="rounded-xl bg-[#141417]/5 border border-white/10 p-4 mb-5">
            <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">12-month trend</div>
            <svg viewBox="0 0 300 60" className="w-full h-14">
              <defs>
                <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 45 L25 40 L50 42 L75 35 L100 32 L125 28 L150 25 L175 22 L200 18 L225 14 L250 11 L275 8 L300 5 L300 60 L0 60 Z" fill="url(#g)" />
              <path d="M0 45 L25 40 L50 42 L75 35 L100 32 L125 28 L150 25 L175 22 L200 18 L225 14 L250 11 L275 8 L300 5" fill="none" stroke="#6366F1" strokeWidth="2" />
            </svg>
          </div>
          <div className="space-y-3">
            {[
              ["Emergency Fund", 78, "#10B981"],
              ["Home Down Payment", 42, "#6366F1"],
              ["Retirement", 18, "#FBBF24"],
            ].map(([n, p, c]) => (
              <div key={n as string}>
                <div className="flex justify-between text-xs text-white/70 mb-1.5">
                  <span>{n}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{p}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#141417]/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${p}%`, background: c as string }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main landing                                                      */
/* ------------------------------------------------------------------ */
export function LandingScreen({ onUseEmail }: { onUseEmail: () => void }) {
  const [signInOpen, setSignInOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [userCount, setUserCount] = React.useState<number | null>(null);
  const [activeTab, setActiveTab] = React.useState(0);

  React.useEffect(() => {
    (async () => {
      try {
        const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
        if (typeof count === "number" && count > 0) {
          setUserCount(Math.max(100, Math.floor(count / 100) * 100));
        }
      } catch {}
    })();
  }, []);

  const openSignIn = () => setSignInOpen(true);
  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navLinks = [
    { label: "Features", id: "features" },
    { label: "Security", id: "security" },
    { label: "How it Works", id: "how-it-works" },
    { label: "What's New", id: "whats-new", href: "/whats-new" },
  ];

  return (
    <div className="min-h-screen bg-[#141417] text-[#F5F5F7]" style={{ fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
        .lv-display { font-family: "Playfair Display", Georgia, serif; letter-spacing: -0.02em; }
        .lv-fade-up { animation: lvFadeUp 700ms ease both; }
        @keyframes lvFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .lv-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.08); }
        .lv-card { transition: all 300ms ease; }
      `}</style>

      {/* ============ NAV ============ */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#141417]/80 border-b border-[#27272A]">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between">
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center gap-2">
            <LifeVaultIcon className="h-6 w-6" />
            <span className="lv-display text-[20px] font-semibold text-[#F5F5F7]">LifeVault</span>
          </a>
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => (
              l.href ? (
                <a key={l.label} href={l.href} className="text-[14px] font-medium text-[#F5F5F7]/80 hover:text-[#F5F5F7] transition-colors">{l.label}</a>
              ) : (
                <button key={l.label} onClick={() => scrollTo(l.id)} className="text-[14px] font-medium text-[#F5F5F7]/80 hover:text-[#F5F5F7] transition-colors">
                  {l.label}
                </button>
              )
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={openSignIn} className="text-[14px] font-medium text-[#F5F5F7] hover:text-[#6366F1] transition-colors px-3 py-2">Sign in</button>
            <button onClick={openSignIn} className="inline-flex items-center gap-1.5 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-[14px] font-semibold px-5 py-2.5 transition-all hover:scale-[1.02]">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-[#27272A] bg-[#141417] p-4 space-y-3">
            {navLinks.map((l) => (
              l.href ? (
                <a key={l.label} href={l.href} className="block text-[15px] py-1.5">{l.label}</a>
              ) : (
                <button key={l.label} onClick={() => scrollTo(l.id)} className="block text-[15px] py-1.5 text-left w-full">{l.label}</button>
              )
            ))}
            <div className="pt-3 border-t border-[#27272A] flex flex-col gap-2">
              <button onClick={openSignIn} className="w-full text-center py-2.5 rounded-full border border-[#27272A] text-[15px] font-medium">Sign in</button>
              <button onClick={openSignIn} className="w-full text-center py-2.5 rounded-full bg-[#6366F1] text-white text-[15px] font-semibold">Get Started Free</button>
            </div>
          </div>
        )}
      </nav>

      {/* ============ HERO ============ */}
      <section id="top" className="relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-[860px] mx-auto px-6 pt-20 pb-16 sm:pt-32 sm:pb-24 text-center">
          <div className="lv-fade-up inline-flex items-center gap-2 rounded-full bg-[#F0F0FF] border border-[#E0E0FF] px-3.5 py-1.5 mb-8" style={{ animationDelay: "100ms" }}>
            <Lock className="h-3.5 w-3.5 text-[#6366F1]" />
            <span className="text-[13px] font-medium text-[#6366F1]">Zero-Knowledge Encryption</span>
          </div>

          <h1 className="lv-display lv-fade-up text-[40px] sm:text-[56px] md:text-[72px] font-bold text-[#F5F5F7] leading-[1.05]" style={{ animationDelay: "200ms" }}>
            Your Financial Life,<br />
            <span className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">Beautifully Secured.</span>
          </h1>

          <p className="lv-fade-up mt-6 text-[17px] sm:text-[21px] text-[#9CA3AF] max-w-[560px] mx-auto leading-relaxed" style={{ animationDelay: "300ms" }}>
            Track your net worth, manage cash flow, plan your goals, and store every important credential — all encrypted with your PIN. Free, forever.
          </p>

          <div className="lv-fade-up mt-10 flex flex-col sm:flex-row items-center justify-center gap-4" style={{ animationDelay: "400ms" }}>
            <button onClick={openSignIn} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-base font-semibold px-8 py-4 transition-all hover:scale-[1.02] shadow-lg shadow-[#6366F1]/20">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => scrollTo("how-it-works")} className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-transparent border-[1.5px] border-[#27272A] text-[#F5F5F7] text-base font-medium px-8 py-4 hover:bg-[#0A0A0C] transition-all">
              See How It Works
            </button>
          </div>

          <p className="lv-fade-up mt-12 text-sm text-[#71717A]" style={{ animationDelay: "500ms" }}>
            Trusted by {userCount ? <strong className="text-[#F5F5F7]" style={{ fontVariantNumeric: "tabular-nums" }}>{userCount.toLocaleString()}+</strong> : "1,000+"} people across India and worldwide 🇮🇳
          </p>

          <div className="lv-fade-up mt-16" style={{ animationDelay: "600ms" }}>
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ============ STATS BAR ============ */}
      <section className="bg-[#0A0A0C] py-12">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { num: "100%", label: "Free Forever", sub: "No hidden charges ever" },
            { num: "17", label: "Vault Categories", sub: "Everything in one place" },
            { num: "AES-256", label: "Encryption Standard", sub: "Military-grade security" },
            { num: "0", label: "Data We Can Read", sub: "Zero-knowledge architecture" },
          ].map((s) => (
            <Reveal key={s.label} className="text-center">
              <div className="lv-display text-3xl sm:text-4xl font-bold text-[#6366F1]" style={{ fontVariantNumeric: "tabular-nums" }}>{s.num}</div>
              <div className="mt-2 text-sm font-semibold text-[#F5F5F7]">{s.label}</div>
              <div className="mt-1 text-xs text-[#71717A]">{s.sub}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ SECURITY ============ */}
      <section id="security" className="bg-[#141417] py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-semibold tracking-[0.1em] text-[#6366F1] uppercase mb-4">Security First</div>
            <h2 className="lv-display text-[32px] sm:text-[52px] font-bold text-[#F5F5F7] leading-[1.1]">
              Built for privacy.<br />Designed for trust.
            </h2>
            <p className="mt-6 text-[17px] sm:text-[19px] text-[#9CA3AF] leading-relaxed">
              Your data never leaves your device unencrypted. We built LifeVault so that even we cannot read your financial information.
            </p>
          </Reveal>

          {/* encryption flow */}
          <Reveal className="mb-16">
            <div className="rounded-3xl bg-[#0A0A0C] p-6 sm:p-10">
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                {[
                  { l: "Your PIN", c: "#6366F1" },
                  { l: "PBKDF2 Key Derivation", c: "#6366F1" },
                  { l: "AES-256-GCM", c: "#6366F1" },
                  { l: "Encrypted Blob", c: "#6366F1" },
                  { l: "Cloud Storage", c: "#86868B" },
                ].map((step, i) => (
                  <React.Fragment key={step.l}>
                    <div className="rounded-xl bg-[#141417] border border-[#27272A] px-4 py-3 text-sm font-medium" style={{ color: step.c }}>
                      {step.l}
                    </div>
                    {i < 4 && <ArrowRight className="h-4 w-4 text-[#71717A] hidden sm:block" />}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-center text-sm text-[#9CA3AF] mt-6">
                Happens entirely in your browser. We only ever receive encrypted data.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { icon: Lock, title: "Zero-Knowledge", body: "Your PIN is the only key. We derive an AES-256-GCM encryption key from it using PBKDF2 with 310,000 iterations. Your plaintext data never reaches our servers." },
              { icon: Server, title: "Isolated Storage", body: "Each user's encrypted vault is stored in a completely separate path. Row-level security at the database layer ensures no user can ever access another's data." },
              { icon: Eye, title: "No Data Selling", body: "LifeVault has no advertising model. We don't sell, share, or analyse your financial data. Your information is exclusively yours." },
              { icon: KeyRound, title: "PIN Recovery Warning", body: "By design, we cannot recover your PIN. This means even under legal pressure, we cannot expose your data. Keep your PIN safe." },
            ].map((c, i) => {
              const Ico = c.icon;
              return (
                <Reveal key={c.title} delay={i * 80}>
                  <div className="lv-card rounded-2xl border border-[#27272A] bg-[#141417] p-8 h-full">
                    <div className="h-11 w-11 rounded-xl bg-[#F0F0FF] flex items-center justify-center mb-5">
                      <Ico className="h-5 w-5 text-[#6366F1]" />
                    </div>
                    <h3 className="lv-display text-xl font-semibold mb-3 text-[#F5F5F7]">{c.title}</h3>
                    <p className="text-[15px] text-[#9CA3AF] leading-relaxed">{c.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-12 flex flex-wrap justify-center gap-3">
            {["AES-256-GCM Encrypted", "Security Audited", "Open Source Encryption"].map((b) => (
              <div key={b} className="inline-flex items-center gap-1.5 rounded-full bg-[#0A0A0C] text-[#9CA3AF] text-xs font-medium px-3.5 py-1.5">
                <Check className="h-3 w-3 text-[#10B981]" /> {b}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="bg-[#0A0A0C] py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-semibold tracking-[0.1em] text-[#10B981] uppercase mb-4">All in one place</div>
            <h2 className="lv-display text-[32px] sm:text-[52px] font-bold text-[#F5F5F7] leading-[1.1]">
              Everything about your<br />money. Finally together.
            </h2>
            <p className="mt-6 text-[17px] sm:text-[19px] text-[#9CA3AF] leading-relaxed">
              From tracking a ₹500 SIP to storing your passport number — LifeVault is the only app you need for your complete financial life.
            </p>
          </Reveal>

          <div className="flex gap-2 overflow-x-auto pb-3 mb-8 -mx-6 px-6 sm:justify-center scrollbar-hide">
            {[
              { icon: Wallet, label: "Net Worth" },
              { icon: BarChart3, label: "Cash Flow" },
              { icon: Target, label: "Goals" },
              { icon: HeartPulse, label: "Essentials" },
              { icon: Lock, label: "Vault" },
            ].map((t, i) => {
              const Ico = t.icon;
              return (
                <button
                  key={t.label}
                  onClick={() => setActiveTab(i)}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                    activeTab === i ? "bg-[#6366F1] text-white" : "bg-[#141417] text-[#9CA3AF] border border-[#27272A] hover:text-[#F5F5F7]"
                  }`}
                >
                  <Ico className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>

          <Reveal>
            <FeatureShowcase index={activeTab} />
          </Reveal>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className="bg-[#141417] py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-semibold tracking-[0.1em] text-[#10B981] uppercase mb-4">Pricing</div>
            <h2 className="lv-display text-[32px] sm:text-[52px] font-bold text-[#F5F5F7] leading-[1.1]">
              Completely free.<br />No catch. No asterisk.
            </h2>
            <p className="mt-6 text-[17px] sm:text-[19px] text-[#9CA3AF] leading-relaxed">
              We believe everyone deserves access to premium financial tools. LifeVault is 100% free forever — no premium tier, no ads, no data selling.
            </p>
          </Reveal>

          <Reveal className="max-w-[480px] mx-auto">
            <div
              className="rounded-3xl border-2 border-[#6366F1] bg-[#141417] p-10 sm:p-12 relative"
              style={{ boxShadow: "0 0 0 1px rgba(99,102,241,0.1), 0 24px 48px rgba(99,102,241,0.12)" }}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-[#6366F1] text-white text-xs font-semibold px-4 py-1.5 uppercase tracking-wider">
                Always Free
              </div>
              <div className="text-center mt-4 mb-8">
                <div className="lv-display text-[80px] font-bold text-[#6366F1] leading-none">₹0</div>
                <div className="text-[#9CA3AF] text-sm mt-2">per month, forever</div>
              </div>
              <div className="h-px bg-[#27272A] mb-6" />
              <ul className="space-y-3">
                {[
                  "All 6 dashboard views", "Unlimited assets & liabilities", "Unlimited transactions",
                  "17 encrypted vault categories", "Unlimited goals", "Family member access",
                  "PDF report generation", "Bank statement import", "Broker portfolio import",
                  "Cloud sync across devices", "PWA — install on any device", "Export your data anytime",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[15px] text-[#F5F5F7]">
                    <Check className="h-4 w-4 text-[#10B981] mt-0.5 shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[#71717A] mt-6 leading-relaxed">
                Storage powered by Supabase cloud. Your encrypted data is hosted securely and privately.
              </p>
              <button onClick={openSignIn} className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-3.5 transition-all hover:scale-[1.02]">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </Reveal>

        </div>
      </section>

      {/* ============ MADE FOR INDIA ============ */}
      <section className="bg-[#0A0A0C] py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-semibold tracking-[0.1em] text-[#6366F1] uppercase mb-4">Made for India 🇮🇳</div>
            <h2 className="lv-display text-[32px] sm:text-[52px] font-bold text-[#F5F5F7] leading-[1.1]">
              Built for the way<br />Indians manage money.
            </h2>
            <p className="mt-6 text-[17px] sm:text-[19px] text-[#9CA3AF] leading-relaxed">
              From SIPs and PPF to gold and FDs — LifeVault speaks your financial language. Indian number format, ₹ symbol, and every asset class Indians actually invest in.
            </p>
          </Reveal>

          <Reveal className="overflow-x-auto pb-4 mb-12 -mx-6 px-6">
            <div className="flex gap-2 min-w-max">
              {["Equity MF","Direct Stocks","ETF","NPS","PPF","EPF","FD","RD","SGB","Physical Gold","Gold ETF","Real Estate","NSC","KVP","Sukanya Samriddhi","RBI Bonds","P2P Lending","ULIPs","ESOP","Crypto","PMS","AIF"].map(c => (
                <div key={c} className="shrink-0 inline-flex items-center rounded-full bg-[#141417] border border-[#27272A] text-[#9CA3AF] text-sm px-4 py-2">{c}</div>
              ))}
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: "🏦", title: "Indian Number Format", body: "₹1,00,000 not ₹100,000. Lakhs and crores displayed the way Indians read them." },
              { icon: "📊", title: "FIRE for India", body: "Your FIRE number calculated for Indian inflation rates, lifestyle costs, and Indian investment return expectations." },
              { icon: "🔄", title: "Zerodha & Groww Import", body: "Import your entire portfolio from Zerodha, Groww, HDFC Securities, Upstox and more with one CSV upload." },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 80}>
                <div className="lv-card rounded-2xl bg-[#141417] border border-[#27272A] p-8 h-full">
                  <div className="text-3xl mb-4">{c.icon}</div>
                  <h3 className="lv-display text-xl font-semibold text-[#F5F5F7] mb-3">{c.title}</h3>
                  <p className="text-[15px] text-[#9CA3AF] leading-relaxed">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="bg-[#141417] py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center mb-16">
            <h2 className="lv-display text-[32px] sm:text-[52px] font-bold text-[#F5F5F7] leading-[1.1]">
              Up and running in minutes.
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {[
              { n: "01", icon: <GoogleIcon className="h-6 w-6" />, title: "Sign in with Google", body: "One click. No password to remember. Your Google account is just for identity — we don't access your Drive or Gmail." },
              { n: "02", icon: <Lock className="h-6 w-6 text-[#6366F1]" />, title: "Create your PIN", body: "Set a 4-digit PIN. This becomes your encryption key. We never store it — only you know it." },
              { n: "03", icon: <PlusCircle className="h-6 w-6 text-[#10B981]" />, title: "Add your finances", body: "Add bank accounts, investments, assets, and goals. Import from Zerodha or upload bank statements." },
              { n: "04", icon: <BarChart3 className="h-6 w-6 text-[#6366F1]" />, title: "See the full picture", body: "Your complete financial life in one beautiful, encrypted dashboard. Access from any device, any time." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="relative">
                  <div className="lv-display text-5xl font-bold text-[#6366F1]/15 mb-3" style={{ fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                  <div className="h-12 w-12 rounded-xl bg-[#0A0A0C] flex items-center justify-center mb-4">{s.icon}</div>
                  <h3 className="lv-display text-xl font-semibold text-[#F5F5F7] mb-2">{s.title}</h3>
                  <p className="text-[15px] text-[#9CA3AF] leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-16 text-center">
            <p className="text-[#9CA3AF] mb-4">Ready to get started?</p>
            <button onClick={openSignIn} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-8 py-4 transition-all hover:scale-[1.02] shadow-lg shadow-[#6366F1]/20">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ============ FEEDBACK ============ */}
      <section className="bg-[#0A0A0C] py-24 sm:py-32">
        <div className="max-w-2xl mx-auto px-6">
          <Reveal className="text-center mb-10">
            <h2 className="lv-display text-[32px] sm:text-[52px] font-bold text-[#F5F5F7] leading-[1.1]">
              Share your feedback.
            </h2>
            <p className="mt-4 text-[17px] text-[#9CA3AF] leading-relaxed">
              Rate your experience and tell us what we can improve.
            </p>
          </Reveal>
          <Reveal>
            <FeedbackForm />
          </Reveal>
        </div>
      </section>



      {/* ============ FINAL CTA ============ */}
      <section className="bg-[#000000] py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <h2 className="lv-display text-[36px] sm:text-[56px] font-bold text-white leading-[1.1]">
              Your financial life deserves<br />better than a spreadsheet.
            </h2>
            <p className="mt-6 text-[17px] sm:text-[19px] text-white/70 leading-relaxed max-w-xl mx-auto">
              Join thousands of people who track their complete financial picture with LifeVault — free, encrypted, and beautifully simple.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={openSignIn} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#141417] text-[#F5F5F7] font-semibold px-8 py-4 hover:scale-[1.02] transition-all">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => scrollTo("security")} className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-white/30 text-white font-medium px-8 py-4 hover:bg-[#141417]/5 transition-all">
                View Security Details
              </button>
            </div>
            <p className="mt-8 text-sm text-white/50">
              🔒 No credit card · No subscription · Cancel anytime · Your data, always
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-[#000000] border-t border-white/10 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <LifeVaultIcon className="h-6 w-6" />
                <span className="lv-display text-lg font-semibold text-white">LifeVault</span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">Your complete financial life, beautifully secured.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li><button onClick={() => scrollTo("features")} className="hover:text-white transition-colors">Features</button></li>
                <li><button onClick={() => scrollTo("security")} className="hover:text-white transition-colors">Security</button></li>
                <li><button onClick={() => scrollTo("how-it-works")} className="hover:text-white transition-colors">How It Works</button></li>
                <li><a href="/whats-new" className="hover:text-white transition-colors">What's New</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/privacy" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Built with</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li>❤️ and React in India 🇮🇳</li>
                <li>Powered by Supabase + Lovable</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-white/10 text-xs text-white/40">
            © {new Date().getFullYear()} LifeVault. All rights reserved.
          </div>
        </div>
      </footer>

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} onEmail={onUseEmail} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature showcase tabs                                             */
/* ------------------------------------------------------------------ */
function FeatureShowcase({ index }: { index: number }) {
  const data = [
    {
      heading: "Know your true net worth",
      body: "Track every asset — stocks, mutual funds, FDs, gold, real estate, crypto — and every liability. Watch your wealth grow over time with historical snapshots.",
      feats: ["40+ asset types supported", "Multi-currency with live FX rates", "Rebalancing alerts", "Net worth milestones & celebrations", "Zerodha & Groww import"],
      visual: (
        <div className="rounded-2xl bg-[#141417] border border-[#27272A] p-6">
          <div className="text-xs uppercase tracking-wider text-[#71717A]">Total Net Worth</div>
          <div className="lv-display text-3xl font-bold text-[#10B981] mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>₹24,50,000</div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-lg bg-[#0A0A0C] p-3"><div className="text-xs text-[#71717A]">Assets</div><div className="font-semibold text-[#F5F5F7]" style={{ fontVariantNumeric: "tabular-nums" }}>₹28,00,000</div></div>
            <div className="rounded-lg bg-[#0A0A0C] p-3"><div className="text-xs text-[#71717A]">Liabilities</div><div className="font-semibold text-[#F5F5F7]" style={{ fontVariantNumeric: "tabular-nums" }}>₹3,50,000</div></div>
          </div>
          <div className="mt-5 flex justify-center">
            <svg viewBox="0 0 120 120" className="w-32 h-32">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#F5F5F7" strokeWidth="14"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#6366F1" strokeWidth="14" strokeDasharray={`${0.65*314} 314`} transform="rotate(-90 60 60)"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#10B981" strokeWidth="14" strokeDasharray={`${0.25*314} 314`} strokeDashoffset={`${-0.65*314}`} transform="rotate(-90 60 60)"/>
            </svg>
          </div>
        </div>
      ),
    },
    {
      heading: "Master your money flow",
      body: "Log income, track expenses, set budgets, and import bank statements automatically. Know exactly where every rupee goes.",
      feats: ["Bank statement auto-import", "Smart expense categorisation", "Budget guardrails with alerts", "Recurring bills tracker", "Spending analytics & trends"],
      visual: (
        <div className="rounded-2xl bg-[#141417] border border-[#27272A] p-6 space-y-3">
          {[
            ["Salary credit","HDFC Bank","+₹1,20,000","#10B981"],
            ["Swiggy","Food","-₹420","#1D1D1F"],
            ["Electricity bill","Utilities","-₹2,140","#1D1D1F"],
            ["Rent","Housing","-₹35,000","#1D1D1F"],
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div><div className="font-medium text-[#F5F5F7]">{r[0]}</div><div className="text-xs text-[#71717A]">{r[1]}</div></div>
              <div className="font-semibold" style={{ color: r[3] as string, fontVariantNumeric: "tabular-nums" }}>{r[2]}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      heading: "Plan for what matters",
      body: "Set inflation-adjusted goals for home, education, retirement, or anything else. Know exactly how much to save every month.",
      feats: ["Inflation adjustment engine", "SIP calculator built-in", "Goal-to-asset linking", "Monthly SIP required computation", "Visual progress tracking"],
      visual: (
        <div className="rounded-2xl bg-[#141417] border border-[#27272A] p-6">
          <div className="text-xs uppercase tracking-wider text-[#71717A]">Home Down Payment</div>
          <div className="lv-display text-2xl font-bold text-[#F5F5F7] mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>₹12,00,000</div>
          <div className="text-xs text-[#71717A] mt-1">of ₹28,00,000 target</div>
          <div className="mt-4 h-2 rounded-full bg-[#0A0A0C] overflow-hidden">
            <div className="h-full rounded-full bg-[#6366F1]" style={{ width: "42%" }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-[#0A0A0C] p-3"><div className="text-xs text-[#71717A]">Monthly SIP</div><div className="font-semibold text-[#6366F1]" style={{ fontVariantNumeric: "tabular-nums" }}>₹42,000</div></div>
            <div className="rounded-lg bg-[#0A0A0C] p-3"><div className="text-xs text-[#71717A]">Time left</div><div className="font-semibold text-[#F5F5F7]">3.5 yrs</div></div>
          </div>
        </div>
      ),
    },
    {
      heading: "Your financial health check",
      body: "Emergency fund runway, term insurance gap, health cover analysis, and your personalised FIRE number. All in one score.",
      feats: ["Emergency fund tracker", "Insurance gap calculator", "FIRE number & timeline", "Overall health score out of 10", "Actionable recommendations"],
      visual: (
        <div className="rounded-2xl bg-[#141417] border border-[#27272A] p-6 flex flex-col items-center">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#F5F5F7" strokeWidth="12"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#10B981" strokeWidth="12" strokeDasharray={`${0.82*314} 314`} strokeLinecap="round"/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="lv-display text-4xl font-bold text-[#F5F5F7]" style={{ fontVariantNumeric: "tabular-nums" }}>8.2</div>
              <div className="text-xs text-[#71717A]">/ 10</div>
            </div>
          </div>
          <div className="mt-4 text-sm font-semibold text-[#10B981]">Excellent health</div>
        </div>
      ),
    },
    {
      heading: "Your digital safety deposit box",
      body: "Store every important credential, document, and record — all encrypted. Bank details, passwords, insurance policies, nominees, and more.",
      feats: ["17 encrypted categories", "Password health checker", "Document expiry alerts", "Emergency family page", "Nominee summary view"],
      visual: (
        <div className="rounded-2xl bg-[#141417] border border-[#27272A] p-6">
          <div className="grid grid-cols-3 gap-3">
            {[["🏦","Bank"],["💳","Cards"],["🔑","Passwords"],["🛡️","Insurance"],["📄","Documents"],["👨‍👩‍👧","Family"]].map(([i,l]) => (
              <div key={l} className="rounded-xl bg-[#0A0A0C] p-4 text-center">
                <div className="text-2xl mb-1">{i}</div>
                <div className="text-xs font-medium text-[#F5F5F7]">{l}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const t = data[index];
  return (
    <div key={index} className="grid md:grid-cols-2 gap-10 items-center lv-fade-up">
      <div>
        <h3 className="lv-display text-3xl sm:text-4xl font-bold text-[#F5F5F7] leading-tight">{t.heading}</h3>
        <p className="mt-4 text-[16px] text-[#9CA3AF] leading-relaxed">{t.body}</p>
        <ul className="mt-6 space-y-2.5">
          {t.feats.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[15px] text-[#F5F5F7]">
              <Check className="h-4 w-4 text-[#10B981] mt-0.5 shrink-0" /> <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>{t.visual}</div>
    </div>
  );
}
