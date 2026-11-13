import { useEffect, useMemo, useRef, useState } from "react";
import pb from "@/pb";
import { currentQueue, type Buzz } from "@/lib/buzzes";

/**
 * Live buzz queue for one game and round, in server order.
 *
 * Subscribes once per game (and again when `reloadKey` changes, e.g. after a
 * reconnect) and keeps buzzes for the current/upcoming rounds; old rounds are
 * pruned when `round` advances. Changing the subscription on every round meant
 * unsubscribing and resubscribing the same topic in quick succession, which
 * could drop events.
 */
export function useBuzzes(gameId: string | undefined, round: number, reloadKey = 0) {
  const [all, setAll] = useState<Buzz[]>([]);
  const roundRef = useRef(round);
  roundRef.current = round;

  const add = (incoming: Buzz[]) =>
    setAll((prev) => {
      const byId = new Map(prev.map((x) => [x.id, x]));
      for (const x of incoming) byId.set(x.id, x);
      return [...byId.values()];
    });

  useEffect(() => {
    setAll([]);
    if (!gameId) return;
    let cancelled = false;
    let unsubscribe: (() => Promise<void>) | null = null;

    (async () => {
      unsubscribe = await pb.collection("buzzes").subscribe<Buzz>(
        "*",
        (e) => {
          if (cancelled || e.record.game !== gameId) return;
          if (e.action === "delete") setAll((prev) => prev.filter((x) => x.id !== e.record.id));
          else if (e.record.round >= roundRef.current) add([e.record]);
        },
        { filter: pb.filter("game = {:game}", { game: gameId }) }
      );
      if (cancelled) unsubscribe().catch(() => {});
    })().catch((err) => console.error("Failed to subscribe to buzzes:", err));

    return () => {
      cancelled = true;
      unsubscribe?.().catch(() => {});
    };
  }, [gameId, reloadKey]);

  // Prune older rounds when round advances, and load what's already there for
  // this round (after a reload, or a late join).
  useEffect(() => {
    setAll((prev) => {
      const filtered = prev.filter((x) => x.round >= round);
      return filtered.length === prev.length ? prev : filtered;
    });
    if (!gameId) return;
    let cancelled = false;
    pb.collection("buzzes")
      .getFullList<Buzz>({ filter: pb.filter("game = {:game} && round = {:round}", { game: gameId, round }), sort: "created,id" })
      .then((list) => { if (!cancelled) add(list); })
      .catch((err) => console.error("Failed to load buzzes:", err));
    return () => { cancelled = true; };
  }, [gameId, round, reloadKey]);

  return useMemo(() => currentQueue(all, round), [all, round]);
}
