import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import pb from "@/pb";

export default function GameHost() {
  const { uniqueID } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[][]>([]);

  const [values] = useState([100, 200, 300, 400, 500]);
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);

  // Local state for host
  const [selectedTile, setSelectedTile] = useState<{
    row: number;
    col: number;
    value: number;
    questionData: any;
  } | null>(null);

  const [showAnswerLocal, setShowAnswerLocal] = useState(false);

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
            .slice(0, 5)
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

        // Use latest scores from game or fallback to team initial score
        setTeams(
          teamRecords.map((t) => ({
            id: t.id,
            name: t.name,
            score: g.teamScores?.find((ts: any) => ts.id === t.id)?.score || 0,
            hasBuzzed: g.buzzerQueue?.includes(t.id) || false,
          }))
        );

        setUsedQuestions(g.answeredQuestions || []);
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
            hasBuzzed: updatedGame.buzzerQueue?.includes(t.id) || false,
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
        buzzerUnlocked: false,
        buzzerQueue: []
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
        answeredQuestions: updatedUsed
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
            <div className="grid grid-cols-6 gap-1 border border-yellow-400">
              {categories.map((cat, i) => (
                <div key={i} className="bg-blue-800 text-center py-2 font-bold text-xs uppercase border border-yellow-400 truncate px-1">
                  {cat}
                </div>
              ))}
              {Array.from({ length: categories.length * values.length }).map((_, i) => {
                const row = Math.floor(i / 6);
                const col = i % 6;
                const value = values[row];
                const q = questions[col]?.[row];
                const isUsed = usedQuestions.includes(q?.id || "");

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

              {!showAnswerLocal ? (
                <button
                  className="bg-yellow-400 text-black py-2 px-4 rounded font-bold hover:bg-yellow-500 mb-4"
                  onClick={revealAnswerLocal}
                >
                  Reveal Answer on Board
                </button>
              ) : (
                <div className="text-xl mb-4 text-yellow-300 bg-blue-950 p-4 rounded font-bold">
                  Answer: {selectedTile.questionData.answer}
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
          {selectedTile && (
             <div className="bg-gray-800 p-4 rounded border border-gray-600">
                <h3 className="text-xl font-bold mb-4">Buzzer Controls</h3>
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
                      {game.buzzerQueue.map((teamId: string, idx: number) => {
                         const t = teams.find(t => t.id === teamId);
                         return (
                           <li key={teamId} className={`text-lg ${idx === 0 ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                             {t?.name || teamId}
                           </li>
                         );
                      })}
                    </ol>
                  ) : (
                    <p className="text-gray-500 italic">No one has buzzed in yet.</p>
                  )}
                </div>
             </div>
          )}

          <div className="bg-blue-900 p-4 rounded border border-blue-700 flex-1 overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Teams & Scoring</h3>
            <div className="flex flex-col gap-3">
              {teams.map((team) => (
                <div key={team.id} className={`flex items-center justify-between p-3 rounded border ${game.buzzerQueue?.[0] === team.id ? 'border-green-400 bg-blue-800' : 'border-blue-700 bg-blue-950'}`}>
                  <div>
                    <div className="font-bold text-lg flex items-center gap-2">
                      {team.name}
                      {game.buzzerQueue?.includes(team.id) && (
                        <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full">
                          Buzzed #{game.buzzerQueue.indexOf(team.id) + 1}
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
