// Game codes avoid characters that are easy to misread (0/O, 1/I).
export const GAME_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeGameCode(length = 6, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = random(length);
  return Array.from(bytes, (b) => GAME_CODE_CHARS[b % GAME_CODE_CHARS.length]).join("");
}
