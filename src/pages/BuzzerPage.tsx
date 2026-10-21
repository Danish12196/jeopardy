import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import pb from "@/pb";

export default function BuzzerPage() {
  const { uniqueID } = useParams();

  const [game, setGame] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [hasBuzzedLocally, setHasBuzzedLocally] = useState(false);

  useEffect(() => {
    // Attempt to restore team selection from local storage
    const savedTeamId = localStorage.getItem(`jeopardy-buzzer-team-${uniqueID}`);
    if (savedTeamId) setSelectedTeamId(savedTeamId);

    const fetchGame = async () => {
      try {
        const gameList = await pb.collection("games").getFullList({
          filter: `uniqueID = "${uniqueID}"`,
        });
        if (gameList.length === 0) return;
        const g = gameList[0];
        setGame(g);

        const teamRecords = await Promise.all(
          g.teams.map((id: string) => pb.collection("teams").getOne(id))
        );

        setTeams(teamRecords);
      } catch (err) {
        console.error("Buzzer fetch error:", err);
      }
    };

    fetchGame();
  }, [uniqueID]);

  useEffect(() => {
    if (!game?.id) return;

    const sub = async () => {
      await pb.collection("games").subscribe(game.id, (event) => {
        const updatedGame = event.record;
        setGame(updatedGame);

        // Reset local buzz state if the host unlocked the buzzers or cleared the queue
        if (updatedGame.buzzerUnlocked) {
            setHasBuzzedLocally(false);
        } else if (!updatedGame.buzzerQueue || updatedGame.buzzerQueue.length === 0) {
            setHasBuzzedLocally(false);
        }
      });
    };
    sub();

    return () => {
      pb.collection("games").unsubscribe(game.id);
    };
  }, [game?.id]);

  const selectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    localStorage.setItem(`jeopardy-buzzer-team-${uniqueID}`, teamId);
  };

  const handleBuzz = async () => {
    if (!game || !selectedTeamId || !game.buzzerUnlocked || hasBuzzedLocally) return;

    // Immediately show feedback
    setHasBuzzedLocally(true);

    try {
        // Fetch latest game state to avoid race conditions with other players as much as possible
        const latestGame = await pb.collection("games").getOne(game.id);
        const currentQueue = latestGame.buzzerQueue || [];

        if (!currentQueue.includes(selectedTeamId)) {
            const newQueue = [...currentQueue, selectedTeamId];
            await pb.collection("games").update(game.id, {
                buzzerQueue: newQueue
            });
        }
    } catch (err) {
        console.error("Failed to buzz in:", err);
        setHasBuzzedLocally(false); // Revert on failure
    }
  };

  if (!game) return <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white text-xl">Loading...</div>;

  if (!selectedTeamId) {
    return (
      <div className="min-h-screen bg-blue-950 flex flex-col items-center p-8 text-white">
        <h1 className="text-3xl font-bold mb-8 text-yellow-400">Join a Team</h1>
        <div className="w-full max-w-md flex flex-col gap-4">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTeam(t.id)}
              className="bg-blue-800 hover:bg-blue-700 text-xl font-bold py-6 px-4 rounded border-2 border-blue-500 transition-colors"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedTeamName = teams.find(t => t.id === selectedTeamId)?.name;

  // Determine buzzer state
  let buzzerState: "locked" | "unlocked" | "buzzed" | "too-late" = "locked";

  if (game.buzzerUnlocked) {
      buzzerState = "unlocked";
  } else if (game.buzzerQueue?.includes(selectedTeamId)) {
      buzzerState = "buzzed";
  } else if (game.buzzerQueue?.length > 0) {
      buzzerState = "too-late";
  }

  return (
    <div className="min-h-screen bg-blue-950 flex flex-col p-4 text-white">
      <div className="flex justify-between items-center mb-8">
        <div className="text-lg font-bold">Team: <span className="text-yellow-400">{selectedTeamName}</span></div>
        <button
          onClick={() => {
            setSelectedTeamId(null);
            localStorage.removeItem(`jeopardy-buzzer-team-${uniqueID}`);
          }}
          className="text-sm bg-gray-700 px-3 py-1 rounded hover:bg-gray-600"
        >
          Change Team
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Buzzer Button */}
        <button
          onClick={handleBuzz}
          disabled={buzzerState !== "unlocked"}
          className={`
            w-64 h-64 rounded-full text-4xl font-bold uppercase tracking-wider shadow-2xl transition-all duration-100
            ${buzzerState === "unlocked"
                ? "bg-red-600 hover:bg-red-500 active:scale-95 shadow-red-600/50 cursor-pointer border-8 border-red-800"
                : buzzerState === "buzzed"
                ? "bg-green-500 shadow-green-500/50 border-8 border-green-700 scale-105 cursor-default"
                : "bg-gray-600 text-gray-400 border-8 border-gray-800 opacity-50 cursor-not-allowed"}
          `}
        >
          {buzzerState === "unlocked" && "BUZZ"}
          {buzzerState === "buzzed" && "BUZZED!"}
          {buzzerState === "locked" && "LOCKED"}
          {buzzerState === "too-late" && "LOCKED"}
        </button>

        <div className="mt-12 text-center h-16">
           {buzzerState === "unlocked" && <p className="text-xl font-bold text-yellow-400 animate-pulse">Go!</p>}
           {buzzerState === "locked" && <p className="text-xl text-gray-400">Waiting for host...</p>}
           {buzzerState === "buzzed" && <p className="text-xl text-green-400 font-bold">You are in the queue!</p>}
           {buzzerState === "too-late" && <p className="text-xl text-gray-400">Someone else buzzed in.</p>}
        </div>
      </div>
    </div>
  );
}
