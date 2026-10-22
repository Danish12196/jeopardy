import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

  if (!game) return <div className="p-8 text-white">Loading Host View...</div>;

  return (
    <div className="min-h-screen bg-blue-950 text-white p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-yellow-400">Host Dashboard</h1>
        <div className="text-xl">Game Code: <span className="font-mono font-bold bg-gray-800 px-2 py-1 rounded">{uniqueID}</span></div>
      </div>

      <div className="flex gap-4">
        {/* Left Side: Game Board Controls */}
        <div className="w-1/2 flex flex-col">
          {!selectedTile ? (
            <div className="grid gap-1 border border-yellow-400" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {categories.map((cat, i) => (
                <div key={i} className="bg-blue-800 text-center py-2 font-bold text-xs uppercase border border-yellow-400 truncate px-1">
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
                        <div key={i} className="flex items-center justify-center p-4 border border-yellow-400/50 bg-blue-950/20" />
                    );
                }

                const isUsed = usedQuestions.includes(q.id);

                return (
                  <div
                    key={i}
                    onClick={() => !isUsed && q && selectQuestion(row, col, value, q)}
                    className={`flex items-center justify-center py-4 text-lg font-bold border border-yellow-400 cursor-pointer ${
                      isUsed ? "bg-gray-800 text-gray-600" : "bg-blue-900 text-yellow-300 hover:bg-yellow-500 hover:text-black"
                    }`}
                  >
                    ${value}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-blue-900 p-6 rounded border border-yellow-400 flex flex-col h-full">
              <h2 className="text-2xl font-bold mb-2">${selectedTile.value} - {categories[selectedTile.col]}</h2>
              <div className="text-xl mb-4 bg-blue-950 p-4 rounded">{selectedTile.questionData.question}</div>

              {/* Host always sees the answer */}
              <div className="text-xl mb-4 text-yellow-300 bg-blue-950 p-4 rounded font-bold border border-yellow-400 border-dashed">
                  Answer: {selectedTile.questionData.answer}
              </div>

              {!showAnswerLocal ? (
                  <div className="flex flex-col gap-2 mb-4">
                      {game.buzzerQueue?.length > 0 && (
                          <button
                            className="bg-blue-600 text-white py-2 px-4 rounded font-bold hover:bg-blue-500"
                            onClick={forceShowQuestion}
                          >
                             {game.hostForceShowQuestion ? "Hide Question from Players" : "Show Question to Players (After Buzz)"}
                          </button>
                      )}

                      <button
                          className="bg-yellow-400 text-black py-2 px-4 rounded font-bold hover:bg-yellow-500"
                          onClick={revealAnswerLocal}
                      >
                          Reveal Answer on Board
                      </button>
                  </div>
              ) : (
                <div className="text-md mb-4 text-gray-300 italic">
                  Answer is currently revealed on the board.
                </div>
              )}

              <div className="flex gap-2 mt-auto">
                <button
                  className="bg-gray-600 py-2 px-4 rounded hover:bg-gray-700 w-full"
                  onClick={() => setSelectedTile(null)}
                >
                  Cancel (Don't mark used)
                </button>
                <button
                  className="bg-red-600 py-2 px-4 rounded hover:bg-red-700 w-full font-bold"
                  onClick={clearQuestion}
                >
                  Done (Back to Board)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Buzzers and Scoring */}
        <div className="w-1/2 flex flex-col gap-4">
          <div className="bg-gray-800 p-4 rounded border border-gray-600">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Buzzer Controls</h3>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={autoUnlock} onChange={(e) => setAutoUnlock(e.target.checked)} />
                    Auto-unlock on Question Selection
                </label>
            </div>

            <div className="flex gap-4">
                {game.buzzerUnlocked ? (
                <button onClick={() => toggleBuzzer(false)} className="bg-red-500 px-4 py-3 rounded font-bold w-full text-lg animate-pulse">
                    LOCK Buzzers
                </button>
                ) : (
                <button onClick={() => toggleBuzzer(true)} className="bg-green-500 px-4 py-3 rounded font-bold w-full text-lg">
                    UNLOCK Buzzers
                </button>
                )}
                <button onClick={clearBuzzers} className="bg-gray-600 px-4 py-3 rounded font-bold w-full text-lg hover:bg-gray-500">
                Clear Buzzers
                </button>
            </div>

            <div className="mt-4">
                <h4 className="font-bold mb-2">Buzz Queue (First to Last):</h4>
                {game.buzzerQueue?.length > 0 ? (
                <ol className="list-decimal list-inside bg-gray-900 p-3 rounded">
                    {game.buzzerQueue.map((q: any, idx: number) => {
                        const t = teams.find(t => t.id === q.teamId);
                        const timeDiff = idx === 0 ? 0 : (q.time - game.buzzerQueue[0].time) / 1000;

                        return (
                        <li key={q.teamId} className={`text-lg ${idx === 0 ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                            {t?.name || q.teamId} {idx > 0 && <span className="text-xs opacity-75">(+{timeDiff.toFixed(2)}s)</span>}
                        </li>
                        );
                    })}
                </ol>
                ) : (
                <p className="text-gray-500 italic">No one has buzzed in yet.</p>
                )}
            </div>
          </div>

          <div className="bg-blue-900 p-4 rounded border border-blue-700 flex-1 overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Teams & Scoring</h3>
            <div className="flex flex-col gap-3">
              {teams.map((team) => (
                <div key={team.id} className={`flex items-center justify-between p-3 rounded border ${game.buzzerQueue?.[0]?.teamId === team.id ? 'border-green-400 bg-blue-800' : 'border-blue-700 bg-blue-950'}`}>
                  <div>
                    <div className="font-bold text-lg flex items-center gap-2">
                      {team.name}
                      {game.buzzerQueue?.some((q: any) => q.teamId === team.id) && (
                        <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full">
                          Buzzed #{game.buzzerQueue.findIndex((q: any) => q.teamId === team.id) + 1}
                        </span>
                      )}
                    </div>
                    <div className="text-yellow-400 font-mono text-xl">${team.score}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateTeamScore(team.id, selectedTile?.value || 100)}
                      className="bg-green-600 hover:bg-green-500 text-white w-12 h-12 rounded-full font-bold flex items-center justify-center shadow-lg"
                    >
                      +
                    </button>
                    <button
                      onClick={() => updateTeamScore(team.id, -(selectedTile?.value || 100))}
                      className="bg-red-600 hover:bg-red-500 text-white w-12 h-12 rounded-full font-bold flex items-center justify-center shadow-lg"
                    >
                      -
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
