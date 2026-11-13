import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import WildcardPanel from "@/components/host/WildcardPanel";
import type { BoardQuestion, GameSettings, GameTeam, WildcardState } from "@/lib/pbTypes";
import type { TeamScore } from "@/lib/scoring";

type Props = {
  selectedTile: {
    row: number;
    col: number;
    value: number;
    questionData: BoardQuestion;
  };
  categoryName: string;
  showAnswer: boolean;
  wildcard: WildcardState | null | undefined;
  teams: GameTeam[];
  scores: TeamScore[];
  topValue: number;
  settings?: GameSettings;
  hasBuzzes: boolean;
  hostForceShowQuestion: boolean;
  onLockInWildcard: (team: string, wager: number) => void;
  onScoreWildcard: (correct: boolean) => void;
  onToggleForceShow: () => void;
  onRevealAnswer: () => void;
  onCancel: () => void;
  onDone: () => void;
};

export default function HostQuestionDetails({
  selectedTile,
  categoryName,
  showAnswer,
  wildcard,
  teams,
  scores,
  topValue,
  settings,
  hasBuzzes,
  hostForceShowQuestion,
  onLockInWildcard,
  onScoreWildcard,
  onToggleForceShow,
  onRevealAnswer,
  onCancel,
  onDone,
}: Props) {
  return (
    <motion.div
      key="details"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-card/60 backdrop-blur-xl p-8 rounded-2xl border border-border/50 flex flex-col h-full shadow-2xl relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

      <h2 className="text-3xl font-bold mb-4 text-accent drop-shadow-sm z-10">
        {selectedTile.value} pts - <span className="text-foreground">{categoryName}</span>
      </h2>
      <div className="text-2xl mb-6 bg-background/50 p-6 rounded-xl border border-border/50 shadow-inner z-10 font-medium leading-relaxed">
        {selectedTile.questionData.question}
      </div>

      {/* Host always sees the answer */}
      <div className="text-xl mb-8 text-accent bg-accent/10 p-6 rounded-xl font-bold border-2 border-accent/40 border-dashed z-10 shadow-sm flex flex-col gap-2">
        <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
          Answer
        </span>
        {selectedTile.questionData.answer}
      </div>

      {wildcard?.question === selectedTile.questionData.id && (
        <>
          <p className="z-10 mb-2 text-sm uppercase tracking-wider font-bold text-accent">
            Wildcard
          </p>
          <WildcardPanel
            key={wildcard.question}
            wildcard={wildcard}
            teams={teams}
            scores={scores}
            topValue={topValue}
            settings={settings}
            onLockIn={onLockInWildcard}
            onResult={onScoreWildcard}
          />
        </>
      )}

      {!showAnswer ? (
        <div className="flex flex-col gap-3 mb-6 z-10">
          {hasBuzzes && (
            <Button
              variant="secondary"
              onClick={onToggleForceShow}
              className="h-12 text-lg font-bold border-2 border-border/50"
            >
              {hostForceShowQuestion
                ? "Hide Question from Players"
                : "Show Question to Players (After Buzz)"}
            </Button>
          )}

          <Button
            variant="brand"
            onClick={onRevealAnswer}
            className="h-14 text-lg"
          >
            Reveal Answer on Board
          </Button>
        </div>
      ) : (
        <div className="text-md mb-6 text-green-400 italic font-semibold bg-green-900/20 p-4 rounded-lg text-center border border-green-500/20 z-10">
          ✓ Answer is currently revealed on the board.
        </div>
      )}

      <div className="flex gap-4 mt-auto z-10">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-12">
          Cancel (Don't mark used)
        </Button>
        <Button
          variant="destructive"
          onClick={onDone}
          className="flex-1 h-12 font-bold text-lg"
        >
          Done (Back to Board)
        </Button>
      </div>
    </motion.div>
  );
}
