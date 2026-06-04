import { cn } from "@/lib/utils";

const LIFEVAULT_ICON_URL = "/__l5e/assets-v1/4d3739ad-8d02-4430-b862-d0f3fe48e48d/lifevault-icon.png";

export function LifeVaultIcon({ className }: { className?: string }) {
  return (
    <img
      src={LIFEVAULT_ICON_URL}
      alt="LifeVault app icon"
      className={cn("shrink-0 rounded-[22%] object-cover", className)}
      draggable={false}
    />
  );
}