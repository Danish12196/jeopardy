import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AllInCapMode, GameSettings, WildcardCapMode, WrongPenalty } from "@/lib/pbTypes";
import { normalizeSettings } from "@/lib/scoring";
import { DEFAULT_SPEED_BUZZ_SECONDS, GAME_MODES, normalizeGameMode } from "@/lib/gameModes";
import type { GameMode } from "@/lib/pbTypes";

type Props = {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
};

export default function GameRulesSettings({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customValuesText, setCustomValuesText] = useState(
    settings.customValues?.length ? settings.customValues.join(", ") : ""
  );
  const s = normalizeSettings(settings);

  const update = (patch: Partial<GameSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const handleCustomValuesChange = (text: string) => {
    setCustomValuesText(text);
    const parsed = text
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => Math.round(n));
    update({ customValues: parsed });
  };

  return (
    <div className="mt-6 rounded-xl border border-border/50 bg-background/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left font-bold hover:bg-background/60 transition-colors"
      >
        <span>Game Rules &amp; Settings</span>
        <span className="text-xs font-mono text-muted-foreground">
          {open ? "Hide" : "Customize"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
          <div>
            <label htmlFor="game-mode" className="block font-semibold mb-1.5">
              Game Mode
            </label>
            <Select
              value={normalizeGameMode(s.gameMode)}
              onValueChange={(v) => {
                const mode = v as GameMode;
                update(
                  mode === "speed" && !s.buzzTimerSeconds
                    ? { gameMode: mode, buzzTimerSeconds: DEFAULT_SPEED_BUZZ_SECONDS }
                    : { gameMode: mode }
                );
              }}
            >
              <SelectTrigger id="game-mode" aria-label="Game Mode" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAME_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="wrong-penalty" className="block font-semibold mb-1.5">
              Wrong Answer Penalty
            </label>
            <Select
              value={s.wrongPenalty}
              onValueChange={(v) => update({ wrongPenalty: v as WrongPenalty })}
            >
              <SelectTrigger id="wrong-penalty" aria-label="Wrong Answer Penalty" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full value (−100%)</SelectItem>
                <SelectItem value="half">Half value (−50%)</SelectItem>
                <SelectItem value="none">No penalty (0)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="point-multiplier" className="block font-semibold mb-1.5">
              Point Multiplier
            </label>
            <Select
              value={String(s.pointMultiplier)}
              onValueChange={(v) => update({ pointMultiplier: Number(v) })}
            >
              <SelectTrigger id="point-multiplier" aria-label="Point Multiplier" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1× (Standard)</SelectItem>
                <SelectItem value="2">2× (Double)</SelectItem>
                <SelectItem value="3">3× (Triple)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 bg-background/50 p-3 rounded-lg border border-border/40">
            <div>
              <p className="font-semibold">Steal / Pass on Wrong</p>
              <p className="text-xs text-muted-foreground">
                Marking #1 wrong automatically advances to the next buzzer.
              </p>
            </div>
            <Switch
              checked={s.stealEnabled}
              onCheckedChange={(checked) => update({ stealEnabled: checked })}
              aria-label="Steal / Pass on Wrong"
            />
          </div>

          <div>
            <label htmlFor="custom-row-values" className="block font-semibold mb-1.5">
              Custom Row Values (comma-separated)
            </label>
            <Input
              id="custom-row-values"
              value={customValuesText}
              onChange={(e) => handleCustomValuesChange(e.target.value)}
              placeholder="e.g. 200, 400, 600, 800, 1000"
              className="bg-background"
            />
          </div>

          <div className="flex flex-col gap-3 bg-background/50 p-3 rounded-lg border border-border/40">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Wildcard Tiles</span>
              <Switch
                checked={s.wildcardEnabled}
                onCheckedChange={(checked) => update({ wildcardEnabled: checked })}
                aria-label="Enable Wildcard Tiles"
              />
            </div>
            {s.wildcardEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={s.wildcardCapMode}
                  onValueChange={(v) => update({ wildcardCapMode: v as WildcardCapMode })}
                >
                  <SelectTrigger aria-label="Wildcard Wager Cap" className="bg-background h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Score or Top Value</SelectItem>
                    <SelectItem value="fixed">Fixed Cap</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
                {s.wildcardCapMode === "fixed" && (
                  <Input
                    type="number"
                    min={0}
                    value={s.wildcardFixedCap}
                    onChange={(e) => update({ wildcardFixedCap: Number(e.target.value) })}
                    aria-label="Wildcard Fixed Cap"
                    className="bg-background h-9"
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 bg-background/50 p-3 rounded-lg border border-border/40">
            <div className="flex items-center justify-between">
              <span className="font-semibold">All In Round</span>
              <Switch
                checked={s.allInEnabled}
                onCheckedChange={(checked) => update({ allInEnabled: checked })}
                aria-label="Enable All In Round"
              />
            </div>
            {s.allInEnabled && (
              <Select
                value={s.allInCapMode}
                onValueChange={(v) => update({ allInCapMode: v as AllInCapMode })}
              >
                <SelectTrigger aria-label="All In Wager Cap" className="bg-background h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Team Score</SelectItem>
                  <SelectItem value="score_or_top">Score or Top Value</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label htmlFor="buzz-timer-seconds" className="block font-semibold mb-1.5">
              Buzz Window Timer (seconds, 0 = off)
            </label>
            <Input
              id="buzz-timer-seconds"
              type="number"
              min={0}
              max={300}
              value={s.buzzTimerSeconds}
              onChange={(e) => update({ buzzTimerSeconds: Math.max(0, Number(e.target.value) || 0) })}
              className="bg-background"
            />
          </div>

          <div>
            <label htmlFor="answer-timer-seconds" className="block font-semibold mb-1.5">
              Answer Timer (seconds, 0 = off)
            </label>
            <Input
              id="answer-timer-seconds"
              type="number"
              min={0}
              max={300}
              value={s.answerTimerSeconds}
              onChange={(e) => update({ answerTimerSeconds: Math.max(0, Number(e.target.value) || 0) })}
              className="bg-background"
            />
          </div>

          <div className="md:col-span-2 border-t border-border/40 pt-4 mt-1">
            <p className="font-bold text-base mb-3">Themes &amp; Branding</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="brand-title" className="block font-semibold mb-1.5">
                  Custom Game Title
                </label>
                <Input
                  id="brand-title"
                  value={s.branding.gameTitle ?? ""}
                  onChange={(e) =>
                    update({ branding: { ...s.branding, gameTitle: e.target.value } })
                  }
                  placeholder="e.g. Friday Trivia Night"
                  className="bg-background"
                />
              </div>

              <div>
                <label htmlFor="brand-logo" className="block font-semibold mb-1.5">
                  Logo URL (optional)
                </label>
                <Input
                  id="brand-logo"
                  value={s.branding.logoUrl ?? ""}
                  onChange={(e) =>
                    update({ branding: { ...s.branding, logoUrl: e.target.value } })
                  }
                  placeholder="https://example.com/logo.png"
                  className="bg-background"
                />
              </div>

              <div>
                <label htmlFor="brand-accent" className="block font-semibold mb-1.5">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="brand-accent"
                    type="color"
                    value={s.branding.accentColor ?? "#FF5A1F"}
                    onChange={(e) =>
                      update({ branding: { ...s.branding, accentColor: e.target.value } })
                    }
                    className="h-10 w-14 rounded border border-border bg-background cursor-pointer"
                  />
                  <Input
                    aria-label="Accent Color Hex"
                    value={s.branding.accentColor ?? "#FF5A1F"}
                    onChange={(e) =>
                      update({ branding: { ...s.branding, accentColor: e.target.value } })
                    }
                    className="bg-background font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="brand-tv-theme" className="block font-semibold mb-1.5">
                    TV Theme
                  </label>
                  <Select
                    value={s.branding.tvTheme ?? "dark"}
                    onValueChange={(v) =>
                      update({ branding: { ...s.branding, tvTheme: v as "dark" | "light" } })
                    }
                  >
                    <SelectTrigger id="brand-tv-theme" aria-label="TV Theme" className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="brand-bg-style" className="block font-semibold mb-1.5">
                    Background
                  </label>
                  <Select
                    value={s.branding.backgroundStyle ?? "gradient"}
                    onValueChange={(v) =>
                      update({
                        branding: {
                          ...s.branding,
                          backgroundStyle: v as "gradient" | "solid" | "midnight",
                        },
                      })
                    }
                  >
                    <SelectTrigger id="brand-bg-style" aria-label="Background Style" className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gradient">Gradient</SelectItem>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="midnight">Midnight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 space-y-3">
              <div className="font-semibold text-foreground">Sound & Effects</div>
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="sound-muted" className="font-semibold cursor-pointer">
                  Mute All Game Sounds
                </label>
                <Switch
                  id="sound-muted"
                  checked={Boolean(s.sound.muted)}
                  onCheckedChange={(checked) =>
                    update({ sound: { ...s.sound, muted: checked } })
                  }
                />
              </div>
              <div>
                <label htmlFor="sound-volume" className="block font-semibold mb-1.5">
                  Master Volume ({Math.round((s.sound.volume ?? 0.7) * 100)}%)
                </label>
                <input
                  id="sound-volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={s.sound.volume ?? 0.7}
                  onChange={(e) =>
                    update({ sound: { ...s.sound, volume: Number(e.target.value) } })
                  }
                  className="w-full accent-accent"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    ["buzz", "Buzz Sound"],
                    ["correct", "Correct Answer"],
                    ["wrong", "Wrong Answer"],
                    ["timerEnd", "Timer Expired"],
                    ["wildcard", "Wildcard Reveal"],
                    ["allInReveal", "All In Reveal"],
                  ] as const
                ).map(([evt, label]) => (
                  <label key={evt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.sound.enabledEvents?.[evt] !== false}
                      onChange={(e) =>
                        update({
                          sound: {
                            ...s.sound,
                            enabledEvents: {
                              ...s.sound.enabledEvents,
                              [evt]: e.target.checked,
                            },
                          },
                        })
                      }
                      className="h-4 w-4 accent-accent"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-4">
              <div>
                <label htmlFor="allow-self-reg" className="font-semibold cursor-pointer block">
                  Allow Phone Team Registration
                </label>
                <span className="text-xs text-muted-foreground">
                  Players can request a new team from their phone (host approves).
                </span>
              </div>
              <Switch
                id="allow-self-reg"
                checked={Boolean(s.allowSelfRegistration)}
                onCheckedChange={(checked) => update({ allowSelfRegistration: checked })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
