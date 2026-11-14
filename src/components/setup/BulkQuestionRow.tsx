import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { QuestionCategoryRecord, QuestionType } from "@/lib/pbTypes";

export type QuestionDraft = {
  question: string;
  answer: string;
  hint: string;
  mediaUrl?: string;
  mediaFile?: File | null;
  questionType?: QuestionType;
  optionsText?: string;
  tagsText?: string;
  value: number;
  category: string;
  difficulty: string;
  isPublic: boolean;
};

// Order of questions within a category (1 = easiest, shown as the lowest value).
const difficultyOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

type Props = {
  row: QuestionDraft;
  categories: QuestionCategoryRecord[];
  currentUserId?: string;
  onUpdate: <K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) => void;
  onRemove: () => void;
};

export default function BulkQuestionRow({
  row,
  categories,
  currentUserId,
  onUpdate,
  onRemove,
}: Props) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors"
    >
      <td className="p-2 space-y-1">
        <Input
          value={row.question}
          onChange={(e) => onUpdate("question", e.target.value)}
          className="bg-background text-foreground"
          placeholder="Enter question"
        />
        <Select
          value={row.questionType ?? "buzzer"}
          onValueChange={(val) => onUpdate("questionType", val as QuestionType)}
        >
          <SelectTrigger aria-label="Question Type" className="bg-background text-foreground h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buzzer">Buzzer</SelectItem>
            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
            <SelectItem value="typed">Typed Answer</SelectItem>
            <SelectItem value="estimation">Estimation</SelectItem>
          </SelectContent>
        </Select>
        {row.questionType === "multiple_choice" && (
          <Input
            value={row.optionsText ?? ""}
            onChange={(e) => onUpdate("optionsText", e.target.value)}
            className="bg-background text-foreground text-xs h-8"
            placeholder="Options (comma-separated, e.g. A, B, C, D)"
            aria-label="Multiple Choice Options"
          />
        )}
        <Input
          value={row.tagsText ?? ""}
          onChange={(e) => onUpdate("tagsText", e.target.value)}
          className="bg-background text-foreground text-xs h-8"
          placeholder="Tags (comma-separated)"
          aria-label="Question Tags"
        />
      </td>
      <td className="p-2">
        <Input
          value={row.answer}
          onChange={(e) => onUpdate("answer", e.target.value)}
          className="bg-background text-foreground"
          placeholder="Answer"
        />
      </td>
      <td className="p-2 space-y-1">
        <Input
          value={row.hint}
          onChange={(e) => onUpdate("hint", e.target.value)}
          className="bg-background text-foreground"
          placeholder="Hint (optional)"
        />
        <Input
          value={row.mediaUrl ?? ""}
          onChange={(e) => onUpdate("mediaUrl", e.target.value)}
          className="bg-background text-foreground text-xs h-8"
          placeholder="Media URL (optional)"
          aria-label="Media URL"
        />
        <input
          type="file"
          accept="image/*,audio/*,video/*"
          aria-label="Media file"
          onChange={(e) => onUpdate("mediaFile", e.target.files?.[0] ?? null)}
          className="block w-full text-[11px] text-muted-foreground"
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          value={row.value}
          onChange={(e) => onUpdate("value", +e.target.value)}
          className="bg-background text-foreground"
        />
      </td>
      <td className="p-2">
        <Select value={row.category} onValueChange={(val) => onUpdate("category", val)}>
          <SelectTrigger className="bg-background text-foreground">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => {
              const isMine = cat.user === currentUserId;
              return (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name} {!isMine && <span className="opacity-50 text-xs ml-1">(Public)</span>}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <Select value={row.difficulty} onValueChange={(val) => onUpdate("difficulty", val)}>
          <SelectTrigger className="bg-background text-foreground">
            <SelectValue placeholder="Order" />
          </SelectTrigger>
          <SelectContent>
            {difficultyOptions.map((diff) => (
              <SelectItem key={diff} value={diff}>
                Level {diff}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 text-center">
        <input
          type="checkbox"
          checked={row.isPublic}
          onChange={(e) => onUpdate("isPublic", e.target.checked)}
          className="w-5 h-5 cursor-pointer accent-accent"
        />
      </td>
      <td className="p-2 text-center">
        <Button
          variant="destructive"
          size="sm"
          onClick={onRemove}
          className="w-8 h-8 p-0 rounded-full"
          title="Remove row"
        >
          ✕
        </Button>
      </td>
    </motion.tr>
  );
}
