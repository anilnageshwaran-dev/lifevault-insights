import iconAsset from "@/assets/lifevault-icon.png.asset.json";
import { cn } from "@/lib/utils";

export function LifeVaultIcon({ className }: { className?: string }) {
  return (
    <img
      src={iconAsset.url}
      alt="LifeVault app icon"
      className={cn("shrink-0 rounded-[22%] object-cover", className)}
      draggable={false}
    />
  );
}