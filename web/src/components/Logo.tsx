import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-black tracking-tight", className)}>
      <span className="grid size-[1.4em] place-items-center rounded-full bg-primary text-primary-foreground">
        <Zap className="size-[0.8em]" fill="currentColor" aria-hidden />
      </span>
      Buzzwire
    </span>
  );
}
