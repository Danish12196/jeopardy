export type Locale = "en" | "es" | "fr";

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
];

const EN = {
  "tv.round": "Round {n}",
  "tv.eliminated": "Eliminated: {names}",
  "tv.tiebreaker": "Tiebreaker",
  "tv.paused": "Game Paused",
  "tv.pausedHint": "Waiting for the host to resume...",
  "tv.spectator": "Spectator view",
  "tv.largeText": "Large text",
  "tv.colorblind": "Colorblind palette",
  "tv.language": "Language",
  "tv.soundOn": "TV Sound: On",
  "tv.soundMuted": "TV Sound: Muted",
  "live.questionOpen": "Question open: {q}",
  "live.answer": "Answer: {a}",
  "live.buzzed": "{team} buzzed in",
  "live.leader": "{team} is leading with {score} points",
  "live.paused": "Game paused",
  "live.gameOver": "Game over",
} as const;

export type MessageKey = keyof typeof EN;

const ES: Record<MessageKey, string> = {
  "tv.round": "Ronda {n}",
  "tv.eliminated": "Eliminados: {names}",
  "tv.tiebreaker": "Desempate",
  "tv.paused": "Juego en pausa",
  "tv.pausedHint": "Esperando a que el anfitrión continúe...",
  "tv.spectator": "Vista de espectador",
  "tv.largeText": "Texto grande",
  "tv.colorblind": "Paleta para daltonismo",
  "tv.language": "Idioma",
  "tv.soundOn": "Sonido de TV: Activado",
  "tv.soundMuted": "Sonido de TV: Silenciado",
  "live.questionOpen": "Pregunta abierta: {q}",
  "live.answer": "Respuesta: {a}",
  "live.buzzed": "{team} pulsó el timbre",
  "live.leader": "{team} lidera con {score} puntos",
  "live.paused": "Juego en pausa",
  "live.gameOver": "Fin del juego",
};

const FR: Record<MessageKey, string> = {
  "tv.round": "Manche {n}",
  "tv.eliminated": "Éliminés : {names}",
  "tv.tiebreaker": "Départage",
  "tv.paused": "Jeu en pause",
  "tv.pausedHint": "En attente de l'animateur...",
  "tv.spectator": "Vue spectateur",
  "tv.largeText": "Grand texte",
  "tv.colorblind": "Palette daltonien",
  "tv.language": "Langue",
  "tv.soundOn": "Son TV : activé",
  "tv.soundMuted": "Son TV : coupé",
  "live.questionOpen": "Question ouverte : {q}",
  "live.answer": "Réponse : {a}",
  "live.buzzed": "{team} a buzzé",
  "live.leader": "{team} mène avec {score} points",
  "live.paused": "Jeu en pause",
  "live.gameOver": "Fin de partie",
};

const CATALOGS: Record<Locale, Record<MessageKey, string>> = { en: EN, es: ES, fr: FR };

export function normalizeLocale(value: unknown): Locale {
  return LOCALES.some((l) => l.value === value) ? (value as Locale) : "en";
}

/** Look up a message and substitute `{placeholders}`. Falls back to English. */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars: Record<string, string | number> = {}
): string {
  const template = CATALOGS[locale]?.[key] ?? EN[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`
  );
}
