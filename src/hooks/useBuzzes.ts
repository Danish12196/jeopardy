import { useEffect, useState } from "react";
import pb from "@/pb";
import { currentQueue, type Buzz } from "@/lib/buzzes";

/**
 * Live buzz queue for one game and round, in server order.
 * Subscribes to `buzzes` for the game, then fetches what's already there.
 * Bump `reloadKey` to refetch and resubscribe (e.g. after a reconnect).
 */
export function useBuzzes(gameId: string | undefined, round: number, reloadKey = 0) {
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);

  useEffect(() => {
    setBuzzes([]);
    if (!gameId) return;
    let cancelled = false;
    let unsubscribe: (() => Promise<void>) | null = null;

    const add = (incoming: Buzz[]) =>
      setBuzzes((prev) => {
        const byId = new Map(prev.map((x) => [x.id, x]));
        for (const x of incoming) byId.set(x.id, x);
        return currentQueue([...byId.values()], round);
      });

    (async () => {
      try {
        unsubscribe = await pb.collection("buzzes").subscribe<Buzz>(
          "*",
          (e) => {
            if (e.record.game !== gameId || e.record.round !== round) return;
            if (e.action === "delete") setBuzzes((prev) => prev.filter((x) => x.id !== e.record.id));
            else add([e.record]);
          },
          { filter: pb.filter("game = {:game}", { game: gameId }) }
        );
        if (cancelled) { unsubscribe?.(); return; }
        const list = await pb.collection("buzzes").getFullList<Buzz>({
          filter: pb.filter("game = {:game} && round = {:round}", { game: gameId, round }),
          sort: "created,id",
        });
        if (!cancelled) add(list);
      } catch (err) {
        console.error("Failed to load buzzes:", err);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.().catch(() => {});
    };
  }, [gameId, round, reloadKey]);

  return buzzes;
}
