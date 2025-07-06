"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type GameState = {
  teams: { name: string; score: number }[];
  categories: string[];
  values: number[]; // e.g., [100, 200, 300, 400, 500]
  usedQuestions: Set<string>; // e.g., "2-1"
};

export default function GameSetup() {
  const router = useRouter();
  const [numTeams, setNumTeams] = useState(2);
  const [teams, setTeams] = useState(["Team 1", "Team 2"]);
  const [categories, setCategories] = useState([
    "Cat 1",
    "Cat 2",
    "Cat 3",
    "Cat 4",
    "Cat 5",
    "Cat 6",
  ]);
  const [values, setValues] = useState([100, 200, 300, 400, 500]);

  const startGame = () => {
    const gameState = {
      teams: teams.map((name) => ({ name, score: 0 })),
      categories,
      values,
      usedQuestions: [],
    };
    localStorage.setItem("jeopardy-game", JSON.stringify(gameState));
    router.push("/game");
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Jeopardy Game Setup</h1>
      <label className="block mb-2 font-semibold">Number of Teams:</label>
      <input
        type="number"
        value={numTeams}
        onChange={(e) => {
          const n = parseInt(e.target.value);
          setNumTeams(n);
          setTeams(Array.from({ length: n }, (_, i) => `Team ${i + 1}`));
        }}
        className="mb-4 p-2 w-full rounded border"
      />

      <label className="block mb-2 font-semibold">Team Names:</label>
      {teams.map((team, i) => (
        <input
          key={i}
          value={team}
          onChange={(e) => {
            const newTeams = [...teams];
            newTeams[i] = e.target.value;
            setTeams(newTeams);
          }}
          className="mb-2 p-2 w-full rounded border"
        />
      ))}

      <label className="block mt-4 mb-2 font-semibold">Categories:</label>
      {categories.map((cat, i) => (
        <input
          key={i}
          value={cat}
          onChange={(e) => {
            const newCats = [...categories];
            newCats[i] = e.target.value;
            setCategories(newCats);
          }}
          className="mb-2 p-2 w-full rounded border"
        />
      ))}

      <label className="block mt-4 mb-2 font-semibold">
        Row Values (comma separated):
      </label>
      <input
        value={values.join(",")}
        onChange={(e) => {
          const vals = e.target.value.split(",").map((v) => parseInt(v.trim()));
          setValues(vals);
        }}
        className="mb-4 p-2 w-full rounded border"
      />

      <button
        onClick={startGame}
        className="bg-yellow-400 hover:bg-yellow-500 px-4 py-2 rounded font-bold"
      >
        Start Game
      </button>
    </div>
  );
}
