/**
 * Client-side buzz rate limit. Allows `maxAttempts` buzz attempts in any
 * `windowMs` span; beyond that, buzzing is blocked until the oldest attempt
 * leaves the window. The server still decides buzz order; this only stops
 * button-mashing from flooding the `buzzes` collection.
 */
export function createBuzzGuard(maxAttempts = 3, windowMs = 2000, now: () => number = Date.now) {
  let attempts: number[] = [];

  const prune = () => {
    const cutoff = now() - windowMs;
    attempts = attempts.filter((t) => t > cutoff);
  };

  return {
    /** Records an attempt and returns true if it is allowed. */
    attempt(): boolean {
      prune();
      if (attempts.length >= maxAttempts) return false;
      attempts.push(now());
      return true;
    },
    /** Milliseconds until the next attempt would be allowed (0 if allowed now). */
    retryInMs(): number {
      prune();
      if (attempts.length < maxAttempts) return 0;
      return Math.max(0, attempts[0] + windowMs - now());
    },
  };
}
