import { motion, AnimatePresence } from "framer-motion";
import type { GameTeam } from "@/lib/pbTypes";

type Props = {
  teams: GameTeam[];
};

export default function TvScoreboard({ teams }: Props) {
  return (
    <div className="flex justify-center gap-4 md:gap-8 mb-6 md:mb-8 flex-wrap">
      <AnimatePresence>
        {teams.map((team) => (
          <motion.div
            key={team.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            layout
            style={team.color ? { borderColor: team.color } : undefined}
            className="bg-card/80 backdrop-blur-md border-2 border-accent/40 rounded-xl px-4 md:px-8 py-2 md:py-4 text-center shadow-lg w-32 md:w-48 transition-colors"
          >
            <h2
              className="font-bold text-lg md:text-2xl mb-1 truncate text-foreground"
              title={team.name}
            >
              {team.emoji ? `${team.emoji} ` : ""}{team.name}
            </h2>
            {team.members && team.members.length > 0 && (
              <p className="text-xs text-muted-foreground truncate mb-1" title={team.members.join(", ")}>
                {team.members.join(", ")}
              </p>
            )}
            <motion.p
              key={team.score}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-accent text-2xl md:text-4xl font-mono font-bold"
              data-testid={`tv-score-${team.name}`}
            >
              {team.score}
            </motion.p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
