import { useEffect, useState } from "react";
import pb from "@/pb";
import type { TeamRegistrationRecord } from "@/lib/pbTypes";

export function useTeamRegistrations(gameId: string | undefined, reloadKey = 0) {
  const [registrations, setRegistrations] = useState<TeamRegistrationRecord[]>([]);

  const upsert = (incoming: TeamRegistrationRecord[]) =>
    setRegistrations((prev) => {
      const byId = new Map(prev.map((x) => [x.id, x]));
      for (const x of incoming) byId.set(x.id, x);
      return [...byId.values()];
    });

  useEffect(() => {
    setRegistrations([]);
    if (!gameId) return;
    let cancelled = false;
    let unsubscribe: (() => Promise<void>) | null = null;

    (async () => {
      unsubscribe = await pb.collection("team_registrations").subscribe<TeamRegistrationRecord>(
        "*",
        (e) => {
          if (cancelled || e.record.game !== gameId) return;
          if (e.action === "delete") {
            setRegistrations((prev) => prev.filter((x) => x.id !== e.record.id));
          } else {
            upsert([e.record]);
          }
        },
        { filter: pb.filter("game = {:game}", { game: gameId }) }
      );
      if (cancelled) unsubscribe().catch(() => {});
    })().catch((err) => console.error("Failed to subscribe to team_registrations:", err));

    pb.collection("team_registrations")
      .getFullList<TeamRegistrationRecord>({
        filter: pb.filter("game = {:game}", { game: gameId }),
        sort: "created",
      })
      .then((list) => {
        if (!cancelled) upsert(list);
      })
      .catch((err) => console.error("Failed to load team_registrations:", err));

    return () => {
      cancelled = true;
      unsubscribe?.().catch(() => {});
    };
  }, [gameId, reloadKey]);

  return registrations;
}
