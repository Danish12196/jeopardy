import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import pb from "@/pb";
import { useGameSubscription } from "@/hooks/useGameSubscription";
import { useBuzzes } from "@/hooks/useBuzzes";
import { buzzGap, buzzPosition } from "@/lib/buzzes";
import { Input } from "@/components/ui/input";
import WildcardPanel from "@/components/host/WildcardPanel";
import AllInPanel, { type AllInState } from "@/components/host/AllInPanel";
import { useWagers } from "@/hooks/useWagers";
import { useLiveConnection } from "@/hooks/useLiveConnection";
import ReconnectingBadge from "@/components/ReconnectingBadge";

import { allInMaxWager, applyDelta, clampWager, pushHistory, restoreSnapshot, revealOrder, scoreOf, type ScoreSnapshot, type TeamScore } from "@/lib/scoring";

export default function GameHost() {
  const { uniqueID } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState<any>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[][]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  const [selectedTile, setSelectedTile] = useState<{
    row: number;
    col: number;
    value: number;
    questionData: any;
  } | null>(null);

  const [showAnswerLocal, setShowAnswerLocal] = useState(false);
  const [autoUnlock, setAutoUnlock] = useState(true);

  const { connected, reloadKey } = useLiveConnection();
  // Server-ordered buzzes for the current round.
  const buzzQueue = useBuzzes(game?.id, game?.buzzRound ?? 0, reloadKey);

  const [markingWildcards, setMarkingWildcards] = useState(false);
  const [allInOpen, setAllInOpen] = useState(false);
  const [adjust, setAdjust] = useState<Record<string, string>>({});
  const allInPhase: string = game?.allInPhase || "";
  const allIn: AllInState = game?.allIn || {};
  const wagers = useWagers(game?.id, !!allInPhase, `${allInPhase}-${reloadKey}`);
  const scores: TeamScore[] = game?.teamScores || [];
  const wildcards: string[] = game?.wildcards || [];

  // Layout calculations
  const cols = Math.max(categories.length, 1);
  const rowCount = Math.max(0, ...questions.map((qs) => qs.length));
  const values = Array.from({ length: rowCount }, (_, i) => (i + 1) * 100);
  // Highest tile on the board, for the Wildcard wager cap.
  const topValue = Math.max(0, ...questions.flat().map((q) => q.value || 0));

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameList = await pb.collection("games").getFullList({
          filter: `uniqueID = "${uniqueID}"`,
        });
        if (gameList.length === 0) {
          navigate("/");
          return;
        }
        const g = gameList[0];
        setGame(g);

        const template = await pb.collection("game_templates").getOne(g.template);
        const categoryRecords = await Promise.all(
          template.categories.map((id: string) =>
            pb.collection("question_categories").getOne(id)
          )
        );

        const allQuestions = await pb
          .collection("questions")
          .getFullList({
            filter: template.questions.map((id: string) => `id="${id}"`).join(" || "),
          });

        const grouped = categoryRecords.map((cat) => {
          return allQuestions
            .filter((q) => q.category === cat.id)
            .sort((a, b) => a.difficulty - b.difficulty)
            .map((q, i) => ({
              id: q.id,
              question: q.question,
              answer: q.answer,
              // The stored value (e.g. from an imported board), else 100, 200, ...
              value: Number(q.value) > 0 ? Number(q.value) : (i + 1) * 100,
            }));
        });

        const teamRecords = await Promise.all(
          g.teams.map((id: string) => pb.collection("teams").getOne(id))
        );

        setCategories(categoryRecords.map((c) => c.name));
        setQuestions(grouped);
        setTeams(
          teamRecords.map((t) => ({
            id: t.id,
            name: t.name,
            score: g.teamScores?.find((ts: any) => ts.id === t.id)?.score || 0,
          }))
        );

        setUsedQuestions(g.answeredQuestions || []);

        if (g.currentActiveQuestion) {
            const flatQs = grouped.flat();
            const active = flatQs.find(q => q.id === g.currentActiveQuestion);
            if (active) {
                // Find row and col for active question
                let foundRow = 0, foundCol = 0, foundVal = 100;
                for(let c=0; c<grouped.length; c++) {
                    const qIdx = grouped[c].findIndex(x => x.id === active.id);
                    if (qIdx !== -1) {
                        foundCol = c;
                        foundRow = qIdx;
                        foundVal = grouped[c][qIdx].value;
                        break;
                    }
                }
                setSelectedTile({ row: foundRow, col: foundCol, value: foundVal, questionData: active });
            }
        }
      } catch (err) {
        console.error("Host fetch error:", err);
      }
    };

    fetchGame();
  }, [uniqueID, navigate]);

  // Live updates, plus a refetch after any reconnect.
  useGameSubscription(game?.id, reloadKey, (updatedGame: any) => {
    setGame(updatedGame);
    setUsedQuestions(updatedGame.answeredQuestions || []);
    setTeams((prevTeams) =>
      prevTeams.map((t) => ({
        ...t,
        score: updatedGame.teamScores?.find((ts: any) => ts.id === t.id)?.score ?? t.score,
      }))
    );
  });

  /** Saves a change to the game and uses the server's copy straight away. */
  const updateGame = async (patch: Record<string, unknown>) => {
    if (!game?.id) return;
    const rec = await pb.collection("games").update(game.id, patch);
    setGame(rec);
    return rec;
  };

  /** Writes new scores and remembers the old ones for Undo. */
  const changeScores = (next: TeamScore[], extra: Record<string, unknown> = {}) =>
    updateGame({
      teamScores: next,
      // Snapshot the Wildcard/All In state too, so Undo also reopens a scored
      // Wildcard or takes back an All In reveal.
      scoreHistory: pushHistory(game?.scoreHistory, { teamScores: scores, wildcard: game?.wildcard ?? null, allIn: game?.allIn ?? null }),
      ...extra,
    });

  const undoScore = async () => {
    const history: ScoreSnapshot[] = game?.scoreHistory || [];
    if (!history.length) return;
    await updateGame({ ...restoreSnapshot(history[history.length - 1]), scoreHistory: history.slice(0, -1) });
  };

  const applyAdjust = async (teamId: string) => {
    const delta = Number(adjust[teamId]);
    if (!Number.isFinite(delta) || delta === 0) return;
    await changeScores(applyDelta(scores, teamId, Math.round(delta)));
    setAdjust((a) => ({ ...a, [teamId]: "" }));
  };

  const toggleWildcard = (questionId: string) =>
    updateGame({ wildcards: wildcards.includes(questionId) ? wildcards.filter((w) => w !== questionId) : [...wildcards, questionId] });

  const selectQuestion = async (row: number, col: number, value: number, questionData: any) => {
    if (markingWildcards) {
      await toggleWildcard(questionData.id);
      return;
    }
    setSelectedTile({ row, col, value, questionData });
    setShowAnswerLocal(false);
    const isWildcard = wildcards.includes(questionData.id);

    if (game?.id) {
      await updateGame({
        currentActiveQuestion: questionData.id,
        showAnswer: false,
        // A Wildcard is played by one team, so the buzzers stay locked.
        buzzerUnlocked: isWildcard ? false : autoUnlock,
        "buzzRound+": 1, // new round: earlier buzzes no longer count
        hostForceShowQuestion: false,
        wildcard: isWildcard ? { question: questionData.id, team: "", wager: null, resolved: false } : null,
      });
    }
  };

  const lockInWildcard = (team: string, wager: number) =>
    updateGame({ wildcard: { ...game.wildcard, team, wager } });

  const scoreWildcard = (correct: boolean) => {
    const w = game.wildcard;
    return changeScores(applyDelta(scores, w.team, correct ? w.wager : -w.wager), { wildcard: { ...w, resolved: true } });
  };

  // All In
  const startAllIn = (a: { category: string; question: string; answer: string }) =>
    updateGame({
      allInPhase: "wager",
      allIn: { ...a, results: {}, order: [], revealed: 0, applied: {} },
      currentActiveQuestion: null,
      buzzerUnlocked: false,
      "buzzRound+": 1,
      wildcard: null,
    });
  const markAllIn = (team: string, correct: boolean) =>
    updateGame({ allIn: { ...allIn, results: { ...(allIn.results || {}), [team]: correct } } });
  const startReveal = () =>
    updateGame({ allInPhase: "reveal", allIn: { ...allIn, order: revealOrder(scores, teams.map((t) => t.id)), revealed: 0, applied: {} } });
  const revealNext = async () => {
    const order = allIn.order || [];
    const revealed = allIn.revealed || 0;
    const team = order[revealed];
    if (!team) return;
    const wager = clampWager(wagers[team] ?? 0, allInMaxWager(scoreOf(scores, team)));
    const delta = allIn.results?.[team] ? wager : -wager;
    await changeScores(applyDelta(scores, team, delta), {
      allIn: { ...allIn, revealed: revealed + 1, applied: { ...(allIn.applied || {}), [team]: delta } },
    });
  };
  const finishGame = () => updateGame({ allInPhase: allInPhase ? "done" : "", gameOver: true, currentActiveQuestion: null, buzzerUnlocked: false });

  const clearQuestion = async () => {
    if (selectedTile && game?.id) {
      const updatedUsed = [...new Set([...usedQuestions, selectedTile.questionData.id])];
      await updateGame({
        currentActiveQuestion: null,
        showAnswer: false,
        buzzerUnlocked: false,
        "buzzRound+": 1,
        answeredQuestions: updatedUsed,
        hostForceShowQuestion: false,
        wildcard: null,
      });
    }
    setSelectedTile(null);
  };

  const toggleBuzzer = async (unlock: boolean) => {
    if (game?.id) {
      await pb.collection("games").update(game.id, {
        buzzerUnlocked: unlock,
        // Opening starts a fresh round; locking keeps the queue on screen.
        ...(unlock ? { "buzzRound+": 1 } : {})
      });
    }
  };

  const revealAnswerLocal = async () => {
    setShowAnswerLocal(true);
    if (game?.id) {
      await pb.collection("games").update(game.id, {
        showAnswer: true,
        buzzerUnlocked: false // Lock buzzers when showing answer
      });
    }
  };

  const updateTeamScore = (teamId: string, value: number) => changeScores(applyDelta(scores, teamId, value));

  const clearBuzzers = async () => {
    if (game?.id) {
      await pb.collection("games").update(game.id, {
        "buzzRound+": 1
      });
    }
  };

  const forceShowQuestion = async () => {
      if (game?.id) {
          await pb.collection("games").update(game.id, {
              hostForceShowQuestion: !game.hostForceShowQuestion
          });
      }
  };

  if (!game) return <div className="p-8 text-foreground bg-background min-h-screen">Loading Host View...</div>;

  // Only the game's host (or a superuser) can change it; say so instead of
  // showing controls that will all fail.
  if (game.host && game.host !== pb.authStore.record?.id) {
    return (
      <div className="min-h-screen bg-background bg-animated-gradient text-foreground flex items-center justify-center p-8">
        <div className="bg-card/60 backdrop-blur-md p-8 rounded-2xl border border-border/50 shadow-xl max-w-md text-center">
          <h1 className="text-2xl font-bold text-accent mb-4">Not your game</h1>
          <p className="text-muted-foreground">Game {uniqueID} belongs to another host. Log in as that host to run it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-animated-gradient text-foreground p-4 md:p-8">
      <ReconnectingBadge show={!connected} />
      <div className="flex justify-between items-center mb-6 bg-card/60 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-md">
        <h1 className="text-2xl md:text-3xl font-bold text-accent drop-shadow-sm">Host Dashboard</h1>
        <div className="text-lg md:text-xl font-semibold">Game Code: <span className="font-mono text-accent bg-black/40 px-3 py-1.5 rounded-lg border border-border/40 tracking-wider shadow-inner">{uniqueID}</span></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Game Board Controls */}
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
              <Button variant="secondary" className="font-bold" onClick={() => { setMarkingWildcards(false); setAllInOpen(true); }}>
                All In
              </Button>
              <Button variant="outline" className="ml-auto" onClick={finishGame}>
                End game
              </Button>
            </div>
          )}
          {markingWildcards && !selectedTile && (
            <p className="text-sm text-accent mb-3 font-semibold">Tap tiles to mark or unmark them as Wildcards. Only you can see the marks.</p>
          )}
          <AnimatePresence mode="wait">
          {(allInOpen || allInPhase) ? (
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
            <motion.div
                key="grid"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="grid gap-1 border-4 border-border bg-card/40 rounded-xl overflow-hidden p-2 shadow-lg"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {categories.map((cat, i) => (
                <div key={i} className="bg-primary text-primary-foreground text-center py-3 font-bold text-xs uppercase border border-border/50 truncate px-2 rounded-sm shadow-sm backdrop-blur-sm">
                  {cat}
                </div>
              ))}
              {Array.from({ length: categories.length * rowCount }).map((_, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const q = questions[col]?.[row];
                const value = q?.value ?? values[row];

                if (!q) {
                    return (
                        <div key={i} className="flex items-center justify-center p-4 border border-border/20 bg-background/20 rounded-sm" />
                    );
                }

                const isUsed = usedQuestions.includes(q.id);
                const isWildcard = wildcards.includes(q.id);

                return (
                  <motion.button
                    key={i}
                    whileHover={!isUsed ? { scale: 1.05, zIndex: 10 } : {}}
                    whileTap={!isUsed ? { scale: 0.95 } : {}}
                    onClick={() => !isUsed && q && selectQuestion(row, col, value, q)}
                    aria-label={`${value}${isWildcard ? " Wildcard" : ""}`}
                    className={`relative flex items-center justify-center py-6 text-xl font-bold border transition-colors rounded-sm ${
                      isWildcard && !isUsed ? "border-accent border-2" : "border-border/50"
                    } ${
                      isUsed ? "bg-card/20 text-muted-foreground cursor-not-allowed" : "bg-tile text-accent hover:bg-accent hover:text-accent-foreground shadow-md cursor-pointer"
                    }`}
                  >
                    {value}
                    {isWildcard && !isUsed && (
                      <span className="absolute top-1 right-1 text-[10px] leading-none bg-accent text-accent-foreground px-1 py-0.5 rounded font-bold">W</span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
                key="details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-card/60 backdrop-blur-xl p-8 rounded-2xl border border-border/50 flex flex-col h-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

              <h2 className="text-3xl font-bold mb-4 text-accent drop-shadow-sm z-10">{selectedTile.value} pts - <span className="text-foreground">{categories[selectedTile.col]}</span></h2>
              <div className="text-2xl mb-6 bg-background/50 p-6 rounded-xl border border-border/50 shadow-inner z-10 font-medium leading-relaxed">
                  {selectedTile.questionData.question}
              </div>

              {/* Host always sees the answer */}
              <div className="text-xl mb-8 text-accent bg-accent/10 p-6 rounded-xl font-bold border-2 border-accent/40 border-dashed z-10 shadow-sm flex flex-col gap-2">
                  <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Answer</span>
                  {selectedTile.questionData.answer}
              </div>

              {game.wildcard?.question === selectedTile.questionData.id && (
                <>
                  <p className="z-10 mb-2 text-sm uppercase tracking-wider font-bold text-accent">Wildcard</p>
                  <WildcardPanel
                    key={game.wildcard.question}
                    wildcard={game.wildcard}
                    teams={teams}
                    scores={scores}
                    topValue={topValue}
                    onLockIn={lockInWildcard}
                    onResult={scoreWildcard}
                  />
                </>
              )}

              {!showAnswerLocal ? (
                  <div className="flex flex-col gap-3 mb-6 z-10">
                      {buzzQueue.length > 0 && (
                          <Button
                            variant="secondary"
                            onClick={forceShowQuestion}
                            className="h-12 text-lg font-bold border-2 border-border/50"
                          >
                             {game.hostForceShowQuestion ? "Hide Question from Players" : "Show Question to Players (After Buzz)"}
                          </Button>
                      )}

                      <Button
                          variant="brand"
                          onClick={revealAnswerLocal}
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
                <Button
                  variant="outline"
                  onClick={() => setSelectedTile(null)}
                  className="flex-1 h-12"
                >
                  Cancel (Don't mark used)
                </Button>
                <Button
                  variant="destructive"
                  onClick={clearQuestion}
                  className="flex-1 h-12 font-bold text-lg"
                >
                  Done (Back to Board)
                </Button>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* Right Side: Buzzers and Scoring */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-lg"
          >
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-2"><span className="text-accent">⚡</span> Buzzer Controls</h3>
                <label className="flex items-center gap-3 text-sm bg-background/50 px-4 py-2 rounded-lg cursor-pointer hover:bg-background/80 transition-colors border border-border/50">
                    <input type="checkbox" checked={autoUnlock} onChange={(e) => setAutoUnlock(e.target.checked)} className="accent-accent w-4 h-4 cursor-pointer" />
                    <span className="font-semibold">Auto-open on select</span>
                </label>
            </div>

            <div className="flex gap-4 mb-6">
                {game.buzzerUnlocked ? (
                <Button onClick={() => toggleBuzzer(false)} variant="secondary" className="flex-1 h-14 text-lg font-bold border-2 border-accent/60 animate-pulse">
                    Lock buzzers
                </Button>
                ) : (
                <Button onClick={() => toggleBuzzer(true)} variant="brand" className="flex-1 h-14 text-lg">
                    Open buzzers
                </Button>
                )}
                <Button onClick={clearBuzzers} variant="secondary" className="flex-1 h-14 text-lg font-bold border-2 border-border/50">
                    Clear Queue
                </Button>
            </div>

            <div className="bg-background/40 p-4 rounded-xl border border-border/40 shadow-inner min-h-[120px]">
                <h4 className="font-bold mb-3 text-muted-foreground uppercase text-xs tracking-wider">Buzz Queue (First to Last)</h4>
                {buzzQueue.length > 0 ? (
                <ol className="list-decimal list-inside space-y-2" data-testid="host-buzz-queue">
                    <AnimatePresence>
                    {buzzQueue.map((q, idx) => {
                        const t = teams.find(t => t.id === q.team);

                        return (
                        <motion.li
                            key={q.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`text-lg p-2 rounded-lg ${idx === 0 ? 'bg-green-900/30 text-green-400 font-bold border border-green-500/30' : 'text-foreground/80'}`}
                        >
                            {t?.name || q.team} {idx > 0 && <span className="text-sm opacity-60 ml-2 font-mono">({buzzGap(buzzQueue, idx)})</span>}
                        </motion.li>
                        );
                    })}
                    </AnimatePresence>
                </ol>
                ) : (
                <div className="flex items-center justify-center h-16 text-muted-foreground italic">No one has buzzed in yet.</div>
                )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-lg flex-1 overflow-y-auto custom-scrollbar"
          >
            <div className="flex justify-between items-center mb-6 gap-3">
              <h3 className="text-2xl font-bold flex items-center gap-2"><span className="text-accent">🏆</span> Teams & Scoring</h3>
              <Button variant="secondary" size="sm" onClick={undoScore} disabled={!(game.scoreHistory?.length > 0)}>
                Undo last score change
              </Button>
            </div>
            <div className="flex flex-col gap-4">
              <AnimatePresence>
              {teams.map((team) => (
                <motion.div
                    key={team.id}
                    layout
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                        buzzQueue[0]?.team === team.id
                        ? 'border-green-500 bg-green-900/10 shadow-[0_0_20px_rgba(74,222,128,0.1)]'
                        : 'border-border/40 bg-background/50'
                    }`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="font-bold text-lg flex items-center gap-3 truncate">
                      <span className="truncate">{team.name}</span>
                      {buzzPosition(buzzQueue, team.id) > 0 && (
                        <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full whitespace-nowrap shadow-sm font-bold">
                          Buzz #{buzzPosition(buzzQueue, team.id)}
                        </span>
                      )}
                    </div>
                    <motion.div
                        key={scoreOf(scores, team.id)}
                        initial={{ scale: 1.2, color: "var(--accent)" }}
                        animate={{ scale: 1, color: "var(--accent)" }}
                        className="text-accent font-mono text-2xl font-bold mt-1"
                        data-testid={`host-score-${team.name}`}
                    >
                        {scoreOf(scores, team.id)}
                    </motion.div>
                  </div>
                  <div className="flex gap-3 shrink-0 items-center">
                    <form
                      className="flex gap-1"
                      onSubmit={(e) => { e.preventDefault(); applyAdjust(team.id); }}
                    >
                      <Input
                        type="number"
                        step={1}
                        value={adjust[team.id] ?? ""}
                        onChange={(e) => setAdjust((a) => ({ ...a, [team.id]: e.target.value }))}
                        placeholder="±pts"
                        aria-label={`Adjust ${team.name}'s score by`}
                        className="w-20 h-10 bg-background"
                      />
                      <Button type="submit" size="sm" variant="secondary" className="h-10" aria-label={`Apply adjustment to ${team.name}`}>
                        Apply
                      </Button>
                    </form>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateTeamScore(team.id, selectedTile?.value || 100)}
                      aria-label={`Correct: add points to ${team.name}`}
                      className="bg-green-600 hover:bg-green-500 text-white w-14 h-14 rounded-full font-bold flex items-center justify-center shadow-lg text-2xl transition-colors"
                    >
                      +
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateTeamScore(team.id, -(selectedTile?.value || 100))}
                      aria-label={`Wrong: take points from ${team.name}`}
                      className="bg-destructive hover:bg-destructive/80 text-white w-14 h-14 rounded-full font-bold flex items-center justify-center shadow-lg text-2xl transition-colors"
                    >
                      −
                    </motion.button>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
