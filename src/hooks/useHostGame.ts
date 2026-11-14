import { useEffect, useRef, useState } from "react";
import pb from "@/pb";
import { useGameSubscription } from "@/hooks/useGameSubscription";
import { useBuzzes } from "@/hooks/useBuzzes";
import { useWagers } from "@/hooks/useWagers";
import { useLiveConnection } from "@/hooks/useLiveConnection";
import { findQuestionPosition, loadGameState } from "@/lib/loadGameState";
import { computeRemainingSeconds, makeTimerEndsAt } from "@/lib/timer";
import type { AllInState, BoardQuestion, GameRecord, GameTeam } from "@/lib/pbTypes";
import {
  allInMaxWager,
  applyDelta,
  clampWager,
  normalizeSettings,
  pushHistory,
  restoreSnapshot,
  revealOrder,
  scoreOf,
  type ScoreSnapshot,
  type TeamScore,
} from "@/lib/scoring";

export type SelectedTile = {
  row: number;
  col: number;
  value: number;
  questionData: BoardQuestion;
};

export function useHostGame(uniqueID: string | undefined) {
  const [game, setGame] = useState<GameRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [questions, setQuestions] = useState<BoardQuestion[][]>([]);
  const [teams, setTeams] = useState<GameTeam[]>([]);
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  const [selectedTile, setSelectedTile] = useState<SelectedTile | null>(null);

  const [autoUnlock, setAutoUnlock] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingWildcards, setMarkingWildcards] = useState(false);
  const [allInOpen, setAllInOpen] = useState(false);
  const [adjust, setAdjust] = useState<Record<string, string>>({});
  const [scorePending, setScorePending] = useState(false);
  const scoreInFlightRef = useRef(false);

  const { connected, reloadKey } = useLiveConnection();
  const rawBuzzQueue = useBuzzes(game?.id, game?.buzzRound ?? 0, reloadKey);
  const settings = normalizeSettings(game?.settings);
  const passedTeams: string[] = game?.passedTeams || [];
  const buzzQueue = rawBuzzQueue.filter((b) => !passedTeams.includes(b.team));
  const allInPhase: string = game?.allInPhase || "";
  const allIn: AllInState = game?.allIn || {};
  const wagers = useWagers(game?.id, !!allInPhase, `${allInPhase}-${reloadKey}`);
  const scores: TeamScore[] = game?.teamScores || [];
  const wildcards: string[] = game?.wildcards || [];

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
        setGame(g);
        setCategories(cats);
        setQuestions(grouped);
        setTeams(mappedTeams);
        setUsedQuestions(g.answeredQuestions || []);

        if (g.currentActiveQuestion) {
          const pos = findQuestionPosition(grouped, g.currentActiveQuestion);
          if (pos) setSelectedTile(pos);
        }
      } catch (err) {
        console.error("Host fetch error:", err);
        setActionError("Failed to load the game. Please refresh and try again.");
      }
    };

    fetchGame();
  }, [uniqueID]);

  useGameSubscription(game?.id, reloadKey, (updatedGame) => {
    setGame(updatedGame);
    setUsedQuestions(updatedGame.answeredQuestions || []);
    setTeams((prevTeams) =>
      prevTeams.map((t) => ({
        ...t,
        score: scoreOf(updatedGame.teamScores, t.id),
      }))
    );
  });

  const updateGame = async (patch: Record<string, unknown>) => {
    if (!game?.id) return undefined;
    try {
      setActionError(null);
      const rec = await pb.collection("games").update<GameRecord>(game.id, patch);
      setGame(rec);
      return rec;
    } catch (err: unknown) {
      console.error("Game update error:", err);
      setActionError(
        err instanceof Error ? err.message : "Failed to save game update. Please try again."
      );
      return undefined;
    }
  };

  const changeScores = async (next: TeamScore[], extra: Record<string, unknown> = {}) => {
    if (scoreInFlightRef.current) return undefined;
    scoreInFlightRef.current = true;
    setScorePending(true);
    try {
      return await updateGame({
        teamScores: next,
        scoreHistory: pushHistory(game?.scoreHistory, {
          teamScores: scores,
          wildcard: game?.wildcard ?? null,
          allIn: game?.allIn ?? null,
        }),
        ...extra,
      });
    } finally {
      scoreInFlightRef.current = false;
      setScorePending(false);
    }
  };

  const undoScore = async () => {
    if (scoreInFlightRef.current) return;
    const history: ScoreSnapshot[] = game?.scoreHistory || [];
    if (!history.length) return;
    scoreInFlightRef.current = true;
    setScorePending(true);
    try {
      await updateGame({
        ...restoreSnapshot(history[history.length - 1]),
        scoreHistory: history.slice(0, -1),
      });
    } finally {
      scoreInFlightRef.current = false;
      setScorePending(false);
    }
  };

  const applyAdjust = async (teamId: string) => {
    const delta = Number(adjust[teamId]);
    if (!Number.isFinite(delta) || delta === 0) return;
    const updated = await changeScores(applyDelta(scores, teamId, Math.round(delta)));
    if (updated) {
      setAdjust((a) => ({ ...a, [teamId]: "" }));
    }
  };

  const toggleWildcard = (questionId: string) =>
    updateGame({
      wildcards: wildcards.includes(questionId)
        ? wildcards.filter((w) => w !== questionId)
        : [...wildcards, questionId],
    });

  const selectQuestion = async (
    row: number,
    col: number,
    value: number,
    questionData: BoardQuestion
  ) => {
    if (markingWildcards) {
      await toggleWildcard(questionData.id);
      return;
    }
    setSelectedTile({ row, col, value, questionData });
    const isWildcard = wildcards.includes(questionData.id);

    if (game?.id) {
      const autoTimer = !isWildcard && autoUnlock && settings.buzzTimerSeconds > 0;
      await updateGame({
        currentActiveQuestion: questionData.id,
        showAnswer: false,
        buzzerUnlocked: isWildcard ? false : autoUnlock,
        "buzzRound+": 1,
        passedTeams: [],
        hostForceShowQuestion: false,
        timerEndsAt: autoTimer ? makeTimerEndsAt(settings.buzzTimerSeconds) : "",
        timerType: autoTimer ? "buzz" : "",
        timerPausedRemaining: null,
        wildcard: isWildcard
          ? { question: questionData.id, team: "", wager: null, resolved: false }
          : null,
      });
    }
  };

  const lockInWildcard = (team: string, wager: number) =>
    updateGame({ wildcard: { ...game?.wildcard, team, wager } });

  const scoreWildcard = (correct: boolean) => {
    const w = game?.wildcard;
    if (!w?.team || w.wager === null || w.wager === undefined) return;
    return changeScores(applyDelta(scores, w.team, correct ? w.wager : -w.wager), {
      wildcard: { ...w, resolved: true },
    });
  };

  const startAllIn = (a: { category: string; question: string; answer: string }) =>
    updateGame({
      allInPhase: "wager",
      allIn: { ...a, results: {}, order: [], revealed: 0, applied: {} },
      currentActiveQuestion: null,
      buzzerUnlocked: false,
      "buzzRound+": 1,
      passedTeams: [],
      timerEndsAt: "",
      timerType: "",
      timerPausedRemaining: null,
      wildcard: null,
    });

  const markAllIn = (team: string, correct: boolean) =>
    updateGame({ allIn: { ...allIn, results: { ...(allIn.results || {}), [team]: correct } } });

  const startReveal = () =>
    updateGame({
      allInPhase: "reveal",
      allIn: {
        ...allIn,
        order: revealOrder(
          scores,
          teams.map((t) => t.id)
        ),
        revealed: 0,
        applied: {},
      },
    });

  const revealNext = async () => {
    const order = allIn.order || [];
    const revealed = allIn.revealed || 0;
    const team = order[revealed];
    if (!team) return;
    const topValue = Math.max(0, ...questions.flat().map((q) => q.value || 0));
    const wager = clampWager(wagers[team] ?? 0, allInMaxWager(scoreOf(scores, team), settings, topValue));
    const delta = allIn.results?.[team] ? wager : -wager;
    await changeScores(applyDelta(scores, team, delta), {
      allIn: {
        ...allIn,
        revealed: revealed + 1,
        applied: { ...(allIn.applied || {}), [team]: delta },
      },
    });
  };

  const finishGame = () =>
    updateGame({
      allInPhase: allInPhase ? "done" : "",
      gameOver: true,
      currentActiveQuestion: null,
      buzzerUnlocked: false,
      timerEndsAt: "",
      timerType: "",
      timerPausedRemaining: null,
    });

  const cancelQuestion = async () => {
    if (game?.id) {
      await updateGame({
        currentActiveQuestion: null,
        showAnswer: false,
        buzzerUnlocked: false,
        "buzzRound+": 1,
        passedTeams: [],
        hostForceShowQuestion: false,
        timerEndsAt: "",
        timerType: "",
        timerPausedRemaining: null,
        wildcard: null,
      });
    }
    setSelectedTile(null);
  };

  const clearQuestion = async () => {
    if (selectedTile && game?.id) {
      const updatedUsed = [...new Set([...usedQuestions, selectedTile.questionData.id])];
      await updateGame({
        currentActiveQuestion: null,
        showAnswer: false,
        buzzerUnlocked: false,
        "buzzRound+": 1,
        passedTeams: [],
        answeredQuestions: updatedUsed,
        hostForceShowQuestion: false,
        timerEndsAt: "",
        timerType: "",
        timerPausedRemaining: null,
        wildcard: null,
      });
    }
    setSelectedTile(null);
  };

  const toggleBuzzer = (unlock: boolean) => {
    const autoTimer = unlock && settings.buzzTimerSeconds > 0;
    return updateGame({
      buzzerUnlocked: unlock,
      ...(unlock
        ? {
            "buzzRound+": 1,
            passedTeams: [],
            ...(autoTimer
              ? {
                  timerEndsAt: makeTimerEndsAt(settings.buzzTimerSeconds),
                  timerType: "buzz",
                  timerPausedRemaining: null,
                }
              : {}),
          }
        : {
            timerEndsAt: "",
            timerType: "",
            timerPausedRemaining: null,
          }),
    });
  };

  const revealAnswer = () =>
    updateGame({
      showAnswer: true,
      buzzerUnlocked: false,
      timerEndsAt: "",
      timerType: "",
      timerPausedRemaining: null,
    });

  const updateTeamScore = (teamId: string, value: number, isWrong = false) => {
    const shouldPass = isWrong && settings.stealEnabled && buzzQueue[0]?.team === teamId;
    const extra = shouldPass ? { passedTeams: [...passedTeams, teamId] } : {};
    return changeScores(applyDelta(scores, teamId, value), extra);
  };

  const clearBuzzers = () =>
    updateGame({
      "buzzRound+": 1,
      passedTeams: [],
      timerEndsAt: "",
      timerType: "",
      timerPausedRemaining: null,
    });

  const forceShowQuestion = () =>
    updateGame({ hostForceShowQuestion: !game?.hostForceShowQuestion });

  const startTimer = (type: "buzz" | "answer", seconds: number) =>
    updateGame({
      timerEndsAt: makeTimerEndsAt(seconds),
      timerType: type,
      timerPausedRemaining: null,
    });

  const pauseTimer = () => {
    const rem = computeRemainingSeconds(game?.timerEndsAt, game?.timerPausedRemaining);
    if (rem === null || rem <= 0) return;
    return updateGame({
      timerPausedRemaining: rem,
    });
  };

  const resumeTimer = () => {
    const rem = game?.timerPausedRemaining;
    if (typeof rem !== "number" || rem <= 0) return;
    return updateGame({
      timerEndsAt: makeTimerEndsAt(rem),
      timerPausedRemaining: null,
    });
  };

  const clearTimer = () =>
    updateGame({
      timerEndsAt: "",
      timerType: "",
      timerPausedRemaining: null,
    });

  return {
    game,
    settings,
    notFound,
    categories,
    questions,
    teams,
    usedQuestions,
    selectedTile,
    autoUnlock,
    setAutoUnlock,
    connected,
    buzzQueue,
    allInPhase,
    allIn,
    wagers,
    scores,
    wildcards,
    markingWildcards,
    setMarkingWildcards,
    allInOpen,
    setAllInOpen,
    adjust,
    setAdjust,
    scorePending,
    actionError,
    setActionError,
    updateGame,
    undoScore,
    applyAdjust,
    selectQuestion,
    lockInWildcard,
    scoreWildcard,
    startAllIn,
    markAllIn,
    startReveal,
    revealNext,
    finishGame,
    cancelQuestion,
    clearQuestion,
    toggleBuzzer,
    revealAnswer,
    updateTeamScore,
    clearBuzzers,
    forceShowQuestion,
    startTimer,
    pauseTimer,
    resumeTimer,
    clearTimer,
  };
}
