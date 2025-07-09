"use client";

import { use, useEffect, useState } from "react";
import superuserClient from "@/super-user.js";

export default function GamePage() {
  const [showAnswer, setShowAnswer] = useState(false);
  const [teams, setTeams] = useState<
    { id: string; name: string; score: number; isActive: boolean }[]
  >([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [questions, setQuestions] = useState<
    { id: string; value: number; question: string; answer: string }[][]
  >([]);

  const [values] = useState([100, 200, 300, 400, 500]);
  const [currentTeam, setCurrentTeam] = useState<string | null>(null);
  const [currentTeamScore, setCurrentTeamScore] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  const [selectedTile, setSelectedTile] = useState<{
    row: number;
    col: number;
    value: number;
  } | null>(null);
  const stored = localStorage.getItem("game-id");
  const gameId = stored || "schbbutohntka8j";
  var teamRecords: any[] = [];

  useEffect(() => {
    const getGameInfo = async () => {
      const stored = localStorage.getItem("game-id");
      const gameId = stored || "schbbutohntka8j";

      const game = await superuserClient.collection("games").getOne(gameId);
      console.log("Game data:", game);
      const template = await superuserClient
        .collection("game_templates")
        .getOne(game.template);

      const categoryRecords = await Promise.all(
        template.categories.map((id: string) =>
          superuserClient.collection("question_categories").getOne(id)
        )
      );

      const allQuestions = await superuserClient
        .collection("questions")
        .getFullList({
          filter: template.questions
            .map((id: string) => `id="${id}"`)
            .join(" || "),
        });

      // Group and sort questions by difficulty (1–10 → 100–500)
      const grouped: {
        id: string;
        value: number;
        question: string;
        answer: string;
      }[][] = categoryRecords.map((cat) => {
        const qs = allQuestions
          .filter((q) => q.category === cat.id)
          .sort((a, b) => a.difficulty - b.difficulty)
          .slice(0, 5)
          .map((q, i) => ({
            id: q.id,
            question: q.question,
            answer: q.answer,
            value: (i + 1) * 100,
          }));

        return qs;
      });

      teamRecords = await Promise.all(
        game.teams.map((id: string) =>
          superuserClient.collection("teams").getOne(id)
        )
      );

      setCategories(categoryRecords.map((c) => c.name));
      setQuestions(grouped);
      setTeams(
        teamRecords.map((t) => ({
          id: t.id,
          name: t.name,
          score: game.teamScores.find((ts: any) => ts.id === t.id)?.score || 0,
          isActive: false,
        }))
      );
      setUsedQuestions(game.answeredQuestions || []);
    };

    getGameInfo();
  }, []);

  useEffect(() => {
    if (!selectedTile) {
      // superuserClient.collection("games").update(gameId, {
      //   currentActiveQuestion: null,
      // });
    } else {
      const currentQuestion =
        selectedTile && questions[selectedTile.col]?.[selectedTile.row];

      superuserClient.collection("games").update(gameId, {
        currentActiveQuestion: currentQuestion?.id || null,
      });
    }
  }, [selectedTile]);

  const subscribeToEvents = async () => {
    await superuserClient
      .collection("games")
      .subscribe(gameId, function (event) {
        console.log("Game event received:");
        console.log(event.action);
        console.log(event.record);
        const game = event.record;
        setUsedQuestions(game.answeredQuestions);
        // After questions and categories are already set
        // if (game.currentActiveQuestion) {
        //   for (let col = 0; col < questions.length; col++) {
        //     for (let row = 0; row < questions[col].length; row++) {
        //       const q = questions[col][row];
        //       if (q.id === game.currentActiveQuestion) {
        //         setSelectedTile({ row, col, value: q.value });
        //         return;
        //       }
        //     }
        //   }
        // }
        console.log("Teams:", game.teamScores);
        console.log("Team records:", teamRecords);
        // setTeams(
        //   teamRecords.map((t) => ({
        //     id: t.id,
        //     name: t.name,
        //     score:
        //       game.teamScores.find((ts: any) => ts.id === t.id)?.score || 0,
        //     isActive: false,
        //   }))
        // );
      });
  };
  subscribeToEvents();

  const updateUsedQuestions = async (row: number, col: number) => {
    const questionId = questions[col]?.[row]?.id;
    if (!questionId || usedQuestions.includes(questionId)) return;

    const updated = [...usedQuestions, questionId];
    setUsedQuestions(updated);

    try {
      await superuserClient.collection("games").update(gameId, {
        answeredQuestions: updated,
      });
    } catch (err) {
      console.error("Failed to update usedQuestions in DB:", err);
    }
  };

  const updateTeamScore = async (teamIndex: number, value: number) => {
    const newTeams = [...teams];
    newTeams[teamIndex].score += value;
    setTeams(newTeams);
    console.log("Updated team scores:", newTeams);
    try {
      await superuserClient.collection("games").update(gameId, {
        teamScores: newTeams.map((t) => ({ id: t.id, score: t.score })),
      });
    } catch (err) {
      console.error("Failed to update team score in DB:", err);
    }
  };

  const questionData =
    selectedTile && questions[selectedTile.col]?.[selectedTile.row];

  return (
    <div className="min-h-screen bg-[#061A40] text-white p-4">
      {/* Scoreboard */}
      <div className="flex justify-center gap-4 mb-6">
        {teams.map((team, i) => (
          <div
            key={i}
            className={
              team.isActive
                ? "bg-[#276adc] px-4 py-2 rounded border border-yellow-400 text-center"
                : "bg-[#0B3D91] px-4 py-2 rounded border border-yellow-400 text-center"
            }
          >
            <h2 className="font-bold">{team.name}</h2>
            <p className="text-yellow-300 text-xl">{team.score}</p>
          </div>
        ))}
      </div>

      {/* Game Board */}
      {!selectedTile ? (
        <div className="grid grid-cols-6 gap-[2px] border-[2px] border-yellow-400 max-w-6xl mx-auto">
          {categories.map((cat, i) => (
            <div
              key={i}
              className="bg-[#0B3D91] text-center py-4 px-2 font-bold border border-yellow-400 text-lg uppercase"
            >
              {cat}
            </div>
          ))}
          {Array.from({ length: categories.length * values.length }).map(
            (_, i) => {
              const row = Math.floor(i / 6);
              const col = i % 6;
              const value = values[row];
              const q = questions[col]?.[row];
              const isUsed = usedQuestions.includes(q?.id || "");

              return (
                <div
                  key={q?.id || `${row}-${col}`}
                  onClick={() =>
                    !isUsed && setSelectedTile({ row, col, value })
                  }
                  className={`text-center py-6 text-2xl font-bold cursor-pointer border border-yellow-400 ${
                    isUsed
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-[#0B3D91] text-yellow-300 hover:bg-yellow-500 hover:text-black transition-colors"
                  }`}
                >
                  ${value}
                </div>
              );
            }
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <button
            className="absolute top-4 left-4 bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
            onClick={() => {
              setSelectedTile(null);
              setShowAnswer(false);
            }}
          >
            ⬅ Back
          </button>

          <h2 className="text-3xl font-bold mb-4">
            ${selectedTile.value} — {categories[selectedTile.col]}
          </h2>
          <p className="mb-6 text-lg">
            {questionData?.question || "No question found."}
          </p>

          {!showAnswer ? (
            <button
              className="bg-yellow-300 text-black px-4 py-2 rounded font-bold hover:bg-yellow-400"
              onClick={() => setShowAnswer(true)}
            >
              Reveal Answer
            </button>
          ) : (
            <>
              <p className="mb-6 text-lg">
                {questionData?.answer || "No answer available."}
              </p>

              <div className="flex gap-4 mb-6 flex-wrap justify-center">
                {teams.map((team, i) => (
                  <div key={i} className="flex gap-2">
                    <button
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                      onClick={() => updateTeamScore(i, selectedTile.value)}
                    >
                      +{selectedTile.value} {team.name}
                    </button>
                    <button
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      onClick={() => updateTeamScore(i, -selectedTile.value)}
                    >
                      -{selectedTile.value} {team.name}
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="bg-yellow-300 text-black px-4 py-2 rounded font-bold hover:bg-yellow-400"
                onClick={() => {
                  updateUsedQuestions(selectedTile.row, selectedTile.col);
                  setSelectedTile(null);
                  setShowAnswer(false);
                }}
              >
                Back to Board
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
