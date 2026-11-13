import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scoreOf, type TeamScore } from "@/lib/scoring";
import type { AllInState } from "@/lib/pbTypes";

export type { AllInState };

type Props = {
  phase: string;
  allIn: AllInState;
  teams: { id: string; name: string }[];
  scores: TeamScore[];
  wagers: Record<string, number>;
  onStart: (a: { category: string; question: string; answer: string }) => void;
  onShowQuestion: () => void;
  onMark: (team: string, correct: boolean) => void;
  onStartReveal: () => void;
  onRevealNext: () => void;
  onFinish: () => void;
  onCancel: () => void;
};

/** Host side of the All In round. */
export default function AllInPanel(p: Props) {
  const [category, setCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const name = (id: string) => p.teams.find((t) => t.id === id)?.name ?? id;
  const results = p.allIn.results ?? {};

  if (!p.phase) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">One last question. Each team wagers on their phone before seeing it.</p>
        <Input placeholder="Category" aria-label="All In category" value={category} onChange={(e) => setCategory(e.target.value)} className="bg-background h-12" />
        <Input placeholder="Question" aria-label="All In question" value={question} onChange={(e) => setQuestion(e.target.value)} className="bg-background h-12" />
        <Input placeholder="Answer (only you see this)" aria-label="All In answer" value={answer} onChange={(e) => setAnswer(e.target.value)} className="bg-background h-12" />
        <div className="flex gap-3">
          <Button variant="outline" className="h-12" onClick={p.onCancel}>Back to board</Button>
          <Button
            variant="brand"
            className="flex-1 h-12"
            disabled={!category.trim() || !question.trim() || !answer.trim()}
            onClick={() => p.onStart({ category: category.trim(), question: question.trim(), answer: answer.trim() })}
          >
            Open wagers
          </Button>
        </div>
      </div>
    );
  }

  const header = (
    <div className="mb-4">
      <p className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">All In · {p.allIn.category}</p>
      {p.phase !== "wager" && <p className="text-2xl font-bold mt-2">{p.allIn.question}</p>}
      <p className="mt-2 text-accent font-bold">Answer: {p.allIn.answer}</p>
    </div>
  );

  if (p.phase === "wager") {
    const inCount = p.teams.filter((t) => p.wagers[t.id] !== undefined).length;
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="font-semibold" data-testid="allin-wager-count">Wagers in: {inCount} of {p.teams.length}</p>
        <ul className="space-y-1">
          {p.teams.map((t) => (
            <li key={t.id} className="flex justify-between bg-background/40 rounded-lg px-3 py-2">
              <span>{t.name}</span>
              <span className={p.wagers[t.id] !== undefined ? "text-green-400 font-bold" : "text-muted-foreground"}>
                {p.wagers[t.id] !== undefined ? "Locked in" : "Waiting"}
              </span>
            </li>
          ))}
        </ul>
        <Button variant="brand" className="h-12" onClick={p.onShowQuestion}>Close wagers and show the question</Button>
      </div>
    );
  }

  if (p.phase === "question") {
    const allMarked = p.teams.every((t) => results[t.id] !== undefined);
    return (
      <div className="flex flex-col gap-3">
        {header}
        {p.teams.map((t) => (
          <div key={t.id} className="flex items-center justify-between bg-background/40 rounded-lg px-3 py-2 gap-2">
            <span className="font-semibold">{t.name} <span className="text-muted-foreground font-mono text-sm">wagered {p.wagers[t.id] ?? 0}</span></span>
            <div className="flex gap-2">
              <Button
                size="sm"
                aria-label={`${t.name} right`}
                aria-pressed={results[t.id] === true}
                className={results[t.id] === true ? "bg-green-600 text-white" : ""}
                variant={results[t.id] === true ? "default" : "secondary"}
                onClick={() => p.onMark(t.id, true)}
              >Right</Button>
              <Button
                size="sm"
                aria-label={`${t.name} wrong`}
                aria-pressed={results[t.id] === false}
                variant={results[t.id] === false ? "destructive" : "secondary"}
                onClick={() => p.onMark(t.id, false)}
              >Wrong</Button>
            </div>
          </div>
        ))}
        <Button variant="brand" className="h-12" disabled={!allMarked} onClick={p.onStartReveal}>Start the reveal on the TV</Button>
      </div>
    );
  }

  const order = p.allIn.order ?? [];
  const revealed = p.allIn.revealed ?? 0;
  if (p.phase === "reveal") {
    const next = order[revealed];
    return (
      <div className="flex flex-col gap-3">
        {header}
        <ol className="space-y-1">
          {order.map((id, i) => (
            <li key={id} className={`flex justify-between rounded-lg px-3 py-2 ${i < revealed ? "bg-background/60" : "bg-background/20 text-muted-foreground"}`}>
              <span>{name(id)}</span>
              <span className="font-mono">
                {i < revealed ? `${(p.allIn.applied?.[id] ?? 0) >= 0 ? "+" : "−"}${Math.abs(p.allIn.applied?.[id] ?? 0)} → ${scoreOf(p.scores, id)}` : "hidden"}
              </span>
            </li>
          ))}
        </ol>
        {next ? (
          <Button variant="brand" className="h-12" onClick={p.onRevealNext}>Reveal {name(next)}</Button>
        ) : (
          <Button variant="brand" className="h-12" onClick={p.onFinish}>Show final standings</Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {header}
      <p className="text-xl font-bold text-accent">Game over. Final standings are on the TV.</p>
    </div>
  );
}
