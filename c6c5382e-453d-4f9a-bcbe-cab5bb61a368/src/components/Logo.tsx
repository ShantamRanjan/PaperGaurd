import { cn } from "@/lib/utils";

export function Logo({
  variant = "full",
  className,
  textClassName,
}: {
  variant?: "icon" | "full";
  className?: string;
  textClassName?: string;
}) {
  const icon = (
    <img
      src="/brand/paperguard-icon-512.png"
      alt={variant === "icon" ? "PaperGuard" : ""}
      className={cn("h-8 w-8 shrink-0", variant === "icon" && className)}
      width={512}
      height={512}
    />
  );
  if (variant === "icon") return icon;
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label="PaperGuard">
      {icon}
      <span
        className={cn("font-display text-xl font-extrabold", textClassName)}
        style={{ letterSpacing: "-0.035em" }}
        aria-hidden
      >
        <span className="text-wordmark-a">Paper</span>
        <span className="text-wordmark-b">Guard</span>
      </span>
    </span>
  );
}
