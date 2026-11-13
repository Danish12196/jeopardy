export type HostShortcutAction =
  | "toggleBuzzer"
  | "revealAnswer"
  | "doneQuestion"
  | "clearBuzzers"
  | "togglePause"
  | "toggleHelp";

export const HOST_SHORTCUTS: { key: string; label: string }[] = [
  { key: "Space", label: "Open / Lock buzzers" },
  { key: "R", label: "Reveal answer (when question is active)" },
  { key: "D", label: "Done / back to board (when question is active)" },
  { key: "C", label: "Clear buzz queue" },
  { key: "P", label: "Pause / Resume game" },
  { key: "?", label: "Show or hide keyboard shortcuts" },
];

const IGNORED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function resolveHostShortcut(opts: {
  key: string;
  targetTag?: string;
  hasActiveQuestion: boolean;
  isModalOpen?: boolean;
}): HostShortcutAction | null {
  if (opts.targetTag && IGNORED_TAGS.has(opts.targetTag.toUpperCase())) {
    return null;
  }
  if (opts.key === "?" || (opts.key === "Escape" && opts.isModalOpen)) {
    return "toggleHelp";
  }
  if (opts.key === " ") return "toggleBuzzer";
  const lower = opts.key.toLowerCase();
  if (lower === "r" && opts.hasActiveQuestion) return "revealAnswer";
  if (lower === "d" && opts.hasActiveQuestion) return "doneQuestion";
  if (lower === "c") return "clearBuzzers";
  if (lower === "p") return "togglePause";
  return null;
}
