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
import { loadLocalSoundPrefs, playSound } from "@/lib/sound";
import { brandingStyleVars, normalizeBranding } from "@/lib/branding";
import type { BoardQuestion, GameRecord, GameTeam } from "@/lib/pbTypes";
import { effectiveBoardValues, scoreOf } from "@/lib/scoring";
import { roundMultiplier, scaleQuestions } from "@/lib/gameModes";
import { a11yStyleVars, buildAnnouncement, loadA11yPrefs, saveA11yPrefs, type A11yPrefs } from "@/lib/a11y";
import { translate } from "@/lib/i18n";
import A11yControls from "@/components/tv/A11yControls";

export default function GameBoard({ watch = false }: { watch?: boolean } = {}) {
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
  const [tvMuted, setTvMuted] = useState(() => Boolean(loadLocalSoundPrefs().muted));
  const branding = normalizeBranding(live?.settings?.branding);
  const soundSettings = useMemo(
    () => ({
      ...live?.settings?.sound,
      muted: tvMuted || Boolean(live?.settings?.sound?.muted),
    }),
    [live?.settings?.sound, tvMuted]
  );
  const scaledQuestions = useMemo(
    () => scaleQuestions(questions, roundMultiplier(live?.settings, live?.round)),
    [questions, live?.settings, live?.round]
  );
  const [a11y, setA11y] = useState<A11yPrefs>(() => loadA11yPrefs());
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(a11y.locale, key, vars);
  const changeA11y = (next: A11yPrefs) => {
    setA11y(next);
    saveA11yPrefs(next);
  };
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = a11y.largeText ? "125%" : "";
    return () => {
      root.style.fontSize = "";
    };
  }, [a11y.largeText]);
  const gameMode = live?.settings?.gameMode ?? "classic";
  const eliminatedNames = teams
    .filter((t) => (live?.eliminatedTeams ?? []).includes(t.id))
    .map((t) => t.name);
  const tiebreaker = live?.tiebreaker ?? null;
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
    return scaledQuestions.flat().find((q) => q.id === id) ?? null;
  }, [scaledQuestions, live?.currentActiveQuestion]);

  const leader = [...teams].sort((a, b) => b.score - a.score)[0];
  const announcement = buildAnnouncement({
    locale: a11y.locale,
    gameOver: live?.gameOver,
    paused: live?.paused,
    question: activeQuestion?.question ?? null,
    answer: activeQuestion?.answer ?? null,
    showAnswer,
    firstBuzzTeam: teams.find((tm) => tm.id === buzzerQueue[0]?.team)?.name ?? null,
    leader: leader && leader.score !== 0 ? { name: leader.name, score: leader.score } : null,
  });

  const lastBuzzerCountRef = useRef(0);
  const lastWildcardRef = useRef<string | null>(null);
  const lastAllInRevealedRef = useRef(0);

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
    setTeams((prev) => {
      const prevIds = new Set(prev.map((t) => t.id));
      const nextIds = g.teams ?? [];
      if (nextIds.some((id) => !prevIds.has(id))) {
        loadGameState(pb, uniqueID)
          .then((res) => {
            if (!res.notFound) setTeams(res.teams);
          })
          .catch(() => {});
      }
      return prev.map((t) => ({ ...t, score: scoreOf(g.teamScores, t.id) }));
    });
  });

  useEffect(() => {
    const qId = live?.currentActiveQuestion;
    if (!qId) return;
    let active = true;
    const unsubPromise = pb
      .collection("questions")
      .subscribe(qId, (e) => {
        if (!active || e.action !== "update") return;
        setQuestions((prev) =>
          prev.map((col) =>
            col.map((q) =>
              q.id === qId
                ? { ...q, question: e.record.question ?? q.question, answer: e.record.answer ?? q.answer }
                : q
            )
          )
        );
      })
      .catch(() => {});
    return () => {
      active = false;
      void unsubPromise.then((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, [live?.currentActiveQuestion]);

  useEffect(() => {
    if (buzzerQueue.length > lastBuzzerCountRef.current) {
      playSound("buzz", soundSettings);
    }
    lastBuzzerCountRef.current = buzzerQueue.length;
  }, [buzzerQueue.length, soundSettings]);

  useEffect(() => {
    const wq = wildcard?.question ?? null;
    if (wq && wq !== lastWildcardRef.current) {
      playSound("wildcard", soundSettings);
    }
    lastWildcardRef.current = wq;
  }, [wildcard?.question, soundSettings]);

  useEffect(() => {
    const rev = live?.allIn?.revealed ?? 0;
    if (rev > lastAllInRevealedRef.current) {
      playSound("allInReveal", soundSettings);
    }
    lastAllInRevealedRef.current = rev;
  }, [live?.allIn?.revealed, soundSettings]);

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
      style={{ ...brandingStyleVars(live?.settings?.branding), ...a11yStyleVars(a11y) }}
      data-theme={branding.tvTheme}
      className="min-h-screen flex flex-col p-4 md:p-8 overflow-hidden bg-background text-foreground"
    >
      <ReconnectingBadge show={!connected} />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="tv-live-region">
        {announcement}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-2">
        {watch && (
          <span
            className="mr-auto text-xs px-3 py-1 rounded-full bg-secondary text-secondary-foreground font-mono"
            data-testid="watch-badge"
          >
            {t("tv.spectator")} · {uniqueID}
          </span>
        )}
        <A11yControls prefs={a11y} onChange={changeA11y} />
        <button
          type="button"
          onClick={() => setTvMuted((m) => !m)}
          className="text-xs px-3 py-1 rounded-full bg-card/60 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
          data-testid="tv-sound-toggle"
        >
          {soundSettings.muted ? t("tv.soundMuted") : t("tv.soundOn")}
        </button>
      </div>
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
      {(gameMode === "rounds" || gameMode === "elimination") && (
        <div className="text-center mb-2 text-sm font-mono text-muted-foreground" data-testid="tv-round">
          {t("tv.round", { n: live?.round ?? 1 })}
        </div>
      )}
      {eliminatedNames.length > 0 && (
        <div className="text-center mb-2 text-sm text-destructive" data-testid="tv-eliminated">
          {t("tv.eliminated", { names: eliminatedNames.join(", ") })}
        </div>
      )}
      <TvScoreboard teams={teams} />

      <div className="flex-1 flex items-center justify-center w-full overflow-x-auto pb-4 relative">
        {live?.paused && (
          <div
            className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center"
            data-testid="game-paused-overlay"
          >
            <div className="bg-card border-4 border-accent rounded-3xl px-12 py-8 text-center shadow-2xl">
              <h2 className="text-4xl md:text-6xl font-black text-accent uppercase tracking-widest">
                {t("tv.paused")}
              </h2>
              <p className="text-muted-foreground mt-2 text-lg">{t("tv.pausedHint")}</p>
            </div>
          </div>
        )}
        {tiebreaker && !live?.gameOver && (
          <div
            className="fixed inset-0 z-40 bg-background/90 backdrop-blur-md flex items-center justify-center p-8"
            data-testid="tv-tiebreaker"
            role="alert"
          >
            <div className="bg-card border-4 border-accent rounded-3xl px-12 py-8 text-center shadow-2xl max-w-3xl">
              <h2 className="text-3xl font-black text-accent uppercase tracking-widest">{t("tv.tiebreaker")}</h2>
              <p className="text-3xl md:text-5xl font-bold mt-4">{tiebreaker.question}</p>
              {tiebreaker.showAnswer && (
                <p className="text-2xl md:text-4xl text-primary mt-6" data-testid="tv-tiebreaker-answer">
                  {tiebreaker.answer}
                </p>
              )}
            </div>
          </div>
        )}
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
              questions={scaledQuestions}
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
