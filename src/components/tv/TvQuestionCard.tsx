import { motion, AnimatePresence } from "framer-motion";
import TimerDisplay from "@/components/TimerDisplay";
import { buzzGap, type Buzz } from "@/lib/buzzes";
import type { BoardQuestion, GameTeam, WildcardState } from "@/lib/pbTypes";

type Props = {
  activeQuestion: BoardQuestion;
  wildcard: WildcardState | null;
  buzzerQueue: Buzz[];
  teams: GameTeam[];
  showAnswer: boolean;
  hostForceShowQuestion: boolean;
  timerEndsAt?: string;
  timerType?: "buzz" | "answer" | "";
  timerPausedRemaining?: number | null;
};

export default function TvQuestionCard({
  activeQuestion,
  wildcard,
  buzzerQueue,
  teams,
  showAnswer,
  hostForceShowQuestion,
  timerEndsAt,
  timerType,
  timerPausedRemaining,
}: Props) {
  const showQuestionText = wildcard
    ? (wildcard.wager !== null && wildcard.wager !== undefined) || showAnswer
    : !buzzerQueue.length || hostForceShowQuestion || showAnswer;

  return (
    <motion.div
      key="question-card"
      initial={{ rotateY: -90, opacity: 0, scale: 0.5 }}
      animate={{ rotateY: 0, opacity: 1, scale: 1 }}
      exit={{ rotateY: 90, opacity: 0, scale: 0.5 }}
      transition={{ type: "spring", damping: 15, stiffness: 100 }}
      className="w-full max-w-5xl aspect-video bg-tile/95 border-8 border-accent rounded-3xl shadow-[0_0_100px_rgba(255,90,31,0.3)] flex flex-col items-center justify-center p-8 md:p-16 text-center transform-style-3d relative overflow-hidden backdrop-blur-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent pointer-events-none" />
      <div className="absolute top-6 right-6 z-30">
        <TimerDisplay
          timerEndsAt={timerEndsAt}
          timerType={timerType}
          timerPausedRemaining={timerPausedRemaining}
          className="text-lg md:text-xl px-5 py-2"
        />
      </div>

      {wildcard && (
        <div className="absolute top-8 z-20 flex flex-col items-center gap-2" data-testid="tv-wildcard">
          <span className="bg-accent text-accent-foreground px-8 py-3 rounded-full text-3xl md:text-5xl font-black uppercase tracking-widest shadow-2xl">
            Wildcard
          </span>
          {wildcard.team && (
            <span className="text-xl md:text-3xl font-bold text-foreground">
              {teams.find((t) => t.id === wildcard.team)?.name}
              {wildcard.wager !== null && wildcard.wager !== undefined
                ? ` wagers ${wildcard.wager}`
                : " is playing"}
            </span>
          )}
        </div>
      )}

      <AnimatePresence>
        {buzzerQueue.length > 0 && !showAnswer && (
          <motion.div
            initial={{ y: -50, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-8 bg-destructive text-destructive-foreground px-6 md:px-10 py-3 md:py-4 rounded-full text-2xl md:text-4xl font-bold shadow-2xl z-20 flex items-center gap-4 border-4 border-background"
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-20 -left-0 -top-0" />
            🎤 {teams.find((t) => t.id === buzzerQueue[0].team)?.name} buzzed in!
          </motion.div>
        )}
      </AnimatePresence>

      {buzzerQueue.length > 0 && !showAnswer && (
        <div className="absolute top-1/4 mt-8 md:mt-12 text-white/80 text-sm md:text-lg z-10 flex flex-col gap-1">
          {buzzerQueue.length > 1 &&
            buzzerQueue.slice(1).map((q, idx) => (
              <motion.div
                key={q.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-black/40 px-4 py-1 rounded-full backdrop-blur-sm"
              >
                {teams.find((t) => t.id === q.team)?.name} ({buzzGap(buzzerQueue, idx + 1)})
              </motion.div>
            ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {showQuestionText ? (
          <motion.h1
            key="question-text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-4xl md:text-7xl font-bold leading-tight md:leading-tight mb-8 z-10 text-foreground drop-shadow-xl"
          >
            {activeQuestion.question}
          </motion.h1>
        ) : (
          <motion.div key="hidden-question" className="h-32" />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAnswer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-3xl md:text-6xl font-bold text-accent z-10 mt-8 px-8 py-4 bg-background/50 rounded-2xl border-2 border-accent/50 backdrop-blur-md shadow-2xl"
          >
            {activeQuestion.answer}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
