import React from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";
import useSound from "use-sound";

// You can replace this with a valid sound URL if you prefer.
// A simple beep data URI for the buzzer sound.
const buzzerSoundUrl = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export default function GameBoard() {
  const { uniqueID } = useParams();

  const [categories, setCategories] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[][]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; score: number }[]>([]);

  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);

  // Board size follows the template: one column per category, one row per question.
  const cols = Math.max(categories.length, 1);
  const rowCount = Math.max(0, ...questions.map((qs) => qs.length));
  // Keep values matching the row count (100, 200, ...)
  const values = Array.from({ length: rowCount }, (_, i) => (i + 1) * 100);

  const [activeQuestion, setActiveQuestion] = useState<any | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [buzzerQueue, setBuzzerQueue] = useState<any[]>([]);
  const [hostForceShowQuestion, setHostForceShowQuestion] = useState(false);

  // Use a generic pop sound for revealing questions/answers (fallback to native browser handling if needed)
  const [playBuzzer] = useSound(buzzerSoundUrl, { volume: 0.5 });
  const lastBuzzerCountRef = React.useRef(0);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameList = await pb.collection("games").getFullList({
          filter: `uniqueID = "${uniqueID}"`,
        });
        if (gameList.length === 0) return;
        const g = gameList[0];
        setGameId(g.id);

        const template = await pb.collection("game_templates").getOne(g.template);
        const categoryRecords = await Promise.all(
          template.categories.map((id: string) =>
            pb.collection("question_categories").getOne(id)
          )
        );

        const allQuestions = await pb
          .collection("questions")
          .getFullList({
            filter: template.questions.map((id: string) => `id="${id}"`).join(" || "),
          });

        const grouped = categoryRecords.map((cat) => {
          return allQuestions
            .filter((q) => q.category === cat.id)
            .sort((a, b) => a.difficulty - b.difficulty)
            .map((q, i) => ({
              id: q.id,
              question: q.question,
              answer: q.answer,
              value: (i + 1) * 100,
            }));
        });

        const teamRecords = await Promise.all(
          g.teams.map((id: string) => pb.collection("teams").getOne(id))
        );

        setCategories(categoryRecords.map((c) => c.name));
        setQuestions(grouped);

        const mappedTeams = teamRecords.map((t) => ({
          id: t.id,
          name: t.name,
          score: g.teamScores?.find((ts: any) => ts.id === t.id)?.score || 0,
        }));

        setTeams(mappedTeams);
        setUsedQuestions(g.answeredQuestions || []);

        if (g.currentActiveQuestion) {
          const flatQs = grouped.flat();
          const active = flatQs.find(q => q.id === g.currentActiveQuestion);
          if (active) setActiveQuestion(active);
        }
        setShowAnswer(g.showAnswer || false);
        setHostForceShowQuestion(g.hostForceShowQuestion || false);

        const queue = g.buzzerQueue || [];
        setBuzzerQueue(queue);
        lastBuzzerCountRef.current = queue.length;

      } catch (err) {
        console.error("Board fetch error:", err);
      }
    };

    fetchGame();
  }, [uniqueID]);

  useEffect(() => {
    if (!gameId) return;

    const sub = async () => {
      await pb.collection("games").subscribe(gameId, (event) => {
        const g = event.record;

        setUsedQuestions(g.answeredQuestions || []);
        setShowAnswer(g.showAnswer || false);
        setHostForceShowQuestion(g.hostForceShowQuestion || false);

        const newQueue = g.buzzerQueue || [];
        setBuzzerQueue(newQueue);

        // Play sound if someone new buzzed in
        if (newQueue.length > lastBuzzerCountRef.current) {
            try { playBuzzer(); } catch(e) { console.warn("Failed to play buzzer sound", e); }
        }
        lastBuzzerCountRef.current = newQueue.length;

        setTeams((prev) =>
          prev.map((t) => ({
            ...t,
            score: g.teamScores?.find((ts: any) => ts.id === t.id)?.score ?? t.score,
          }))
        );

        if (g.currentActiveQuestion) {
          setQuestions((prevQs) => {
            const flatQs = prevQs.flat();
            const active = flatQs.find((q) => q.id === g.currentActiveQuestion);
            if (active) setActiveQuestion(active);
            return prevQs;
          });
        } else {
          setActiveQuestion(null);
        }
      });
    };

    sub();
    return () => {
      pb.collection("games").unsubscribe(gameId);
    };
  }, [gameId, playBuzzer]);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 overflow-hidden bg-background bg-animated-gradient">
      {/* Scoreboard at Top */}
      <div className="flex justify-center gap-4 md:gap-8 mb-6 md:mb-8 flex-wrap">
        <AnimatePresence>
            {teams.map((team) => (
            <motion.div
                key={team.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                layout
                className="bg-card/80 backdrop-blur-md border-2 border-primary/50 rounded-xl px-4 md:px-8 py-2 md:py-4 text-center shadow-lg w-32 md:w-48 transition-colors"
            >
                <h2 className="font-bold text-lg md:text-2xl mb-1 md:mb-2 truncate text-foreground" title={team.name}>{team.name}</h2>
                <motion.p
                    key={team.score}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-accent text-2xl md:text-4xl font-mono font-bold"
                >
                    ${team.score}
                </motion.p>
            </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 flex items-center justify-center w-full overflow-x-auto pb-4">
        <AnimatePresence mode="wait">
        {!activeQuestion ? (
          <motion.div
            key="board"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            transition={{ duration: 0.5 }}
            className="grid gap-2 w-full max-w-7xl min-w-[800px] h-[65vh] md:h-[70vh]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {categories.map((cat, i) => (
              <div key={`cat-${i}`} className="bg-primary/90 flex items-center justify-center text-center p-2 font-bold text-lg md:text-2xl uppercase border-4 border-background shadow-inner shadow-black/20 rounded-sm text-primary-foreground backdrop-blur-sm">
                {cat}
              </div>
            ))}
            {Array.from({ length: categories.length * rowCount }).map((_, i) => {
              const col = i % cols;
              const row = Math.floor(i / cols);
              const value = values[row];
              const q = questions[col]?.[row];

              if (!q) {
                  return (
                      <div key={i} className="flex items-center justify-center text-center p-4 border-4 border-background bg-card/10 rounded-sm" />
                  );
              }

              const isUsed = usedQuestions.includes(q.id);

              return (
                <div
                  key={q.id || i}
                  className="perspective-1000 w-full h-full cursor-pointer"
                >
                    <motion.div
                        className="relative w-full h-full transform-style-3d transition-all duration-700 rounded-sm border-4 border-background"
                        animate={{ rotateY: isUsed ? 180 : 0 }}
                    >
                        {/* Front of tile */}
                        <div className={`absolute inset-0 backface-hidden flex items-center justify-center p-4 text-3xl md:text-5xl font-bold font-mono shadow-inner shadow-black/30 bg-primary text-accent`}>
                            ${value}
                        </div>
                        {/* Back of tile (Empty/Used state) */}
                        <div className={`absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center bg-card/20 text-muted-foreground`}>
                            {/* Empty space */}
                        </div>
                    </motion.div>
                </div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="question-card"
            initial={{ rotateY: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
            exit={{ rotateY: 90, opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", damping: 15, stiffness: 100 }}
            className="w-full max-w-5xl aspect-video bg-primary/95 border-8 border-accent rounded-3xl shadow-[0_0_100px_rgba(var(--accent),0.3)] flex flex-col items-center justify-center p-8 md:p-16 text-center transform-style-3d relative overflow-hidden backdrop-blur-xl"
          >
            {/* Background decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent pointer-events-none" />

             <AnimatePresence>
                 {buzzerQueue.length > 0 && !showAnswer && (
                     <motion.div
                        initial={{ y: -50, opacity: 0, scale: 0.8 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="absolute top-8 bg-destructive text-destructive-foreground px-6 md:px-10 py-3 md:py-4 rounded-full text-2xl md:text-4xl font-bold shadow-2xl z-20 flex items-center gap-4 border-4 border-background"
                     >
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-20 -left-0 -top-0"></span>
                         🎤 {teams.find(t => t.id === buzzerQueue[0].teamId)?.name} buzzed in!
                     </motion.div>
                 )}
             </AnimatePresence>

             {buzzerQueue.length > 0 && !showAnswer && (
                 <div className="absolute top-1/4 mt-8 md:mt-12 text-white/80 text-sm md:text-lg z-10 flex flex-col gap-1">
                    {buzzerQueue.length > 1 && buzzerQueue.slice(1).map((q, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-black/40 px-4 py-1 rounded-full backdrop-blur-sm"
                        >
                            {teams.find(t => t.id === q.teamId)?.name} (+{((q.time - buzzerQueue[0].time) / 1000).toFixed(2)}s)
                        </motion.div>
                    ))}
                 </div>
             )}

            {/* If someone buzzed, hide the question unless host overrides */}
            <AnimatePresence mode="wait">
                {(!buzzerQueue.length || hostForceShowQuestion || showAnswer) ? (
                    <motion.h1
                        key="question-text"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-4xl md:text-7xl font-bold leading-tight md:leading-tight mb-8 z-10 text-primary-foreground drop-shadow-xl"
                    >
                    {activeQuestion.question}
                    </motion.h1>
                ) : (
                    <motion.div key="hidden-question" className="h-32" /> // spacer
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showAnswer && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="text-3xl md:text-6xl font-bold text-accent z-10 mt-8 px-8 py-4 bg-background/50 rounded-2xl border-2 border-accent/50 backdrop-blur-md shadow-2xl"
                >
                    {activeQuestion.answer}
                </motion.div>
                )}
            </AnimatePresence>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
