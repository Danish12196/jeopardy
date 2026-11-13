import { useEffect, useRef } from "react";
import pb from "@/pb";
import type { GameRecord } from "@/lib/pbTypes";

/**
 * Subscribes to one game record and calls `onRecord` with every update.
 * After (re)subscribing it also fetches the record once, so nothing sent
 * while the page was away is missed. Bump `reloadKey` to redo both.
 *
 * Uses the listener-specific unsubscribe, not unsubscribe(topic): the latter
 * removes every listener on the topic and can race a fresh subscription.
 */
export function useGameSubscription(
  gameId: string | null | undefined,
  reloadKey: number,
  onRecord: (g: GameRecord) => void
) {
  const cb = useRef(onRecord);
  useEffect(() => {
    cb.current = onRecord;
  });

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    let unsubscribe: (() => Promise<void>) | null = null;

    (async () => {
      unsubscribe = await pb.collection("games").subscribe<GameRecord>(gameId, (e) => {
        if (!cancelled) cb.current(e.record);
      });
      if (cancelled) {
        unsubscribe().catch(() => {});
        return;
      }
      const rec = await pb.collection("games").getOne<GameRecord>(gameId);
      if (!cancelled) cb.current(rec);
    })().catch((err) => console.error("Game subscription error:", err));

    return () => {
      cancelled = true;
      unsubscribe?.().catch(() => {});
    };
  }, [gameId, reloadKey]);
}
