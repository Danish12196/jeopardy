import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import pb from "@/pb";
import AllInPanel from "@/components/host/AllInPanel";
import HostBoardGrid from "@/components/host/HostBoardGrid";
import HostQuestionDetails from "@/components/host/HostQuestionDetails";
import HostBuzzerControls from "@/components/host/HostBuzzerControls";
import HostTeamScores from "@/components/host/HostTeamScores";
import HostHeader from "@/components/host/HostHeader";
import EndGameDialog from "@/components/host/EndGameDialog";
import ReconnectingBadge from "@/components/ReconnectingBadge";
import { useHostGame } from "@/hooks/useHostGame";
import { effectiveBoardValues } from "@/lib/scoring";

export default function GameHost() {
  const { uniqueID } = useParams();
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const {
    game,
    settings,
    notFound,
    categories,
    questions,
    teams,
    usedQuestions,
    selectedTile,
    autoUnlock,
    setAutoUnlock,
    connected,
    buzzQueue,
    allInPhase,
    allIn,
    wagers,
    scores,
    wildcards,
    markingWildcards,
    setMarkingWildcards,
    allInOpen,
    setAllInOpen,
    adjust,
    setAdjust,
    scorePending,
    actionError,
    setActionError,
    updateGame,
    undoScore,
    applyAdjust,
    selectQuestion,
    lockInWildcard,
    scoreWildcard,
    startAllIn,
    markAllIn,
    startReveal,
    revealNext,
    finishGame,
    cancelQuestion,
    clearQuestion,
    toggleBuzzer,
    revealAnswer,
    updateTeamScore,
    clearBuzzers,
    forceShowQuestion,
  } = useHostGame(uniqueID);

  const rowCount = Math.max(0, ...questions.map((qs) => qs.length));
  const values = effectiveBoardValues(game?.values, rowCount, settings);
  const topValue = Math.max(0, ...questions.flat().map((q) => q.value || 0));

  if (notFound) {
    return (
      <div className="min-h-screen bg-background bg-animated-gradient text-foreground flex items-center justify-center p-8">
        <div className="bg-card/60 backdrop-blur-md p-8 rounded-2xl border border-border/50 shadow-xl max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-accent">Game not found</h1>
          <p className="text-muted-foreground">
            No game matches code <span className="font-mono font-bold">{uniqueID}</span>.
          </p>
          <Link
            to="/"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Back to Game Setup
          </Link>
        </div>
      </div>
    );
  }

  if (!game) {
    return <div className="p-8 text-foreground bg-background min-h-screen">Loading Host View...</div>;
  }

  if (game.host && game.host !== pb.authStore.record?.id) {
    return (
      <div className="min-h-screen bg-background bg-animated-gradient text-foreground flex items-center justify-center p-8">
        <div className="bg-card/60 backdrop-blur-md p-8 rounded-2xl border border-border/50 shadow-xl max-w-md text-center">
          <h1 className="text-2xl font-bold text-accent mb-4">Not your game</h1>
          <p className="text-muted-foreground">
            Game {uniqueID} belongs to another host. Log in as that host to run it.
          </p>
        </div>
      </div>
    );
  }

  const handleEndGame = async () => {
    await finishGame();
    setConfirmEndOpen(false);
  };

  return (
    <div className="min-h-screen bg-background bg-animated-gradient text-foreground p-4 md:p-8">
      <ReconnectingBadge show={!connected} />
      <HostHeader uniqueID={uniqueID} onCopyError={setActionError} />

      <AnimatePresence>
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-destructive/40 bg-destructive/15 px-4 py-3 text-sm font-semibold text-destructive"
          >
            <span>{actionError}</span>
            <Button variant="ghost" size="sm" onClick={() => setActionError(null)}>
              Dismiss
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/2 flex flex-col min-h-[60vh]">
          {!selectedTile && !allInOpen && !allInPhase && (
            <div className="flex flex-wrap gap-3 mb-3">
              <Button
                variant={markingWildcards ? "brand" : "secondary"}
                aria-pressed={markingWildcards}
                onClick={() => setMarkingWildcards((m) => !m)}
                className="font-bold"
              >
                {markingWildcards ? "Done marking Wildcards" : "Mark Wildcards"}
              </Button>
              <Button
                variant="secondary"
                className="font-bold"
                onClick={() => {
                  setMarkingWildcards(false);
                  setAllInOpen(true);
                }}
              >
                All In
              </Button>
              <Button variant="outline" className="ml-auto" onClick={() => setConfirmEndOpen(true)}>
                End game
              </Button>
            </div>
          )}
          {markingWildcards && !selectedTile && (
            <p className="text-sm text-accent mb-3 font-semibold">
              Tap tiles to mark or unmark them as Wildcards. Only you can see the marks.
            </p>
          )}
          <AnimatePresence mode="wait">
            {allInOpen || allInPhase ? (
              <motion.div
                key="allin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-card/60 backdrop-blur-xl p-8 rounded-2xl border border-accent/50 shadow-2xl"
              >
                <h2 className="text-3xl font-bold mb-4 text-accent">All In</h2>
                <AllInPanel
                  phase={allInPhase}
                  allIn={allIn}
                  teams={teams}
                  scores={scores}
                  wagers={wagers}
                  onStart={startAllIn}
                  onShowQuestion={() => updateGame({ allInPhase: "question" })}
                  onMark={markAllIn}
                  onStartReveal={startReveal}
                  onRevealNext={revealNext}
                  onFinish={finishGame}
                  onCancel={() => setAllInOpen(false)}
                />
              </motion.div>
            ) : !selectedTile ? (
              <HostBoardGrid
                categories={categories}
                questions={questions}
                values={values}
                usedQuestions={usedQuestions}
                wildcards={wildcards}
                onSelectTile={selectQuestion}
              />
            ) : (
              <HostQuestionDetails
                selectedTile={selectedTile}
                categoryName={categories[selectedTile.col] ?? ""}
                showAnswer={Boolean(game.showAnswer)}
                wildcard={game.wildcard}
                teams={teams}
                scores={scores}
                topValue={topValue}
                settings={settings}
                hasBuzzes={buzzQueue.length > 0}
                hostForceShowQuestion={Boolean(game.hostForceShowQuestion)}
                onLockInWildcard={lockInWildcard}
                onScoreWildcard={scoreWildcard}
                onToggleForceShow={forceShowQuestion}
                onRevealAnswer={revealAnswer}
                onCancel={cancelQuestion}
                onDone={clearQuestion}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          <HostBuzzerControls
            buzzerUnlocked={Boolean(game.buzzerUnlocked)}
            autoUnlock={autoUnlock}
            onAutoUnlockChange={setAutoUnlock}
            onToggleBuzzer={toggleBuzzer}
            onClearBuzzers={clearBuzzers}
            buzzQueue={buzzQueue}
            teams={teams}
          />

          <HostTeamScores
            teams={teams}
            scores={scores}
            buzzQueue={buzzQueue}
            canUndo={(game.scoreHistory?.length ?? 0) > 0}
            scorePending={scorePending}
            selectedValue={selectedTile?.value || 100}
            wrongPenalty={settings.wrongPenalty}
            stealEnabled={settings.stealEnabled}
            adjust={adjust}
            onAdjustChange={(teamId, value) => setAdjust((a) => ({ ...a, [teamId]: value }))}
            onApplyAdjust={applyAdjust}
            onUpdateScore={updateTeamScore}
            onUndo={undoScore}
          />
        </div>
      </div>

      <EndGameDialog
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={handleEndGame}
      />
    </div>
  );
}
