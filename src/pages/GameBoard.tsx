import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import pb from "@/pb";
import { useGameSubscription } from "@/hooks/useGameSubscription";
import { useBuzzes } from "@/hooks/useBuzzes";
import { useWagers } from "@/hooks/useWagers";
import { useLiveConnection } from "@/hooks/useLiveConnection";
import AllInScreen from "@/components/tv/AllInScreen";
import GameOverScreen from "@/components/tv/GameOverScreen";
import TvScoreboard from "@/components/tv/TvScoreboard";
import TvBoardGrid from "@/components/tv/TvBoardGrid";
import TvQuestionCard from "@/components/tv/TvQuestionCard";
import ReconnectingBadge from "@/components/ReconnectingBadge";
import { loadGameState } from "@/lib/loadGameState";
import { playBuzzerTone } from "@/lib/sound";
import { brandingStyleVars, normalizeBranding } from "@/lib/branding";
import type { BoardQuestion, GameRecord, GameTeam } from "@/lib/pbTypes";
import { effectiveBoardValues, scoreOf } from "@/lib/scoring";

export default function GameBoard() {
  const { uniqueID } = useParams();

  const [categories, setCategories] = useState<string[]>([]);
  const [questions, setQuestions] = useState<BoardQuestion[][]>([]);
  const [teams, setTeams] = useState<GameTeam[]>([]);
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);

  const [showAnswer, setShowAnswer] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [buzzRound, setBuzzRound] = useState(0);
  const { connected, reloadKey } = useLiveConnection();
  const [live, setLive] = useState<GameRecord | null>(null);
  const branding = normalizeBranding(live?.settings?.branding);
  const rowCount = Math.max(0, ...questions.map((qs) => qs.length));
  const values = effectiveBoardValues(live?.values, rowCount, live?.settings);
  const allInPhase: string = live?.allInPhase || "";
  const wagers = useWagers(
    gameId ?? undefined,
    allInPhase === "reveal" || allInPhase === "done",
    `${allInPhase}-${reloadKey}`
  );
  const wildcard =
    live?.wildcard && live.wildcard.question === live.currentActiveQuestion ? live.wildcard : null;
  const rawBuzzerQueue = useBuzzes(gameId ?? undefined, buzzRound, reloadKey);
  const passedTeams = live?.passedTeams || [];
  const buzzerQueue = rawBuzzerQueue.filter((b) => !passedTeams.includes(b.team));
  const [hostForceShowQuestion, setHostForceShowQuestion] = useState(false);

  const activeQuestion = useMemo(() => {
    const id = live?.currentActiveQuestion;
    if (!id) return null;
    return questions.flat().find((q) => q.id === id) ?? null;
  }, [questions, live?.currentActiveQuestion]);

  const lastBuzzerCountRef = useRef(0);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        setNotFound(false);
        const result = await loadGameState(pb, uniqueID);
        if (result.notFound) {
          setNotFound(true);
          return;
        }
        const { game: g, categories: cats, questions: grouped, teams: mappedTeams } = result;

        setCategories(cats);
        setQuestions(grouped);
        setTeams(mappedTeams);
        setUsedQuestions(g.answeredQuestions || []);
        setLive(g);
        setShowAnswer(g.showAnswer || false);
        setHostForceShowQuestion(g.hostForceShowQuestion || false);
        setBuzzRound(g.buzzRound ?? 0);
        setGameId(g.id);
      } catch (err) {
        console.error("Board fetch error:", err);
      }
    };

    fetchGame();
  }, [uniqueID]);

  useGameSubscription(gameId, reloadKey, (g) => {
    setUsedQuestions(g.answeredQuestions || []);
    setLive(g);
    setShowAnswer(g.showAnswer || false);
    setHostForceShowQuestion(g.hostForceShowQuestion || false);
    setBuzzRound(g.buzzRound ?? 0);
    setTeams((prev) => prev.map((t) => ({ ...t, score: scoreOf(g.teamScores, t.id) })));
  });

  useEffect(() => {
    if (buzzerQueue.length > lastBuzzerCountRef.current) {
      playBuzzerTone();
    }
    lastBuzzerCountRef.current = buzzerQueue.length;
  }, [buzzerQueue.length]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-background bg-animated-gradient flex items-center justify-center p-8 text-foreground">
        <div className="bg-card/60 backdrop-blur-md p-8 rounded-2xl border border-border/50 shadow-xl max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-accent">Game not found</h1>
          <p className="text-muted-foreground">
            No game matches code <span className="font-mono font-bold">{uniqueID}</span>.
          </p>
          <Link
            to="/game"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Join a game
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={brandingStyleVars(live?.settings?.branding)}
      data-theme={branding.tvTheme}
      className="min-h-screen flex flex-col p-4 md:p-8 overflow-hidden bg-background text-foreground"
    >
      <ReconnectingBadge show={!connected} />
      {(branding.gameTitle || branding.logoUrl) && (
        <div className="flex items-center justify-center gap-3 mb-4" data-testid="tv-branding-header">
          {branding.logoUrl && (
            <img src={branding.logoUrl} alt="Game logo" className="h-10 w-10 object-contain rounded" />
          )}
          {branding.gameTitle && (
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-accent">
              {branding.gameTitle}
            </h1>
          )}
        </div>
      )}
      <TvScoreboard teams={teams} />

      <div className="flex-1 flex items-center justify-center w-full overflow-x-auto pb-4">
        <AnimatePresence mode="wait">
          {live?.gameOver ? (
            <GameOverScreen key="game-over" teams={teams} scores={live.teamScores || []} />
          ) : allInPhase ? (
            <AllInScreen
              key="allin"
              phase={allInPhase}
              allIn={live?.allIn || {}}
              teams={teams}
              scores={live?.teamScores || []}
              wagers={wagers}
            />
          ) : !activeQuestion ? (
            <TvBoardGrid
              categories={categories}
              questions={questions}
              values={values}
              usedQuestions={usedQuestions}
            />
          ) : (
            <TvQuestionCard
              activeQuestion={activeQuestion}
              wildcard={wildcard}
              buzzerQueue={buzzerQueue}
              teams={teams}
              showAnswer={showAnswer}
              hostForceShowQuestion={hostForceShowQuestion}
              timerEndsAt={live?.timerEndsAt}
              timerType={live?.timerType}
              timerPausedRemaining={live?.timerPausedRemaining}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
