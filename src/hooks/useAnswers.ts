import { useEffect, useMemo, useState } from "react";
import pb from "@/pb";
import type { AnswerRecord } from "@/lib/pbTypes";

export function useAnswers(
  gameId: string | undefined,
  questionId: string | null | undefined,
  round: number,
  reloadKey = 0
): AnswerRecord[] {
  const [all, setAll] = useState<AnswerRecord[]>([]);

  const add = (incoming: AnswerRecord[]) =>
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
      unsubscribe = await pb.collection("answers").subscribe<AnswerRecord>(
        "*",
        (e) => {
          if (cancelled || e.record.game !== gameId) return;
          if (e.action === "delete") setAll((prev) => prev.filter((x) => x.id !== e.record.id));
          else add([e.record]);
        },
        { filter: pb.filter("game = {:game}", { game: gameId }) }
      );
      if (cancelled) unsubscribe().catch(() => {});
    })().catch((err) => console.error("Failed to subscribe to answers:", err));

    return () => {
      cancelled = true;
      unsubscribe?.().catch(() => {});
    };
  }, [gameId, reloadKey]);

  useEffect(() => {
    if (!gameId || !questionId) return;
    let cancelled = false;
    pb.collection("answers")
      .getFullList<AnswerRecord>({
        filter: pb.filter("game = {:game} && question = {:question} && round = {:round}", {
          game: gameId,
          question: questionId,
          round,
        }),
        sort: "created,id",
      })
      .then((list) => {
        if (!cancelled) add(list);
      })
      .catch((err) => console.error("Failed to load answers:", err));
    return () => {
      cancelled = true;
    };
  }, [gameId, questionId, round, reloadKey]);

  return useMemo(() => {
    if (!questionId) return [];
    return all.filter((a) => a.question === questionId && a.round === round);
  }, [all, questionId, round]);
}
