"use client";

import { useEffect, useState } from "react";

type Team = { name: string; score: number };
type GameState = {
  teams: Team[];
  categories: string[];
  values: number[];
  usedQuestions: string[];
};

export default function GamePage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedTile, setSelectedTile] = useState<{
    row: number;
    col: number;
    value: number;
  } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("jeopardy-game");
    if (stored) setGameState(JSON.parse(stored));
  }, []);

  const markQuestionUsed = (row: number, col: number) => {
    if (!gameState) return;
    const key = `${row}-${col}`;
    const updated = {
      ...gameState,
      usedQuestions: [...gameState.usedQuestions, key],
    };
    localStorage.setItem("jeopardy-game", JSON.stringify(updated));
    setGameState(updated);
  };

  const updateTeamScore = (index: number, delta: number) => {
    if (!gameState) return;
    const teams = [...gameState.teams];
    teams[index].score += delta;
    const updated = { ...gameState, teams };
    localStorage.setItem("jeopardy-game", JSON.stringify(updated));
    setGameState(updated);
  };

  if (!gameState) return <div className="p-4 text-white">Loading game...</div>;

  const { categories, values, teams, usedQuestions } = gameState;

  return (
    <div className="min-h-screen bg-[#061A40] text-white p-4">
      {/* Scoreboard */}
      <div className="flex justify-center gap-4 mb-6">
        {teams.map((team, i) => (
          <div
            key={i}
            className="bg-[#0B3D91] px-4 py-2 rounded border border-yellow-400 text-center"
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
              const key = `${row}-${col}`;
              const isUsed = usedQuestions.includes(key);

              return (
                <div
                  key={key}
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
          <h2 className="text-3xl font-bold mb-6">
            Question for ${selectedTile.value}
          </h2>
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
                This is a sample answer to the question.
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
                  markQuestionUsed(selectedTile.row, selectedTile.col);
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
