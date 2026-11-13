export const TEAM_EMOJIS = ["🚀", "⚡", "🔥", "🦊", "🦁", "🦉", "🐉", "🌟"];

export const TEAM_COLORS = [
  "#FF5A1F",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
];

export function parseMembersInput(raw: string): string[] {
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

export function teamDisplayName(team: { name: string; emoji?: string }): string {
  return team.emoji ? `${team.emoji} ${team.name}` : team.name;
}
