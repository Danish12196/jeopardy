import { useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";
import { cn } from "@/lib/utils";

type Status = "checking" | "online" | "offline";

const labels: Record<Status, string> = {
  checking: "Checking server…",
  online: "Server online",
  offline: "Server unreachable",
};

/** Calls the hello route in pb_hooks, so "online" means hooks are loaded too. */
export function ServerStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    pb.send("/api/buzzwire/hello", { signal: controller.signal, requestKey: null })
      .then(() => setStatus("online"))
      .catch(() => {
        if (!controller.signal.aborted) setStatus("offline");
      });
    return () => controller.abort();
  }, []);

  return (
    <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "checking" && "animate-pulse bg-muted-foreground",
          status === "online" && "bg-success",
          status === "offline" && "bg-destructive",
        )}
      />
      {labels[status]}
    </p>
  );
}
