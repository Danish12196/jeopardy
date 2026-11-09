import { motion, AnimatePresence } from "framer-motion";
import { scoreOf, type TeamScore } from "@/lib/scoring";
import type { AllInState } from "@/components/host/AllInPanel";

type Props = {
  phase: string;
  allIn: AllInState;
  teams: { id: string; name: string }[];
  scores: TeamScore[];
  wagers: Record<string, number>;
};

/** TV view of the All In round. Wagers stay hidden until each team's reveal. */
export default function AllInScreen({ phase, allIn, teams, scores, wagers }: Props) {
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "";
  const order = allIn.order ?? [];
  const revealed = allIn.revealed ?? 0;

  return (
    <motion.div
      key="allin"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-5xl bg-tile/95 border-8 border-accent rounded-3xl shadow-[0_0_100px_rgba(255,90,31,0.3)] flex flex-col items-center justify-center p-8 md:p-16 text-center gap-6"
      data-testid="tv-allin"
    >
      <p className="text-5xl md:text-7xl font-black uppercase tracking-widest text-accent">All In</p>
      <p className="text-2xl md:text-4xl font-bold text-foreground">{allIn.category}</p>

      {phase === "wager" && (
        <p className="text-xl md:text-3xl text-muted-foreground">Teams: place your wager on your phone.</p>
      )}

      {(phase === "question" || phase === "reveal") && (
        <p className="text-3xl md:text-5xl font-bold leading-tight text-foreground">{allIn.question}</p>
      )}

      {phase === "reveal" && (
        <div className="w-full max-w-2xl flex flex-col gap-3 mt-4">
          {revealed > 0 && <p className="text-2xl md:text-4xl font-bold text-accent">{allIn.answer}</p>}
          <AnimatePresence>
            {order.slice(0, revealed).map((id) => {
              const correct = allIn.results?.[id];
              const delta = allIn.applied?.[id] ?? 0;
              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex justify-between items-center text-xl md:text-3xl font-bold px-6 py-3 rounded-xl border-2 ${correct ? "border-green-500 bg-green-900/30" : "border-destructive bg-destructive/20"}`}
                  data-testid={`allin-reveal-${name(id)}`}
                >
                  <span>{name(id)}</span>
                  <span className="font-mono">
                    {correct ? "✓" : "✗"} wagered {wagers[id] ?? Math.abs(delta)} · {delta >= 0 ? "+" : "−"}{Math.abs(delta)} → {scoreOf(scores, id)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
