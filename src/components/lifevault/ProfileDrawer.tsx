import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useLock } from "@/lib/lock-context";
import { Settings as SettingsIcon, Sun, Moon, Lock, User as UserIcon, LogOut } from "lucide-react";
import { LifeVaultIcon } from "./LifeVaultIcon";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}

export function ProfileDrawer({ open, onOpenChange, onOpenSettings }: Props) {
  const { user, signOut } = useAuth();
  const { resolved, setMode } = useTheme();
  const { lock } = useLock();

  const name =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    "Signed in";
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const initials = (name || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const toggleTheme = () => setMode(resolved === "dark" ? "light" : "dark");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 flex flex-col w-[88vw] max-w-sm">
        <SheetHeader className="p-5 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <LifeVaultIcon className="h-10 w-10" />
            <SheetTitle className="font-display text-lg">LifeVault</SheetTitle>
          </div>
        </SheetHeader>

        <div className="p-5 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={name} className="h-14 w-14 rounded-full object-cover border border-border" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-primary/15 text-foreground flex items-center justify-center font-display text-lg">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium truncate">{name}</div>
              {user?.email && user.email !== name && (
                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-2 text-sm">
            <Row label="Email" value={user?.email ?? "—"} />
            <Row
              label="Signed in with"
              value={
                ((user?.app_metadata as { provider?: string } | undefined)?.provider ??
                  user?.identities?.[0]?.provider ??
                  "email")
              }
            />
            {user?.created_at && (
              <Row label="Member since" value={new Date(user.created_at).toLocaleDateString()} />
            )}
          </div>

          <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
            More profile fields (display name, photo) can be edited from Settings.
          </p>
        </div>

        <div className="border-t border-border p-3 grid grid-cols-2 gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
          >
            {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {resolved === "dark" ? "Light" : "Dark"}
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              onOpenSettings();
            }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
          >
            <SettingsIcon className="h-4 w-4" /> Settings
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              lock();
            }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
          >
            <Lock className="h-4 w-4" /> Lock
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              void signOut();
            }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}
