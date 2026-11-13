import { motion } from "framer-motion";
import type { BoardQuestion } from "@/lib/pbTypes";

type Props = {
  categories: string[];
  questions: BoardQuestion[][];
  values: number[];
  usedQuestions: string[];
  wildcards: string[];
  onSelectTile: (row: number, col: number, value: number, q: BoardQuestion) => void;
  onReopenTile?: (questionId: string) => void;
};

export default function HostBoardGrid({
  categories,
  questions,
  values,
  usedQuestions,
  wildcards,
  onSelectTile,
  onReopenTile,
}: Props) {
  const cols = Math.max(categories.length, 1);
  const rowCount = Math.max(0, ...questions.map((qs) => qs.length));

  return (
    <motion.div
      key="grid"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="grid gap-1 border-4 border-border bg-card/40 rounded-xl overflow-hidden p-2 shadow-lg"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {categories.map((cat, i) => (
        <div
          key={i}
          className="bg-primary text-primary-foreground text-center py-3 font-bold text-xs uppercase border border-border/50 truncate px-2 rounded-sm shadow-sm backdrop-blur-sm"
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
              className="flex items-center justify-center p-4 border border-border/20 bg-background/20 rounded-sm"
            />
          );
        }

        const isUsed = usedQuestions.includes(q.id);
        const isWildcard = wildcards.includes(q.id);

        return (
          <motion.button
            key={i}
            whileHover={!isUsed ? { scale: 1.05, zIndex: 10 } : {}}
            whileTap={!isUsed ? { scale: 0.95 } : {}}
            onClick={() => {
              if (!isUsed) onSelectTile(row, col, value, q);
              else if (onReopenTile) onReopenTile(q.id);
            }}
            aria-label={isUsed && onReopenTile ? `Reopen ${value}` : `${value}${isWildcard ? " Wildcard" : ""}`}
            title={isUsed && onReopenTile ? "Click to reopen question" : undefined}
            className={`relative flex items-center justify-center py-6 text-xl font-bold border transition-colors rounded-sm ${
              isWildcard && !isUsed ? "border-accent border-2" : "border-border/50"
            } ${
              isUsed
                ? "bg-card/20 text-muted-foreground hover:bg-card/40 cursor-pointer"
                : "bg-tile text-accent hover:bg-accent hover:text-accent-foreground shadow-md cursor-pointer"
            }`}
          >
            {value}
            {isUsed && onReopenTile && (
              <span className="absolute bottom-1 right-1 text-[10px] leading-none bg-secondary text-secondary-foreground px-1 py-0.5 rounded">
                Reopen
              </span>
            )}
            {isWildcard && !isUsed && (
              <span className="absolute top-1 right-1 text-[10px] leading-none bg-accent text-accent-foreground px-1 py-0.5 rounded font-bold">
                W
              </span>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
