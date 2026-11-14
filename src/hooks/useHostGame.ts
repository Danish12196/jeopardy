import { useEffect, useRef, useState } from "react";
import pb from "@/pb";
import { useGameSubscription } from "@/hooks/useGameSubscription";
import { useBuzzes } from "@/hooks/useBuzzes";
import { useWagers } from "@/hooks/useWagers";
import { useAnswers } from "@/hooks/useAnswers";
import { useTeamRegistrations } from "@/hooks/useTeamRegistrations";
import { useLiveConnection } from "@/hooks/useLiveConnection";
import { findQuestionPosition, loadGameState } from "@/lib/loadGameState";
import { computeRemainingSeconds, makeTimerEndsAt } from "@/lib/timer";
import { closestEstimationWinners, isTypedMatch, normalizeAnswer } from "@/lib/answerMatch";
import { buildStandings } from "@/lib/historyStats";
import { lowestScoringTeam, roundMultiplier, scaleQuestions } from "@/lib/gameModes";
import type { AllInState, BoardQuestion, GameRecord, GameTeam, TeamRecord, TeamRegistrationRecord } from "@/lib/pbTypes";
import {
  allInMaxWager,
  applyDelta,
  clampWager,
  normalizeSettings,
  pushHistory,
  restoreSnapshot,
  revealOrder,
  scoreOf,
  wrongDelta,
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
  const answers = useAnswers(game?.id, selectedTile?.questionData.id, game?.buzzRound ?? 0, reloadKey);
  const registrations = useTeamRegistrations(game?.id, reloadKey);
  const pendingRegistrations = registrations.filter((r) => r.status === "pending");
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
          const pos = findQuestionPosition(scaleQuestions(grouped, roundMultiplier(g.settings, g.round)), g.currentActiveQuestion);
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

  const finishGame = async () => {
    await updateGame({
      allInPhase: allInPhase ? "done" : "",
      gameOver: true,
      currentActiveQuestion: null,
      buzzerUnlocked: false,
      timerEndsAt: "",
      timerType: "",
      timerPausedRemaining: null,
    });
    if (game?.host && !game.gameOver) {
      const standings = buildStandings(teams, scores);
      const top = standings[0];
      try {
        await pb.collection("game_history").create({
          host: game.host,
          gameCode: game.uniqueID,
          title: game.title || `Game ${game.uniqueID}`,
          winnerName: top?.name ?? "",
          winnerScore: top?.score ?? 0,
          standings,
          finishedAt: new Date().toISOString(),
        });
      } catch {
        // Non-fatal: game is still marked finished even if history write fails.
      }
    }
  };

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

  const autoScoreAnswers = async () => {
    if (!selectedTile || answers.length === 0) return;
    const q = selectedTile.questionData;
    const qType = q.questionType || "buzzer";
    const expected = q.answer;
    const pts = selectedTile.value;

    let nextScores = [...scores];
    if (qType === "estimation") {
      const winners = closestEstimationWinners(
        answers.map((a) => ({ team: a.team, value: a.value })),
        expected
      );
      for (const teamId of winners) {
        nextScores = applyDelta(nextScores, teamId, pts);
      }
    } else {
      const penalty = wrongDelta(pts, settings.wrongPenalty);
      for (const a of answers) {
        const ok =
          qType === "typed"
            ? isTypedMatch(a.value, expected)
            : normalizeAnswer(a.value) === normalizeAnswer(expected);
        if (ok) {
          nextScores = applyDelta(nextScores, a.team, pts);
        } else if (penalty !== 0) {
          nextScores = applyDelta(nextScores, a.team, penalty);
        }
      }
    }

    await changeScores(nextScores, { showAnswer: true });
  };

  const approveRegistration = async (reg: TeamRegistrationRecord) => {
    if (!game?.id) return;
    const createdTeam = await pb.collection("teams").create<TeamRecord>({
      name: reg.name,
      color: reg.color ?? "",
      emoji: reg.emoji ?? "",
      members: reg.members ?? [],
      user: pb.authStore.record?.id,
      isPublic: true,
    });
    const nextTeamIds = [...(game.teams ?? []), createdTeam.id];
    const nextScores = [...scores, { id: createdTeam.id, score: 0 }];
    setTeams((prev) => [
      ...prev,
      {
        id: createdTeam.id,
        name: createdTeam.name,
        score: 0,
        ...(createdTeam.color ? { color: createdTeam.color } : {}),
        ...(createdTeam.emoji ? { emoji: createdTeam.emoji } : {}),
        ...(Array.isArray(createdTeam.members) && createdTeam.members.length > 0
          ? { members: createdTeam.members }
          : {}),
      },
    ]);
    await updateGame({ teams: nextTeamIds, teamScores: nextScores });
    await pb.collection("team_registrations").update(reg.id, { status: "approved" });
  };

  const rejectRegistration = async (reg: TeamRegistrationRecord) => {
    await pb.collection("team_registrations").update(reg.id, { status: "rejected" });
  };

  const togglePause = async () => {
    if (!game) return;
    const nextPaused = !game.paused;
    if (nextPaused && game.timerEndsAt) {
      const rem = computeRemainingSeconds(game.timerEndsAt);
      await updateGame({ paused: true, timerEndsAt: "", timerPausedRemaining: rem });
    } else {
      await updateGame({ paused: nextPaused });
    }
  };

  const reopenQuestion = async (questionId: string) => {
    if (!game?.id) return;
    const updatedUsed = usedQuestions.filter((id) => id !== questionId);
    setUsedQuestions(updatedUsed);
    await updateGame({ answeredQuestions: updatedUsed });
  };

  const editActiveQuestion = async (questionId: string, nextQuestion: string, nextAnswer: string) => {
    await pb.collection("questions").update(questionId, {
      question: nextQuestion,
      answer: nextAnswer,
    });
    setQuestions((prev) =>
      prev.map((col) =>
        col.map((q) => (q.id === questionId ? { ...q, question: nextQuestion, answer: nextAnswer } : q))
      )
    );
    setSelectedTile((prev) =>
      prev && prev.questionData.id === questionId
        ? { ...prev, questionData: { ...prev.questionData, question: nextQuestion, answer: nextAnswer } }
        : prev
    );
  };

  const toggleLockTeam = async (teamId: string) => {
    const locked = game?.lockedTeams ?? [];
    const nextLocked = locked.includes(teamId)
      ? locked.filter((id) => id !== teamId)
      : [...locked, teamId];
    await updateGame({ lockedTeams: nextLocked });
  };

  const kickTeam = async (teamId: string) => {
    if (!game) return;
    const nextTeams = (game.teams ?? []).filter((id) => id !== teamId);
    const nextScores = scores.filter((s) => s.id !== teamId);
    const nextLocked = (game.lockedTeams ?? []).filter((id) => id !== teamId);
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
    await updateGame({ teams: nextTeams, teamScores: nextScores, lockedTeams: nextLocked });
  };

  const startNextRound = async () => {
    if (!game) return;
    setUsedQuestions([]);
    setSelectedTile(null);
    await updateGame({
      round: (game.round ?? 1) + 1,
      answeredQuestions: [],
      currentActiveQuestion: null,
      showAnswer: false,
      buzzerUnlocked: false,
      "buzzRound+": 1,
      passedTeams: [],
      wildcard: null,
    });
  };

  const eliminateLowestTeam = async () => {
    if (!game) return;
    const id = lowestScoringTeam(game.teams ?? [], scores, game.eliminatedTeams);
    if (!id) return;
    await updateGame({
      eliminatedTeams: [...(game.eliminatedTeams ?? []), id],
      lockedTeams: [...new Set([...(game.lockedTeams ?? []), id])],
    });
  };

  const startTiebreaker = (question: string, answer: string) =>
    updateGame({ tiebreaker: { question, answer, showAnswer: false } });

  const revealTiebreaker = () =>
    game?.tiebreaker ? updateGame({ tiebreaker: { ...game.tiebreaker, showAnswer: true } }) : Promise.resolve();

  const endTiebreaker = () => updateGame({ tiebreaker: null });

  const ensureCohostCode = async (): Promise<string | null> => {
    if (!game) return null;
    if (game.cohostCode) return game.cohostCode;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    await updateGame({ cohostCode: code });
    return code;
  };

  return {
    game,
    settings,
    notFound,
    categories,
    questions: scaleQuestions(questions, roundMultiplier(game?.settings, game?.round)),
    teams,
    usedQuestions,
    selectedTile,
    autoUnlock,
    setAutoUnlock,
    connected,
    buzzQueue,
    answers,
    pendingRegistrations,
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
    autoScoreAnswers,
    approveRegistration,
    rejectRegistration,
    togglePause,
    reopenQuestion,
    editActiveQuestion,
    toggleLockTeam,
    kickTeam,
    ensureCohostCode,
    startNextRound,
    eliminateLowestTeam,
    startTiebreaker,
    revealTiebreaker,
    endTiebreaker,
  };
}
