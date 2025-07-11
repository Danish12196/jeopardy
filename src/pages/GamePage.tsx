"use client";

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

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
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  const [selectedTile, setSelectedTile] = useState<{
    row: number;
    col: number;
    value: number;
  } | null>(null);

  const [gameId, setGameId] = useState<string | null>(null);

  const { uniqueID } = useParams();

  useEffect(() => {
    const getGameInfo = async () => {
      console.log("Fetching game info for uniqueID:", uniqueID);
      const gameList = await superuserClient.collection("games").getFullList({
        filter: `uniqueID = "${uniqueID}"`,
      });
      const game = gameList[0]; // assuming uniqueID is truly unique
      setGameId(game.id);
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

      const teamRecords = await Promise.all(
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
          score: game.teamScores?.find((ts: any) => ts.id === t.id)?.score || 0,
          isActive: game.currentActiveTeam === t.id,
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
      if (!gameId) return;
      superuserClient.collection("games").update(gameId, {
        currentActiveQuestion: currentQuestion?.id || null,
      });
    }
  }, [selectedTile]);

  useEffect(() => {
    const subscribeToEvents = async () => {
      if (!gameId) return;
      await superuserClient
        .collection("games")
        .subscribe(gameId, function (event) {
          const game = event.record;
          setUsedQuestions(game.answeredQuestions);

          setTeams((prevTeams) =>
            prevTeams.map((team) => {
              const matchingScore = game.teamScores?.find(
                (ts: any) => ts.id === team.id
              );
              return {
                ...team,
                score: matchingScore?.score ?? team.score,
                isActive: game.currentActiveTeam === team.id,
              };
            })
          );
        });
    };

    if (gameId) {
      subscribeToEvents();
    }
  }, [gameId]);

  const updateUsedQuestions = async (row: number, col: number) => {
    const questionId = questions[col]?.[row]?.id;
    const currentUsed = usedQuestions ?? [];

    if (!questionId || currentUsed.includes(questionId)) return;
    const updated = [...currentUsed, questionId];
    setUsedQuestions(updated);

    if (gameId) {
      try {
        await superuserClient.collection("games").update(gameId, {
          answeredQuestions: updated,
        });
      } catch (err) {
        console.error("Failed to update usedQuestions in DB:", err);
      }
    }
  };

  const updateTeamScore = async (teamIndex: number, value: number) => {
    const newTeams = [...teams];
    newTeams[teamIndex].score += value;

    setTeams(newTeams);
    if (gameId) {
      try {
        await superuserClient.collection("games").update(gameId, {
          teamScores: newTeams.map((t) => ({ id: t.id, score: t.score })),
        });
      } catch (err) {
        console.error("Failed to update team score in DB:", err);
      }
    }
  };

  const updateTeamActiveStatus = async (teamId: string) => {
    setTeams((prevTeams) =>
      prevTeams.map((team) => {
        return {
          ...team,
          isActive: teamId === team.id,
        };
      })
    );

    if (gameId) {
      try {
        await superuserClient.collection("games").update(gameId, {
          currentActiveTeam: teamId,
        });
      } catch (err) {
        console.error("Failed to update team score in DB:", err);
      }
    }
  };

  const questionData =
    selectedTile && questions[selectedTile.col]?.[selectedTile.row];

  return (
    <div className="min-h-screen flex flex-col bg-blue-950 text-white p-4">
      {/* Scoreboard */}
      <div className="flex justify-center gap-4 mb-6">
        {teams.map((team) => (
          <div
            key={team.id}
            className={`rounded px-6 py-4 text-center border transition-colors duration-200 cursor-pointer ${
              team.isActive
                ? "bg-blue-600 border-yellow-400 shadow-lg shadow-yellow-400/40"
                : "bg-blue-900 border-blue-300 hover:bg-blue-800"
            }`}
            onClick={() => updateTeamActiveStatus(team.id)}
          >
            <h2 className="font-bold text-xl mb-1">{team.name}</h2>
            <p className="text-yellow-300 text-2xl font-mono">{team.score}</p>
          </div>
        ))}
      </div>

      {/* Game Board */}
      {!selectedTile ? (
        <div className="grid grid-cols-6 gap-[2px] border-[2px] border-yellow-400 w-full h-full flex-1">
          {categories.map((cat, i) => (
            <div
              key={i}
              className="bg-blue-800 flex items-center justify-center text-center py-4 px-2 font-bold border border-yellow-400 text-lg uppercase"
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
              const isUsed = usedQuestions?.includes(q?.id || "");

              return (
                <div
                  key={q?.id || `${row}-${col}`}
                  onClick={() =>
                    !isUsed && setSelectedTile({ row, col, value })
                  }
                  className={`flex items-center justify-center text-center py-6 text-2xl font-bold cursor-pointer border border-yellow-400 ${
                    isUsed
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-800 text-yellow-300 hover:bg-yellow-500 hover:text-black transition-colors"
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
