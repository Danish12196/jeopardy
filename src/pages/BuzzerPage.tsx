import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
    const buzzTime = Date.now();

    // Attempt to trigger native vibration
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }

    try {
        // Fetch latest game state to avoid race conditions with other players as much as possible
        const latestGame = await pb.collection("games").getOne(game.id);
        const currentQueue = latestGame.buzzerQueue || [];

        if (!currentQueue.find((q: any) => q.teamId === selectedTeamId)) {
            const newQueue = [...currentQueue, { teamId: selectedTeamId, time: buzzTime }];
            // Sort just in case
            newQueue.sort((a, b) => a.time - b.time);

            await pb.collection("games").update(game.id, {
                buzzerQueue: newQueue
            });
        }
    } catch (err) {
        console.error("Failed to buzz in:", err);
        setHasBuzzedLocally(false); // Revert on failure
    }
  };

  if (!game) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground text-xl">Loading...</div>;

  if (!selectedTeamId) {
    return (
      <div className="min-h-screen bg-background bg-animated-gradient flex flex-col items-center p-8 text-foreground">
        <h1 className="text-3xl font-bold mb-8 text-accent drop-shadow-md">Join a Team</h1>
        <div className="w-full max-w-md flex flex-col gap-4">
          <AnimatePresence>
          {teams.map((t, idx) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => selectTeam(t.id)}
              className="bg-primary/90 hover:bg-primary text-xl font-bold py-6 px-4 rounded-xl border-2 border-primary-foreground/20 backdrop-blur-sm transition-all shadow-lg hover:scale-105 active:scale-95"
            >
              {t.name}
            </motion.button>
          ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  const selectedTeamName = teams.find(t => t.id === selectedTeamId)?.name;

  // Determine buzzer state
  let buzzerState: "locked" | "unlocked" | "buzzed" | "too-late" = "locked";

  const queueEntry = (game.buzzerQueue || []).find((q: any) => q.teamId === selectedTeamId);

  if (game.buzzerUnlocked) {
      buzzerState = "unlocked";
  } else if (queueEntry) {
      buzzerState = "buzzed";
  } else if (game.buzzerQueue?.length > 0) {
      buzzerState = "too-late";
  }

  return (
    <div className="min-h-screen bg-background bg-animated-gradient flex flex-col p-4 md:p-8 text-foreground">
      <div className="flex justify-between items-center mb-8 bg-card/40 backdrop-blur-md p-4 rounded-2xl border border-border/50 shadow-md">
        <div className="text-lg md:text-xl font-bold">Team: <span className="text-accent drop-shadow-sm">{selectedTeamName}</span></div>
        <button
          onClick={() => {
            setSelectedTeamId(null);
            localStorage.removeItem(`jeopardy-buzzer-team-${uniqueID}`);
          }}
          className="text-sm bg-secondary/80 px-4 py-2 rounded-lg hover:bg-secondary font-semibold transition-colors"
        >
          Change Team
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Buzzer Button */}
        <motion.button
          onClick={handleBuzz}
          disabled={buzzerState !== "unlocked"}
          animate={
              buzzerState === "unlocked"
                ? { scale: [1, 1.05, 1], boxShadow: ["0px 0px 20px rgba(var(--destructive), 0.4)", "0px 0px 60px rgba(var(--destructive), 0.8)", "0px 0px 20px rgba(var(--destructive), 0.4)"] }
                : buzzerState === "buzzed"
                ? { scale: 1.1, rotate: [0, -5, 5, -5, 0], transition: { duration: 0.5 } }
                : { scale: 1 }
          }
          transition={buzzerState === "unlocked" ? { repeat: Infinity, duration: 2 } : {}}
          whileTap={buzzerState === "unlocked" ? { scale: 0.9, y: 10 } : {}}
          className={`
            w-64 h-64 md:w-80 md:h-80 rounded-full text-4xl md:text-5xl font-bold uppercase tracking-wider transition-all duration-200 shadow-2xl relative
            ${buzzerState === "unlocked"
                ? "bg-destructive text-destructive-foreground hover:brightness-110 cursor-pointer border-8 border-background/20"
                : buzzerState === "buzzed"
                ? "bg-green-500 text-white shadow-green-500/50 border-8 border-green-700 cursor-default"
                : "bg-muted text-muted-foreground border-8 border-background/10 cursor-not-allowed opacity-80"}
          `}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

          {buzzerState === "unlocked" && "BUZZ"}
          {buzzerState === "buzzed" && "BUZZED!"}
          {buzzerState === "locked" && "LOCKED"}
          {buzzerState === "too-late" && "LOCKED"}
        </motion.button>

        <div className="mt-16 text-center h-20 flex items-center justify-center">
           <AnimatePresence mode="wait">
               {buzzerState === "unlocked" && (
                   <motion.p key="unlocked" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-2xl font-bold text-accent drop-shadow-lg">
                       Ready! Tap to Buzz.
                   </motion.p>
               )}
               {buzzerState === "locked" && (
                   <motion.p key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xl text-muted-foreground">
                       Waiting for host...
                   </motion.p>
               )}
               {buzzerState === "buzzed" && (
                   <motion.p key="buzzed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-2xl text-green-400 font-bold drop-shadow-md">
                       You are in the queue!
                   </motion.p>
               )}
               {buzzerState === "too-late" && (
                   <motion.p key="too-late" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xl text-muted-foreground">
                       Someone else buzzed in.
                   </motion.p>
               )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
