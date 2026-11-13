import { motion } from "framer-motion";
import type { BoardQuestion } from "@/lib/pbTypes";

type Props = {
  categories: string[];
  questions: BoardQuestion[][];
  values: number[];
  usedQuestions: string[];
};

export default function TvBoardGrid({ categories, questions, values, usedQuestions }: Props) {
  const cols = Math.max(categories.length, 1);
  const rowCount = Math.max(0, ...questions.map((qs) => qs.length));

  return (
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
        <div
          key={`cat-${i}`}
          className="bg-primary/90 flex items-center justify-center text-center p-2 font-bold text-lg md:text-2xl uppercase border-4 border-background shadow-inner shadow-black/20 rounded-sm text-primary-foreground backdrop-blur-sm"
        >
          {cat}
        </div>
      ))}
      {Array.from({ length: categories.length * rowCount }).map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const q = questions[col]?.[row];
        const value = q?.value ?? values[row];

        if (!q) {
          return (
            <div
              key={i}
              className="flex items-center justify-center text-center p-4 border-4 border-background bg-card/10 rounded-sm"
            />
          );
        }

        const isUsed = usedQuestions.includes(q.id);

        return (
          <div key={q.id || i} className="perspective-1000 w-full h-full cursor-pointer">
            <motion.div
              className="relative w-full h-full transform-style-3d transition-all duration-700 rounded-sm border-4 border-background"
              animate={{ rotateY: isUsed ? 180 : 0 }}
            >
              <div className="absolute inset-0 backface-hidden flex items-center justify-center p-4 text-3xl md:text-5xl font-bold font-mono shadow-inner shadow-black/30 bg-tile text-accent">
                {value}
              </div>
              <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center bg-card/20 text-muted-foreground" />
            </motion.div>
          </div>
        );
      })}
    </motion.div>
  );
}
