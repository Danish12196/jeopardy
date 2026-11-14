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
        </div>
      )}
    </div>
  );
}
