import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import pb from "@/pb";

type Question = {
  question: string;
  answer: string;
  hint: string;
  value: number;
  category: string;
  difficulty: string;
  isPublic: boolean;
};

// Order of questions within a category (1 = easiest, shown as the lowest value).
const difficultyOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export default function AddBulkQuestionForm() {
  const [categories, setCategories] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([
    {
      question: "",
      answer: "",
      hint: "",
      value: 100,
      category: "",
      difficulty: "1",
      isPublic: false
    },
  ]);
  const [success, setSuccess] = useState(false);

  const updateQuestion = <K extends keyof Question>(
    index: number,
    key: K,
    value: Question[K]
  ) => {
    const updated = [...questions];
    updated[index][key] = value;
    setQuestions(updated);
  };

  const addRow = () => {
    setQuestions([
      ...questions,
      {
        question: "",
        answer: "",
        hint: "",
        value: 100,
        category: "",
        difficulty: "1",
        isPublic: false
      },
    ]);
  };

  const removeRow = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitAll = async () => {
    const validQuestions = questions.filter(
      (q) =>
        q.question.trim() && q.answer.trim() && q.category.trim()
    );

    if (validQuestions.length === 0) return;

    const batch = pb.createBatch();

    for (const q of validQuestions) {
      batch.collection("questions").create({
          ...q,
          difficulty: Number(q.difficulty),
          user: pb.authStore.model?.id
      });
    }

    try {
      await batch.send();
      setQuestions([
        {
          question: "",
          answer: "",
          hint: "",
          value: 100,
          category: "",
          difficulty: "1",
          isPublic: false
        },
      ]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Batch error:", err);
    }
  };

  useEffect(() => {
    const loadCategories = async () => {
      try {
          const records = await pb
            .collection("question_categories")
            .getFullList({ expand: "user" });

          const sorted = records.sort((a, b) => {
              const aMine = a.user === pb.authStore.model?.id;
              const bMine = b.user === pb.authStore.model?.id;
              if (aMine && !bMine) return -1;
              if (!aMine && bMine) return 1;
              return 0;
          });

          setCategories(sorted);
      } catch (err) {
          console.error("Failed to load categories:", err);
      }
    };
    loadCategories();
  }, []);

  return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 bg-card/50 p-6 rounded-xl border border-border/40"
    >
      <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border/50 shadow-inner bg-background/30">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/30 text-left text-muted-foreground uppercase tracking-wider text-xs">
              <th className="p-4 font-bold">Question</th>
              <th className="p-4 font-bold">Answer</th>
              <th className="p-4 font-bold">Hint</th>
              <th className="p-4 font-bold w-24">Value</th>
              <th className="p-4 font-bold w-48">Category</th>
              <th className="p-4 font-bold w-28">Order</th>
              <th className="p-4 font-bold w-24 text-center">Public</th>
              <th className="p-4 font-bold w-20 text-center"></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
            {questions.map((q, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors"
              >
                <td className="p-2">
                  <Input
                    value={q.question}
                    onChange={(e) =>
                      updateQuestion(i, "question", e.target.value)
                    }
                    className="bg-background text-foreground"
                    placeholder="Enter question"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={q.answer}
                    onChange={(e) =>
                      updateQuestion(i, "answer", e.target.value)
                    }
                    className="bg-background text-foreground"
                    placeholder="Answer"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={q.hint}
                    onChange={(e) => updateQuestion(i, "hint", e.target.value)}
                    className="bg-background text-foreground"
                    placeholder="Hint (optional)"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    value={q.value}
                    onChange={(e) =>
                      updateQuestion(i, "value", +e.target.value)
                    }
                    className="bg-background text-foreground"
                  />
                </td>
                <td className="p-2">
                  <Select
                    value={q.category}
                    onValueChange={(val) => updateQuestion(i, "category", val)}
                  >
                    <SelectTrigger className="bg-background text-foreground">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => {
                          const isMine = cat.user === pb.authStore.model?.id;
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
                  <Select
                    value={q.difficulty}
                    onValueChange={(val) =>
                      updateQuestion(i, "difficulty", val)
                    }
                  >
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
                        checked={q.isPublic}
                        onChange={(e) => updateQuestion(i, "isPublic", e.target.checked)}
                        className="w-5 h-5 cursor-pointer accent-accent"
                    />
                </td>
                <td className="p-2 text-center">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeRow(i)}
                    className="w-8 h-8 p-0 rounded-full"
                    title="Remove row"
                  >
                    ✕
                  </Button>
                </td>
              </motion.tr>
            ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Button onClick={addRow} variant="secondary" className="sm:w-48 font-bold border-2 border-transparent hover:border-border">
            + Add Row
        </Button>
        <Button onClick={handleSubmitAll} variant="jeopardy" className="flex-1">
          Save All Valid Questions
        </Button>
      </div>

      <AnimatePresence>
          {success && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-green-400 font-bold text-center bg-green-900/20 p-3 rounded-lg"
              >
                  Questions saved successfully!
              </motion.p>
          )}
      </AnimatePresence>
    </motion.div>
  );
}
