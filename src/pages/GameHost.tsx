import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import pb from "@/pb";

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

  // Layout calculations
  const cols = Math.max(categories.length, 1);
  const rowCount = Math.max(0, ...questions.map((qs) => qs.length));
  const values = Array.from({ length: rowCount }, (_, i) => (i + 1) * 100);

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
              value: (i + 1) * 100,
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
            hasBuzzed: g.buzzerQueue?.some((q: any) => q.teamId === t.id) || false,
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

  useEffect(() => {
    if (!game?.id) return;

    const sub = async () => {
      await pb.collection("games").subscribe(game.id, (event) => {
        const updatedGame = event.record;
        setGame(updatedGame);
        setUsedQuestions(updatedGame.answeredQuestions || []);

        setTeams((prevTeams) =>
          prevTeams.map((t) => ({
            ...t,
            score: updatedGame.teamScores?.find((ts: any) => ts.id === t.id)?.score ?? t.score,
            hasBuzzed: updatedGame.buzzerQueue?.some((q: any) => q.teamId === t.id) || false,
          }))
        );
      });
    };
    sub();

    return () => {
      pb.collection("games").unsubscribe(game.id);
    };
  }, [game?.id]);

  const selectQuestion = async (row: number, col: number, value: number, questionData: any) => {
    setSelectedTile({ row, col, value, questionData });
    setShowAnswerLocal(false);

    if (game?.id) {
      await pb.collection("games").update(game.id, {
        currentActiveQuestion: questionData.id,
        showAnswer: false,
        buzzerUnlocked: autoUnlock,
        buzzerQueue: [],
        hostForceShowQuestion: false
      });
    }
  };

  const clearQuestion = async () => {
    if (selectedTile && game?.id) {
      const updatedUsed = [...new Set([...usedQuestions, selectedTile.questionData.id])];
      await pb.collection("games").update(game.id, {
        currentActiveQuestion: null,
        showAnswer: false,
        buzzerUnlocked: false,
        buzzerQueue: [],
        answeredQuestions: updatedUsed,
        hostForceShowQuestion: false
      });
    }
    setSelectedTile(null);
  };

  const toggleBuzzer = async (unlock: boolean) => {
    if (game?.id) {
      await pb.collection("games").update(game.id, {
        buzzerUnlocked: unlock,
        ...(unlock ? { buzzerQueue: [] } : {})
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

  const updateTeamScore = async (teamId: string, value: number) => {
    if (!game?.id) return;

    const newTeams = teams.map((t) =>
      t.id === teamId ? { ...t, score: t.score + value } : t
    );

    setTeams(newTeams);
    await pb.collection("games").update(game.id, {
      teamScores: newTeams.map((t) => ({ id: t.id, score: t.score })),
    });
  };

  const clearBuzzers = async () => {
    if (game?.id) {
      await pb.collection("games").update(game.id, {
        buzzerQueue: []
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

  return (
    <div className="min-h-screen bg-background bg-animated-gradient text-foreground p-4 md:p-8">
      <div className="flex justify-between items-center mb-6 bg-card/60 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-md">
        <h1 className="text-2xl md:text-3xl font-bold text-accent drop-shadow-sm">Host Dashboard</h1>
        <div className="text-lg md:text-xl font-semibold">Game Code: <span className="font-mono text-accent bg-black/40 px-3 py-1.5 rounded-lg border border-border/40 tracking-wider shadow-inner">{uniqueID}</span></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Game Board Controls */}
        <div className="w-full lg:w-1/2 flex flex-col min-h-[60vh]">
          <AnimatePresence mode="wait">
          {!selectedTile ? (
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
                const value = values[row];
                const q = questions[col]?.[row];

                if (!q) {
                    return (
                        <div key={i} className="flex items-center justify-center p-4 border border-border/20 bg-background/20 rounded-sm" />
                    );
                }

                const isUsed = usedQuestions.includes(q.id);

                return (
                  <motion.button
                    key={i}
                    whileHover={!isUsed ? { scale: 1.05, zIndex: 10 } : {}}
                    whileTap={!isUsed ? { scale: 0.95 } : {}}
                    onClick={() => !isUsed && q && selectQuestion(row, col, value, q)}
                    className={`flex items-center justify-center py-6 text-xl font-bold border border-border/50 transition-colors rounded-sm ${
                      isUsed ? "bg-card/20 text-muted-foreground cursor-not-allowed" : "bg-primary/80 text-accent hover:bg-accent hover:text-accent-foreground shadow-md cursor-pointer"
                    }`}
                  >
                    ${value}
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

              <h2 className="text-3xl font-bold mb-4 text-accent drop-shadow-sm z-10">${selectedTile.value} - <span className="text-foreground">{categories[selectedTile.col]}</span></h2>
              <div className="text-2xl mb-6 bg-background/50 p-6 rounded-xl border border-border/50 shadow-inner z-10 font-medium leading-relaxed">
                  {selectedTile.questionData.question}
              </div>

              {/* Host always sees the answer */}
              <div className="text-xl mb-8 text-accent bg-accent/10 p-6 rounded-xl font-bold border-2 border-accent/40 border-dashed z-10 shadow-sm flex flex-col gap-2">
                  <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Answer</span>
                  {selectedTile.questionData.answer}
              </div>

              {!showAnswerLocal ? (
                  <div className="flex flex-col gap-3 mb-6 z-10">
                      {game.buzzerQueue?.length > 0 && (
                          <Button
                            variant="secondary"
                            onClick={forceShowQuestion}
                            className="h-12 text-lg font-bold border-2 border-border/50"
                          >
                             {game.hostForceShowQuestion ? "Hide Question from Players" : "Show Question to Players (After Buzz)"}
                          </Button>
                      )}

                      <Button
                          variant="jeopardy"
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
                    <span className="font-semibold">Auto-unlock on Select</span>
                </label>
            </div>

            <div className="flex gap-4 mb-6">
                {game.buzzerUnlocked ? (
                <Button onClick={() => toggleBuzzer(false)} variant="destructive" className="flex-1 h-14 text-lg font-bold shadow-[0_0_15px_rgba(var(--destructive),0.5)] animate-pulse">
                    LOCK Buzzers
                </Button>
                ) : (
                <Button onClick={() => toggleBuzzer(true)} className="flex-1 h-14 text-lg font-bold bg-green-600 hover:bg-green-500 text-white shadow-[0_0_15px_rgba(74,222,128,0.3)]">
                    UNLOCK Buzzers
                </Button>
                )}
                <Button onClick={clearBuzzers} variant="secondary" className="flex-1 h-14 text-lg font-bold border-2 border-border/50">
                    Clear Queue
                </Button>
            </div>

            <div className="bg-background/40 p-4 rounded-xl border border-border/40 shadow-inner min-h-[120px]">
                <h4 className="font-bold mb-3 text-muted-foreground uppercase text-xs tracking-wider">Buzz Queue (First to Last)</h4>
                {game.buzzerQueue?.length > 0 ? (
                <ol className="list-decimal list-inside space-y-2">
                    <AnimatePresence>
                    {game.buzzerQueue.map((q: any, idx: number) => {
                        const t = teams.find(t => t.id === q.teamId);
                        const timeDiff = idx === 0 ? 0 : (q.time - game.buzzerQueue[0].time) / 1000;

                        return (
                        <motion.li
                            key={q.teamId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`text-lg p-2 rounded-lg ${idx === 0 ? 'bg-green-900/30 text-green-400 font-bold border border-green-500/30' : 'text-foreground/80'}`}
                        >
                            {t?.name || q.teamId} {idx > 0 && <span className="text-sm opacity-60 ml-2 font-mono">(+{timeDiff.toFixed(2)}s)</span>}
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
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2"><span className="text-accent">🏆</span> Teams & Scoring</h3>
            <div className="flex flex-col gap-4">
              <AnimatePresence>
              {teams.map((team) => (
                <motion.div
                    key={team.id}
                    layout
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                        game.buzzerQueue?.[0]?.teamId === team.id
                        ? 'border-green-500 bg-green-900/10 shadow-[0_0_20px_rgba(74,222,128,0.1)]'
                        : 'border-border/40 bg-background/50'
                    }`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="font-bold text-lg flex items-center gap-3 truncate">
                      <span className="truncate">{team.name}</span>
                      {game.buzzerQueue?.some((q: any) => q.teamId === team.id) && (
                        <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full whitespace-nowrap shadow-sm font-bold">
                          Buzz #{game.buzzerQueue.findIndex((q: any) => q.teamId === team.id) + 1}
                        </span>
                      )}
                    </div>
                    <motion.div
                        key={team.score}
                        initial={{ scale: 1.2, color: "var(--accent)" }}
                        animate={{ scale: 1, color: "var(--accent)" }}
                        className="text-accent font-mono text-2xl font-bold mt-1"
                    >
                        ${team.score}
                    </motion.div>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateTeamScore(team.id, selectedTile?.value || 100)}
                      className="bg-green-600 hover:bg-green-500 text-white w-14 h-14 rounded-full font-bold flex items-center justify-center shadow-lg text-2xl transition-colors"
                    >
                      +
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateTeamScore(team.id, -(selectedTile?.value || 100))}
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
