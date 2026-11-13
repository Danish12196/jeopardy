import { LOCALES, translate, type Locale } from "@/lib/i18n";
import type { A11yPrefs } from "@/lib/a11y";

type Props = {
  prefs: A11yPrefs;
  onChange: (next: A11yPrefs) => void;
};

const pill =
  "text-xs px-3 py-1 rounded-full border border-border/50 transition-colors hover:text-foreground";

export default function A11yControls({ prefs, onChange }: Props) {
  const t = (key: Parameters<typeof translate>[1]) => translate(prefs.locale, key);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="a11y-controls">
      <button
        type="button"
        aria-pressed={prefs.largeText}
        onClick={() => onChange({ ...prefs, largeText: !prefs.largeText })}
        className={`${pill} ${prefs.largeText ? "bg-accent text-accent-foreground" : "bg-card/60 text-muted-foreground"}`}
        data-testid="tv-large-text-toggle"
      >
        {t("tv.largeText")}
      </button>
      <button
        type="button"
        aria-pressed={prefs.colorblind}
        onClick={() => onChange({ ...prefs, colorblind: !prefs.colorblind })}
        className={`${pill} ${prefs.colorblind ? "bg-accent text-accent-foreground" : "bg-card/60 text-muted-foreground"}`}
        data-testid="tv-colorblind-toggle"
      >
        {t("tv.colorblind")}
      </button>
      <select
        aria-label={t("tv.language")}
        value={prefs.locale}
        onChange={(e) => onChange({ ...prefs, locale: e.target.value as Locale })}
        className={`${pill} bg-card/60 text-muted-foreground`}
        data-testid="tv-language-select"
      >
        {LOCALES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
