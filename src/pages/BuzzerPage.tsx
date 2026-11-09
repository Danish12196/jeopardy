import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";
import { useBuzzes } from "@/hooks/useBuzzes";
import { buzzPosition } from "@/lib/buzzes";

// Storage key for the team a phone picked. Older builds (before the Lockout
// rebrand) used the "jeopardy-" prefix, so we read that once and migrate it.
const teamKey = (id?: string) => `lockout-buzzer-team-${id}`;
const legacyTeamKey = (id?: string) => `jeopardy-buzzer-team-${id}`;

function loadSavedTeam(id?: string): string | null {
  try {
    const current = localStorage.getItem(teamKey(id));
    if (current) return current;
    const legacy = localStorage.getItem(legacyTeamKey(id));
    if (legacy) {
      localStorage.setItem(teamKey(id), legacy);
      localStorage.removeItem(legacyTeamKey(id));
    }
    return legacy;
  } catch {
    return null;
  }
}

export default function BuzzerPage() {
  const { uniqueID } = useParams();

  const [game, setGame] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  // The round this phone tapped in, until the server confirms or rejects it.
  const [pendingRound, setPendingRound] = useState<number | null>(null);
  const [rejectedRound, setRejectedRound] = useState<number | null>(null);

  const round = game?.buzzRound ?? 0;
  const buzzQueue = useBuzzes(game?.id, round);

  useEffect(() => {
    // Attempt to restore team selection from local storage
    const savedTeamId = loadSavedTeam(uniqueID);
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
        setGame(event.record);
      });
    };
    sub();

    return () => {
      pb.collection("games").unsubscribe(game.id);
    };
  }, [game?.id]);

  const selectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    try { localStorage.setItem(teamKey(uniqueID), teamId); } catch { /* storage unavailable */ }
  };

  const myPosition = selectedTeamId ? buzzPosition(buzzQueue, selectedTeamId) : 0;
  const pending = pendingRound === round && !myPosition;
  const rejected = rejectedRound === round;

  const handleBuzz = async () => {
    if (!game || !selectedTeamId || !game.buzzerUnlocked || pending || myPosition) return;

    // Instant feedback; the server decides the order.
    setPendingRound(round);
    setRejectedRound(null);
    if (navigator.vibrate) navigator.vibrate(100);

    try {
      // No client time is sent: PocketBase stamps `created` when it saves.
      await pb.collection("buzzes").create({ game: game.id, team: selectedTeamId, round });
    } catch (err: any) {
      // A 400 for a team that already buzzed this round is fine: the queue
      // shows it. Anything else means the buzzers closed or the round moved on.
      console.warn("Buzz not accepted:", err?.status, err?.response);
      setPendingRound(null);
      setRejectedRound(round);
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

  if (myPosition || pending) {
      buzzerState = "buzzed";
  } else if (game.buzzerUnlocked) {
      buzzerState = "unlocked";
  } else if (buzzQueue.length > 0) {
      buzzerState = "too-late";
  }

  return (
    <div className="min-h-screen bg-background bg-animated-gradient flex flex-col p-4 md:p-8 text-foreground">
      <div className="flex justify-between items-center mb-8 bg-card/40 backdrop-blur-md p-4 rounded-2xl border border-border/50 shadow-md">
        <div className="text-lg md:text-xl font-bold">Team: <span className="text-accent drop-shadow-sm">{selectedTeamName}</span></div>
        <button
          onClick={() => {
            setSelectedTeamId(null);
            try {
              localStorage.removeItem(teamKey(uniqueID));
              localStorage.removeItem(legacyTeamKey(uniqueID));
            } catch { /* storage unavailable */ }
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
                ? { scale: [1, 1.05, 1], boxShadow: ["0px 0px 20px rgba(255, 90, 31, 0.4)", "0px 0px 60px rgba(255, 90, 31, 0.8)", "0px 0px 20px rgba(255, 90, 31, 0.4)"] }
                : buzzerState === "buzzed"
                ? { scale: 1.1, rotate: [0, -5, 5, -5, 0], transition: { duration: 0.5 } }
                : { scale: 1 }
          }
          transition={buzzerState === "unlocked" ? { repeat: Infinity, duration: 2 } : {}}
          whileTap={buzzerState === "unlocked" ? { scale: 0.9, y: 10 } : {}}
          className={`
            w-64 h-64 md:w-80 md:h-80 rounded-full text-4xl md:text-5xl font-bold uppercase tracking-wider transition-all duration-200 shadow-2xl relative
            ${buzzerState === "unlocked"
                ? "bg-accent text-accent-foreground hover:brightness-110 cursor-pointer border-8 border-background/20"
                : buzzerState === "buzzed"
                ? "bg-green-500 text-white shadow-green-500/50 border-8 border-green-700 cursor-default"
                : "bg-muted text-muted-foreground border-8 border-background/10 cursor-not-allowed opacity-80"}
          `}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

          {buzzerState === "unlocked" && "BUZZ"}
          {buzzerState === "buzzed" && (myPosition ? `Buzzed #${myPosition}` : "Buzzed!")}
          {buzzerState === "locked" && "LOCKED"}
          {buzzerState === "too-late" && "LOCKED"}
        </motion.button>

        <div className="mt-16 text-center h-20 flex items-center justify-center">
           <AnimatePresence mode="wait">
               {buzzerState === "unlocked" && (
                   <motion.p key="unlocked" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-2xl font-bold text-accent drop-shadow-lg">
                       Open! Tap to buzz.
                   </motion.p>
               )}
               {buzzerState === "locked" && (
                   <motion.p key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xl text-muted-foreground">
                       {rejected ? "Locked. That buzz didn't count." : "Locked. Waiting for the host."}
                   </motion.p>
               )}
               {buzzerState === "buzzed" && (
                   <motion.p key="buzzed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-2xl text-green-400 font-bold drop-shadow-md">
                       {myPosition === 1 ? "You're first!" : myPosition ? `You're #${myPosition} in the queue.` : "Sending your buzz..."}
                   </motion.p>
               )}
               {buzzerState === "too-late" && (
                   <motion.p key="too-late" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xl text-muted-foreground">
                       Locked. Someone else got in first.
                   </motion.p>
               )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
