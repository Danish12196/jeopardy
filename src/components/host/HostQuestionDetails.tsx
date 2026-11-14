import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WildcardPanel from "@/components/host/WildcardPanel";
import QuestionMedia from "@/components/QuestionMedia";
import type { AnswerRecord, BoardQuestion, GameSettings, GameTeam, WildcardState } from "@/lib/pbTypes";
import { closestEstimationWinners, isTypedMatch, normalizeAnswer } from "@/lib/answerMatch";
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
  answers?: AnswerRecord[];
  onAutoScoreAnswers?: () => void;
  onEditQuestion?: (questionId: string, nextQuestion: string, nextAnswer: string) => Promise<void>;
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
  answers = [],
  onAutoScoreAnswers,
  onEditQuestion,
  hostForceShowQuestion,
  onLockInWildcard,
  onScoreWildcard,
  onToggleForceShow,
  onRevealAnswer,
  onCancel,
  onDone,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draftQ, setDraftQ] = useState(selectedTile.questionData.question);
  const [draftA, setDraftA] = useState(selectedTile.questionData.answer);

  const qType = selectedTile.questionData.questionType || "buzzer";
  const expected = selectedTile.questionData.answer;
  const estWinners =
    qType === "estimation"
      ? closestEstimationWinners(
          answers.map((a) => ({ team: a.team, value: a.value })),
          expected
        )
      : [];

  return (
    <motion.div
      key="details"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-card/60 backdrop-blur-xl p-8 rounded-2xl border border-border/50 flex flex-col h-full shadow-2xl relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

      <div className="flex items-center justify-between gap-2 mb-4 z-10">
        <h2 className="text-3xl font-bold text-accent drop-shadow-sm">
          {selectedTile.value} pts - <span className="text-foreground">{categoryName}</span>
        </h2>
        {onEditQuestion && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraftQ(selectedTile.questionData.question);
              setDraftA(selectedTile.questionData.answer);
              setEditing((v) => !v);
            }}
          >
            {editing ? "Close Edit" : "Edit Q/A"}
          </Button>
        )}
      </div>

      {editing && onEditQuestion ? (
        <form
          className="mb-6 bg-background/60 p-4 rounded-xl border border-accent/40 z-10 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draftQ.trim() || !draftA.trim()) return;
            await onEditQuestion(selectedTile.questionData.id, draftQ.trim(), draftA.trim());
            setEditing(false);
          }}
        >
          <Input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            aria-label="Edit Question"
            className="bg-background"
          />
          <Input
            value={draftA}
            onChange={(e) => setDraftA(e.target.value)}
            aria-label="Edit Answer"
            className="bg-background"
          />
          <Button type="submit" size="sm" variant="brand">
            Save Q/A
          </Button>
        </form>
      ) : (
        <>
          <div className="text-2xl mb-6 bg-background/50 p-6 rounded-xl border border-border/50 shadow-inner z-10 font-medium leading-relaxed">
            <div>{selectedTile.questionData.question}</div>
            <QuestionMedia
              mediaUrl={selectedTile.questionData.mediaUrl}
              mediaType={selectedTile.questionData.mediaType}
              compact
            />
          </div>

          {/* Host always sees the answer */}
          <div className="text-xl mb-6 text-accent bg-accent/10 p-6 rounded-xl font-bold border-2 border-accent/40 border-dashed z-10 shadow-sm flex flex-col gap-2">
            <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
              Answer
            </span>
            {selectedTile.questionData.answer}
          </div>
        </>
      )}

      {qType !== "buzzer" && (
        <div className="mb-6 bg-background/50 p-4 rounded-xl border border-border/50 z-10 space-y-3" data-testid="host-submitted-answers">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
              Submitted Answers ({answers.length})
            </span>
            {answers.length > 0 && onAutoScoreAnswers && (
              <Button size="sm" variant="brand" onClick={onAutoScoreAnswers}>
                {qType === "estimation" ? "Award Closest" : "Auto-Score Answers"}
              </Button>
            )}
          </div>
          {answers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for teams to submit...</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {answers.map((a) => {
                const teamName = teams.find((t) => t.id === a.team)?.name ?? a.team;
                const isMatch =
                  qType === "estimation"
                    ? estWinners.includes(a.team)
                    : qType === "typed"
                    ? isTypedMatch(a.value, expected)
                    : normalizeAnswer(a.value) === normalizeAnswer(expected);
                return (
                  <li key={a.id} className="flex items-center justify-between bg-card/60 px-3 py-1.5 rounded-lg">
                    <span className="font-semibold">{teamName}</span>
                    <span className={isMatch ? "text-green-400 font-bold" : "text-muted-foreground"}>
                      {a.value} {isMatch ? "✓" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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
