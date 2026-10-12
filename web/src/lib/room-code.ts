export const ROOM_CODE_LENGTH = 4;

/** Uppercases input and drops anything that isn't A–Z, e.g. "ab c-d" → "ABCD". */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`).test(code);
}
