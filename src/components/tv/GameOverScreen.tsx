import { motion } from "framer-motion";
import { scoreOf, standings, type TeamScore } from "@/lib/scoring";

/** Final standings on the TV. */
export default function GameOverScreen({ teams, scores }: { teams: { id: string; name: string }[]; scores: TeamScore[] }) {
  const ranked = standings(teams.map((t) => ({ ...t, score: scoreOf(scores, t.id) })));
  const top = ranked[0]?.score;
  const winners = ranked.filter((t) => t.score === top);

  return (
    <motion.div
      key="game-over"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-4xl bg-card/80 backdrop-blur-md border-4 border-accent rounded-3xl p-8 md:p-14 text-center shadow-2xl"
      data-testid="tv-game-over"
    >
      <p className="text-5xl md:text-7xl font-black uppercase tracking-widest text-accent mb-2">Game over</p>
      <p className="text-2xl md:text-4xl font-bold mb-10">
        {winners.length > 1 ? `It's a tie: ${winners.map((w) => w.name).join(" & ")}` : `${winners[0]?.name ?? ""} wins!`}
      </p>
      <ol className="flex flex-col gap-3">
        {ranked.map((t, i) => (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className={`flex justify-between items-center text-2xl md:text-4xl font-bold px-6 py-4 rounded-xl ${t.score === top ? "bg-accent text-accent-foreground" : "bg-background/50"}`}
          >
            <span>{i + 1}. {t.name}</span>
            <span className="font-mono">{t.score}</span>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  );
}
