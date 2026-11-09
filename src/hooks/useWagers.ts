import { useEffect, useState } from "react";
import pb from "@/pb";

/**
 * All In wagers for a game as { teamId: amount }. The rules only return them
 * to the host, or to everyone once the reveal starts, so pass the phase as
 * `reloadKey` to refetch when that changes.
 */
export function useWagers(gameId: string | undefined, enabled: boolean, reloadKey: unknown = 0) {
  const [wagers, setWagers] = useState<Record<string, number>>({});

  useEffect(() => {
    setWagers({});
    if (!gameId || !enabled) return;
    let cancelled = false;
    let unsubscribe: (() => Promise<void>) | null = null;
    const set = (team: string, amount: number) => setWagers((prev) => ({ ...prev, [team]: amount }));

    (async () => {
      try {
        unsubscribe = await pb.collection("wagers").subscribe(
          "*",
          (e) => { if (e.record.game === gameId && e.action !== "delete") set(e.record.team, e.record.amount); },
          { filter: pb.filter("game = {:game}", { game: gameId }) }
        );
        if (cancelled) { unsubscribe?.(); return; }
        const list = await pb.collection("wagers").getFullList({ filter: pb.filter("game = {:game}", { game: gameId }) });
        if (!cancelled) for (const w of list) set(w.team, w.amount);
      } catch (err) {
        console.error("Failed to load wagers:", err);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.().catch(() => {});
    };
  }, [gameId, enabled, reloadKey]);

  return wagers;
}
