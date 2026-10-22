import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import pb from "@/pb";

export default function GameBoard() {
  const { uniqueID } = useParams();

  const [categories, setCategories] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[][]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; score: number }[]>([]);

  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);

  // Board size follows the template: one column per category, one row per question.
  const cols = Math.max(categories.length, 1);
  const rowCount = Math.max(0, ...questions.map((qs) => qs.length));
  const values = Array.from({ length: rowCount }, (_, i) => (i + 1) * 100);

  const [activeQuestion, setActiveQuestion] = useState<any | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [buzzedTeamName, setBuzzedTeamName] = useState<string | null>(null);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameList = await pb.collection("games").getFullList({
          filter: `uniqueID = "${uniqueID}"`,
        });
        if (gameList.length === 0) return;
        const g = gameList[0];
        setGameId(g.id);

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

        const mappedTeams = teamRecords.map((t) => ({
          id: t.id,
          name: t.name,
          score: g.teamScores?.find((ts: any) => ts.id === t.id)?.score || 0,
        }));

        setTeams(mappedTeams);
        setUsedQuestions(g.answeredQuestions || []);

        if (g.currentActiveQuestion) {
          const flatQs = grouped.flat();
          const active = flatQs.find(q => q.id === g.currentActiveQuestion);
          if (active) setActiveQuestion(active);
        }
        setShowAnswer(g.showAnswer || false);

        if (g.buzzerQueue && g.buzzerQueue.length > 0) {
            const firstId = g.buzzerQueue[0];
            const t = mappedTeams.find(tm => tm.id === firstId);
            if (t) setBuzzedTeamName(t.name);
        }

      } catch (err) {
        console.error("Board fetch error:", err);
      }
    };

    fetchGame();
  }, [uniqueID]);

  useEffect(() => {
    if (!gameId) return;

    const sub = async () => {
      await pb.collection("games").subscribe(gameId, (event) => {
        const g = event.record;

        setUsedQuestions(g.answeredQuestions || []);
        setShowAnswer(g.showAnswer || false);

        setTeams((prev) =>
          prev.map((t) => ({
            ...t,
            score: g.teamScores?.find((ts: any) => ts.id === t.id)?.score ?? t.score,
          }))
        );

        if (g.buzzerQueue && g.buzzerQueue.length > 0) {
            setTeams(prevTeams => {
                const firstId = g.buzzerQueue[0];
                const t = prevTeams.find(tm => tm.id === firstId);
                if (t) setBuzzedTeamName(t.name);
                return prevTeams;
            });
        } else {
            setBuzzedTeamName(null);
        }

        if (g.currentActiveQuestion) {
          setQuestions((prevQs) => {
            const flatQs = prevQs.flat();
            const active = flatQs.find((q) => q.id === g.currentActiveQuestion);
            if (active) setActiveQuestion(active);
            return prevQs;
          });
        } else {
          setActiveQuestion(null);
        }
      });
    };

    sub();
    return () => {
      pb.collection("games").unsubscribe(gameId);
    };
  }, [gameId]);

  return (
    <div className="min-h-screen flex flex-col bg-blue-950 text-white p-8">
      {/* Scoreboard at Top */}
      <div className="flex justify-center gap-8 mb-8">
        {teams.map((team) => (
          <div key={team.id} className="bg-blue-900 border-2 border-blue-400 rounded-lg px-8 py-4 text-center shadow-lg w-48">
            <h2 className="font-bold text-2xl mb-2 truncate" title={team.name}>{team.name}</h2>
            <p className="text-yellow-400 text-4xl font-mono">${team.score}</p>
          </div>
        ))}
      </div>

      {/* Main Board Area */}
      <div className="flex-1 flex items-center justify-center">
        {!activeQuestion ? (
          <div className="grid gap-2 w-full max-w-7xl h-[70vh]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {categories.map((cat, i) => (
              <div key={`cat-${i}`} className="bg-blue-800 flex items-center justify-center text-center p-2 font-bold text-2xl uppercase border-4 border-black shadow-inner shadow-blue-500">
                {cat}
              </div>
            ))}
            {Array.from({ length: categories.length * values.length }).map((_, i) => {
              const row = Math.floor(i / cols);
              const col = i % cols;
              const value = values[row];
              const q = questions[col]?.[row];
              const isUsed = usedQuestions.includes(q?.id || "");

              return (
                <div
                  key={q?.id || i}
                  className={`flex items-center justify-center text-center p-4 text-5xl font-bold font-mono border-4 border-black transition-all duration-500 ${
                    isUsed ? "bg-blue-950 text-blue-950/50" : "bg-blue-700 text-yellow-400 shadow-inner shadow-blue-400"
                  }`}
                >
                  {!isUsed && `$${value}`}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full h-[70vh] bg-blue-800 border-8 border-black shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center p-12 text-center animate-in zoom-in duration-500">

             {buzzedTeamName && !showAnswer && (
                 <div className="absolute top-1/4 bg-yellow-500 text-black px-8 py-4 rounded-full text-3xl font-bold shadow-2xl animate-bounce">
                     🎤 {buzzedTeamName} buzzed in!
                 </div>
             )}

            <h1 className="text-6xl font-bold leading-tight mb-12 max-w-5xl">
              {activeQuestion.question}
            </h1>

            {showAnswer && (
              <div className="text-5xl font-bold text-yellow-400 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {activeQuestion.answer}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
