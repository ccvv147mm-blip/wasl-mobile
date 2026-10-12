import { BadgeCheck } from "lucide-react";

export function VerifiedBadge({ show, className = "h-4 w-4" }: { show?: boolean | null; className?: string }) {
  if (!show) return null;
  return (
    <BadgeCheck
      aria-label="حساب موثّق"
      className={`inline-block shrink-0 fill-primary text-primary-foreground ${className}`}
    />
  );
}
