export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

export function isTypedMatch(submitted: string, expected: string): boolean {
  const sub = normalizeAnswer(submitted);
  const exp = normalizeAnswer(expected);
  if (!sub || !exp) return false;
  if (sub === exp) return true;
  if (exp.length <= 3) return false;
  const maxDist = Math.max(1, Math.floor(exp.length / 6));
  return levenshtein(sub, exp) <= maxDist;
}

export function closestEstimationWinners(
  submissions: { team: string; value: string }[],
  targetRaw: string | number
): string[] {
  const target = typeof targetRaw === "number" ? targetRaw : Number(String(targetRaw).replace(/,/g, "").trim());
  if (!Number.isFinite(target)) return [];

  let bestDist = Infinity;
  let winners: string[] = [];

  for (const s of submissions) {
    const num = Number(String(s.value).replace(/,/g, "").trim());
    if (!Number.isFinite(num)) continue;
    const dist = Math.abs(num - target);
    if (dist < bestDist) {
      bestDist = dist;
      winners = [s.team];
    } else if (dist === bestDist && !winners.includes(s.team)) {
      winners.push(s.team);
    }
  }
  return winners;
}
