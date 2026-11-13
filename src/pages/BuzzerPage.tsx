import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";
import { useGameSubscription } from "@/hooks/useGameSubscription";
import { useBuzzes } from "@/hooks/useBuzzes";
import { useAnswers } from "@/hooks/useAnswers";
import { buzzPosition } from "@/lib/buzzes";
import PhoneAllIn from "@/components/phone/PhoneAllIn";
import { useLiveConnection } from "@/hooks/useLiveConnection";
import ReconnectingBadge from "@/components/ReconnectingBadge";
import TimerDisplay from "@/components/TimerDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brandingStyleVars } from "@/lib/branding";
import type { GameRecord, QuestionRecord, TeamRecord } from "@/lib/pbTypes";


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

  const [game, setGame] = useState<GameRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  // The round this phone tapped in, until the server confirms or rejects it.
  const [pendingRound, setPendingRound] = useState<number | null>(null);
  const [rejectedRound, setRejectedRound] = useState<number | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<QuestionRecord | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [regName, setRegName] = useState("");
  const [regEmoji, setRegEmoji] = useState("🚀");
  const [regColor, setRegColor] = useState("#FF5A1F");
  const [regMembers, setRegMembers] = useState("");
  const [regPendingName, setRegPendingName] = useState<string | null>(null);

  const { connected, reloadKey } = useLiveConnection();
  const round = game?.buzzRound ?? 0;
  const rawBuzzQueue = useBuzzes(game?.id, round, reloadKey);
  const passedTeams = game?.passedTeams || [];
  const buzzQueue = rawBuzzQueue.filter((b) => !passedTeams.includes(b.team));
  const answers = useAnswers(game?.id, game?.currentActiveQuestion, round, reloadKey);

  useEffect(() => {
    // Attempt to restore team selection from local storage
    const savedTeamId = loadSavedTeam(uniqueID);
    if (savedTeamId) setSelectedTeamId(savedTeamId);

    const fetchGame = async () => {
      if (!uniqueID) {
        setNotFound(true);
        return;
      }
      try {
        setNotFound(false);
        const gameList = await pb.collection("games").getFullList<GameRecord>({
          filter: pb.filter("uniqueID = {:uniqueID}", { uniqueID }),
          expand: "teams",
        });
        if (gameList.length === 0) {
          setNotFound(true);
          return;
        }
        const g = gameList[0];
        setGame(g);

        const teamIds = g.teams ?? [];
        const fetchedTeams = g.expand?.teams
          ? g.expand.teams
          : teamIds.length > 0
          ? await pb.collection("teams").getFullList<TeamRecord>({
              filter: teamIds.map((id) => pb.filter("id = {:id}", { id })).join(" || "),
            })
          : [];
        const byId = new Map(fetchedTeams.map((t) => [t.id, t]));
        setTeams(teamIds.map((id) => byId.get(id)).filter((t): t is TeamRecord => Boolean(t)));
      } catch (err) {
        console.error("Buzzer fetch error:", err);
      }
    };

    fetchGame();
  }, [uniqueID]);

  // Live updates, plus a refetch after any reconnect.
  useGameSubscription(game?.id, reloadKey, setGame);

  useEffect(() => {
    const qId = game?.currentActiveQuestion;
    setAnswerDraft("");
    setAnswerError(null);
    if (!qId) {
      setActiveQuestion(null);
      return;
    }
    let cancelled = false;
    pb.collection("questions")
      .getOne<QuestionRecord>(qId)
      .then((rec) => {
        if (!cancelled) setActiveQuestion(rec);
      })
      .catch(() => {
        if (!cancelled) setActiveQuestion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [game?.currentActiveQuestion]);

  const selectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    try { localStorage.setItem(teamKey(uniqueID), teamId); } catch { /* storage unavailable */ }
  };

  const myPosition = selectedTeamId ? buzzPosition(buzzQueue, selectedTeamId) : 0;
  const pending = pendingRound === round && !myPosition;
  const rejected = rejectedRound === round;
  const myAnswer = selectedTeamId ? answers.find((a) => a.team === selectedTeamId) : undefined;
  const qType = activeQuestion?.questionType || "buzzer";
  const isAnswerMode = Boolean(game?.currentActiveQuestion && qType !== "buzzer");

  const handleSubmitAnswer = async (value: string) => {
    const trimmed = value.trim();
    if (!game || !game.currentActiveQuestion || !selectedTeamId || !trimmed || answerSubmitting || myAnswer) return;
    setAnswerSubmitting(true);
    setAnswerError(null);
    try {
      await pb.collection("answers").create({
        game: game.id,
        question: game.currentActiveQuestion,
        round,
        team: selectedTeamId,
        value: trimmed,
      });
      setAnswerDraft("");
    } catch {
      setAnswerError("Could not submit answer.");
    } finally {
      setAnswerSubmitting(false);
    }
  };

  const handleBuzz = async () => {
    if (!game || !selectedTeamId || !game.buzzerUnlocked || pending || myPosition) return;

    // Instant feedback; the server decides the order.
    setPendingRound(round);
    setRejectedRound(null);
    if (navigator.vibrate) navigator.vibrate(100);

    try {
      // No client time is sent: PocketBase stamps `created` when it saves.
      await pb.collection("buzzes").create({ game: game.id, team: selectedTeamId, round });
    } catch (err: unknown) {
      // A 400 for a team that already buzzed this round is fine: the queue
      // shows it. Anything else means the buzzers closed or the round moved on.
      const e = err as { status?: number; response?: unknown };
      console.warn("Buzz not accepted:", e?.status, e?.response);
      setPendingRound(null);
      setRejectedRound(round);
    }
  };

  useEffect(() => {
    if (!game) return;
    const teamIds = game.teams ?? [];
    if (teamIds.length === 0) return;
    const known = new Set(teams.map((t) => t.id));
    if (teamIds.every((id) => known.has(id)) && teams.length === teamIds.length) return;
    pb.collection("games")
      .getOne<GameRecord>(game.id, { expand: "teams" })
      .then((freshGame) => {
        const fetched = freshGame.expand?.teams ?? [];
        const byId = new Map(fetched.map((t) => [t.id, t]));
        const ordered = teamIds.map((id) => byId.get(id)).filter((t): t is TeamRecord => Boolean(t));
        setTeams(ordered);
        if (regPendingName) {
          const match = ordered.find((t) => t.name === regPendingName);
          if (match) {
            setRegPendingName(null);
            setSelectedTeamId(match.id);
            try { localStorage.setItem(teamKey(uniqueID), match.id); } catch { /* storage unavailable */ }
          }
        }
      })
      .catch(() => {});
  }, [game, teams, regPendingName, uniqueID]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-background bg-animated-gradient flex items-center justify-center p-8 text-foreground">
        <div className="bg-card/60 backdrop-blur-md p-8 rounded-2xl border border-border/50 shadow-xl max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-accent">Game not found</h1>
          <p className="text-muted-foreground">No game matches code <span className="font-mono font-bold">{uniqueID}</span>.</p>
          <Link to="/game" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity">
            Join a different game
          </Link>
        </div>
      </div>
    );
  }

  if (!game) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground text-xl">Loading...</div>;

  const handleRegisterTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = regName.trim();
    if (!trimmed || !game) return;
    const members = regMembers
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    await pb.collection("team_registrations").create({
      game: game.id,
      name: trimmed,
      emoji: regEmoji.trim(),
      color: regColor,
      members,
      status: "pending",
    });
    setRegPendingName(trimmed);
    setRegName("");
    setRegMembers("");
  };

  if (!selectedTeamId) {
    return (
      <div style={brandingStyleVars(game.settings?.branding)} className="min-h-screen bg-background bg-animated-gradient flex flex-col items-center p-8 text-foreground">
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
              style={t.color ? { borderColor: t.color } : undefined}
              className="bg-primary/90 hover:bg-primary text-xl font-bold py-6 px-4 rounded-xl border-2 border-primary-foreground/20 backdrop-blur-sm transition-all shadow-lg hover:scale-105 active:scale-95"
            >
              {t.emoji ? `${t.emoji} ` : ""}{t.name}
            </motion.button>
          ))}
          </AnimatePresence>
        </div>

        {game.settings?.allowSelfRegistration && (
          <div className="w-full max-w-md mt-8 bg-card/70 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-accent">Register New Team</h2>
            {regPendingName ? (
              <p className="text-sm text-muted-foreground font-semibold" data-testid="phone-reg-pending">
                Waiting for host approval for {regPendingName}...
              </p>
            ) : (
              <form onSubmit={handleRegisterTeam} className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={regEmoji}
                    onChange={(e) => setRegEmoji(e.target.value)}
                    aria-label="New Team Emoji"
                    className="w-16 text-center bg-background"
                  />
                  <input
                    type="color"
                    value={regColor}
                    onChange={(e) => setRegColor(e.target.value)}
                    aria-label="New Team Color"
                    className="h-10 w-12 rounded border border-border bg-background cursor-pointer"
                  />
                  <Input
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Team name"
                    aria-label="New Team Name"
                    className="bg-background"
                  />
                </div>
                <Input
                  value={regMembers}
                  onChange={(e) => setRegMembers(e.target.value)}
                  placeholder="Members (comma-separated)"
                  aria-label="New Team Members"
                  className="bg-background"
                />
                <Button type="submit" variant="brand" className="w-full" disabled={!regName.trim()}>
                  Request to Join
                </Button>
              </form>
            )}
          </div>
        )}
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
    <div style={brandingStyleVars(game.settings?.branding)} className="min-h-screen bg-background bg-animated-gradient flex flex-col p-4 md:p-8 text-foreground">
      <ReconnectingBadge show={!connected} />
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
          Switch team
        </button>
      </div>

      {(game.allInPhase || game.gameOver) ? (
        <PhoneAllIn key={`${game.id}-${selectedTeamId}`} game={game} teamId={selectedTeamId} teams={teams} />
      ) : (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="mb-6">
          <TimerDisplay
            timerEndsAt={game.timerEndsAt}
            timerType={game.timerType}
            timerPausedRemaining={game.timerPausedRemaining}
          />
        </div>
        {isAnswerMode && activeQuestion ? (
          <div className="w-full max-w-md bg-card/70 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-xl space-y-4" data-testid="phone-answer-panel">
            <p className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
              {qType === "multiple_choice"
                ? "Choose an option"
                : qType === "estimation"
                ? "Enter your closest estimate"
                : "Type your answer"}
            </p>
            <p className="text-lg font-bold text-foreground">{activeQuestion.question}</p>
            {myAnswer ? (
              <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 font-bold text-center" data-testid="phone-answer-submitted">
                Answer submitted: {myAnswer.value}
              </div>
            ) : qType === "multiple_choice" && Array.isArray(activeQuestion.options) && activeQuestion.options.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {activeQuestion.options.map((opt, idx) => (
                  <Button
                    key={`${idx}-${opt}`}
                    variant="secondary"
                    size="lg"
                    disabled={answerSubmitting}
                    onClick={() => handleSubmitAnswer(opt)}
                    className="justify-start text-left h-auto py-3 px-4 font-bold"
                    data-testid="phone-mc-option"
                  >
                    <span className="bg-accent text-accent-foreground rounded px-2 py-0.5 mr-3 text-xs font-black">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </Button>
                ))}
              </div>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmitAnswer(answerDraft);
                }}
              >
                <Input
                  type={qType === "estimation" ? "number" : "text"}
                  step={qType === "estimation" ? "any" : undefined}
                  aria-label={qType === "estimation" ? "Your estimate" : "Your answer"}
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
                  placeholder={qType === "estimation" ? "Enter a number..." : "Type your answer..."}
                  className="bg-background text-foreground h-12 text-lg"
                />
                <Button type="submit" variant="brand" size="lg" disabled={!answerDraft.trim() || answerSubmitting}>
                  {qType === "estimation" ? "Submit Estimate" : "Submit Answer"}
                </Button>
              </form>
            )}
            {answerError && <p className="text-sm text-destructive font-semibold">{answerError}</p>}
          </div>
        ) : (
        <>
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

        <div className="mt-16 text-center h-20 flex items-center justify-center" aria-live="polite">
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
        </>
        )}
      </div>
      )}
    </div>
  );
}
