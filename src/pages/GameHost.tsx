import { useEffect, useState } from "react";
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
import { brandingStyleVars } from "@/lib/branding";
import { saveLocalSoundPrefs } from "@/lib/sound";
import { HOST_SHORTCUTS, resolveHostShortcut } from "@/lib/shortcuts";
import HostModePanel from "@/components/host/HostModePanel";
import { activeTeamIds, isTopTied, lowestScoringTeam, normalizeGameMode } from "@/lib/gameModes";

export default function GameHost({ solo = false }: { solo?: boolean } = {}) {
  const { uniqueID } = useParams();
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
    startTimer,
    pauseTimer,
    resumeTimer,
    clearTimer,
    answers,
    autoScoreAnswers,
    pendingRegistrations,
    approveRegistration,
    rejectRegistration,
    togglePause,
    reopenQuestion,
    editActiveQuestion,
    toggleLockTeam,
    kickTeam,
    ensureCohostCode,
    startNextRound,
    eliminateLowestTeam,
    startTiebreaker,
    revealTiebreaker,
    endTiebreaker,
  } = useHostGame(uniqueID);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = resolveHostShortcut({
        key: e.key,
        targetTag: (e.target as HTMLElement | null)?.tagName,
        hasActiveQuestion: Boolean(selectedTile),
        isModalOpen: shortcutsOpen,
      });
      if (!action) return;
      if (action === "toggleBuzzer") {
        e.preventDefault();
        void toggleBuzzer(!game?.buzzerUnlocked);
      } else if (action === "revealAnswer") {
        void revealAnswer();
      } else if (action === "doneQuestion") {
        void clearQuestion();
      } else if (action === "clearBuzzers") {
        void clearBuzzers();
      } else if (action === "togglePause") {
        void togglePause();
      } else if (action === "toggleHelp") {
        setShortcutsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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
    <div style={brandingStyleVars(settings.branding)} className="min-h-screen bg-background bg-animated-gradient text-foreground p-4 md:p-8">
      <ReconnectingBadge show={!connected} />
      <HostHeader
        uniqueID={uniqueID}
        onCopyError={setActionError}
        soundMuted={Boolean(settings.sound?.muted)}
        onToggleSound={() => {
          const nextMuted = !settings.sound?.muted;
          saveLocalSoundPrefs({ muted: nextMuted });
          void updateGame({
            settings: {
              ...settings,
              sound: { ...settings.sound, muted: nextMuted },
            },
          });
        }}
        paused={Boolean(game.paused)}
        onTogglePause={() => void togglePause()}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onCopyCohostLink={async () => {
          try {
            const code = await ensureCohostCode();
            if (!code) return;
            const url = `${window.location.origin}/game/${uniqueID}/host?cohost=${code}`;
            await navigator.clipboard.writeText(url);
          } catch {
            setActionError("Could not copy co-host link to clipboard.");
          }
        }}
      />

      {solo && (
        <div
          className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent"
          data-testid="solo-banner"
        >
          Solo mode: run the whole game from this single screen. Use + / − to score each question.
        </div>
      )}

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
                onReopenTile={reopenQuestion}
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
                answers={answers}
                onAutoScoreAnswers={autoScoreAnswers}
                hostForceShowQuestion={Boolean(game.hostForceShowQuestion)}
                onLockInWildcard={lockInWildcard}
                onScoreWildcard={scoreWildcard}
                onToggleForceShow={forceShowQuestion}
                onRevealAnswer={revealAnswer}
                onCancel={cancelQuestion}
                onDone={clearQuestion}
                onEditQuestion={editActiveQuestion}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          {!solo && (
          <HostBuzzerControls
            buzzerUnlocked={Boolean(game.buzzerUnlocked)}
            autoUnlock={autoUnlock}
            onAutoUnlockChange={setAutoUnlock}
            onToggleBuzzer={toggleBuzzer}
            onClearBuzzers={clearBuzzers}
            buzzQueue={buzzQueue}
            teams={teams}
            timerEndsAt={game.timerEndsAt}
            timerType={game.timerType}
            timerPausedRemaining={game.timerPausedRemaining}
            answerTimerSeconds={settings.answerTimerSeconds}
            onStartTimer={startTimer}
            onPauseTimer={pauseTimer}
            onResumeTimer={resumeTimer}
            onClearTimer={clearTimer}
          />
          )}

          {!solo && pendingRegistrations.length > 0 && (
            <div className="bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-accent/40 shadow-lg space-y-2" data-testid="host-team-requests">
              <h3 className="text-sm uppercase tracking-wider font-bold text-accent">
                Team Join Requests ({pendingRegistrations.length})
              </h3>
              {pendingRegistrations.map((reg) => (
                <div key={reg.id} className="flex items-center justify-between gap-2 bg-background/50 px-3 py-2 rounded-lg">
                  <div className="min-w-0">
                    <div className="font-bold truncate">
                      {reg.emoji ? `${reg.emoji} ` : ""}{reg.name}
                    </div>
                    {reg.members && reg.members.length > 0 && (
                      <div className="text-xs text-muted-foreground truncate">{reg.members.join(", ")}</div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="brand" onClick={() => void approveRegistration(reg)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void rejectRegistration(reg)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <HostModePanel
            mode={normalizeGameMode(settings.gameMode)}
            round={game.round ?? 1}
            eliminatedNames={teams.filter((t) => (game.eliminatedTeams ?? []).includes(t.id)).map((t) => t.name)}
            canEliminate={lowestScoringTeam(game.teams ?? [], scores, game.eliminatedTeams) !== null}
            topTied={isTopTied(activeTeamIds(game.teams ?? [], game.eliminatedTeams), scores)}
            tiebreaker={game.tiebreaker}
            onNextRound={() => void startNextRound()}
            onEliminateLowest={() => void eliminateLowestTeam()}
            onStartTiebreaker={(q, a) => void startTiebreaker(q, a)}
            onRevealTiebreaker={() => void revealTiebreaker()}
            onEndTiebreaker={() => void endTiebreaker()}
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
            lockedTeams={game.lockedTeams ?? []}
            onToggleLock={toggleLockTeam}
            onKickTeam={kickTeam}
          />
        </div>
      </div>

      <EndGameDialog
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={handleEndGame}
      />

      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="shortcuts-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard Shortcuts"
        >
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Keyboard Shortcuts</h2>
              <Button variant="ghost" size="sm" onClick={() => setShortcutsOpen(false)}>
                Close
              </Button>
            </div>
            <div className="space-y-2">
              {HOST_SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">{s.label}</span>
                  <kbd className="px-2 py-0.5 rounded bg-background border border-border font-mono text-xs font-bold">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
