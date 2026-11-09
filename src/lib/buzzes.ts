// Buzz order is decided by the server: each buzz is a `buzzes` record and
// PocketBase stamps `created` when it saves it. Phones never send a time.

export type Buzz = {
  id: string;
  game: string;
  team: string;
  round: number;
  created: string;
};

/** PocketBase dates look like "2026-11-09 07:54:27.819Z"; make them ISO so every browser parses them. */
export function buzzTime(b: Pick<Buzz, "created">): number {
  return Date.parse(b.created.replace(" ", "T"));
}

/** Server order: earliest `created` first, then id so ties sort the same everywhere. */
export function sortBuzzes<T extends Pick<Buzz, "id" | "created">>(buzzes: T[]): T[] {
  return [...buzzes].sort((a, b) => buzzTime(a) - buzzTime(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Keeps only buzzes for this round, one per team (the earliest), in server order. */
export function currentQueue<T extends Buzz>(buzzes: T[], round: number): T[] {
  const seen = new Set<string>();
  return sortBuzzes(buzzes.filter((b) => b.round === round)).filter((b) => {
    if (seen.has(b.team)) return false;
    seen.add(b.team);
    return true;
  });
}

/** 1-based position of a team in the queue, or 0 if it hasn't buzzed. */
export function buzzPosition(queue: Pick<Buzz, "team">[], teamId: string): number {
  return queue.findIndex((b) => b.team === teamId) + 1;
}

/** Seconds after the first buzz, e.g. "+0.12s". */
export function buzzGap(queue: Buzz[], index: number): string {
  if (index <= 0 || !queue[0]) return "";
  return `+${((buzzTime(queue[index]) - buzzTime(queue[0])) / 1000).toFixed(2)}s`;
}
