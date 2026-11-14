import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";
import type { QuestionCategoryRecord } from "@/lib/pbTypes";
import BulkQuestionRow, { type QuestionDraft } from "@/components/setup/BulkQuestionRow";

const emptyRow = (): QuestionDraft => ({
  question: "",
  answer: "",
  hint: "",
  mediaUrl: "",
  mediaFile: null,
  value: 100,
  category: "",
  difficulty: "1",
  isPublic: false,
});

export default function AddBulkQuestionForm() {
  const [categories, setCategories] = useState<QuestionCategoryRecord[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateQuestion = <K extends keyof QuestionDraft>(
    index: number,
    key: K,
    value: QuestionDraft[K]
  ) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, [key]: value } : q)));
  };

  const addRow = () => setQuestions((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== index));

  const handleSubmitAll = async () => {
    const validQuestions = questions.filter(
      (q) => q.question.trim() && q.answer.trim() && q.category.trim()
    );

    if (validQuestions.length === 0) {
      setError("Fill in question, answer, and category for at least one row.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const hasFiles = validQuestions.some((q) => q.mediaFile);

    try {
      if (hasFiles) {
        for (const q of validQuestions) {
          const form = new FormData();
          form.append("question", q.question);
          form.append("answer", q.answer);
          form.append("hint", q.hint);
          form.append("mediaUrl", q.mediaUrl ?? "");
          form.append("value", String(q.value));
          form.append("category", q.category);
          form.append("difficulty", String(Number(q.difficulty)));
          form.append("isPublic", String(q.isPublic));
          if (pb.authStore.record?.id) form.append("user", pb.authStore.record.id);
          if (q.mediaFile) form.append("media", q.mediaFile);
          await pb.collection("questions").create(form);
        }
      } else {
        const batch = pb.createBatch();
        for (const q of validQuestions) {
          batch.collection("questions").create({
            question: q.question,
            answer: q.answer,
            hint: q.hint,
            mediaUrl: q.mediaUrl ?? "",
            value: q.value,
            category: q.category,
            difficulty: Number(q.difficulty),
            isPublic: q.isPublic,
            user: pb.authStore.record?.id,
          });
        }
        await batch.send();
      }
      setQuestions([emptyRow()]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      console.error("Batch error:", err);
      setError(err instanceof Error ? err.message : "Failed to save questions.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const records = await pb
          .collection("question_categories")
          .getFullList<QuestionCategoryRecord>({ expand: "user" });

        const currentUserId = pb.authStore.record?.id;
        const sorted = records.sort((a, b) => {
          const aMine = a.user === currentUserId;
          const bMine = b.user === currentUserId;
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
                <BulkQuestionRow
                  key={i}
                  row={q}
                  categories={categories}
                  currentUserId={pb.authStore.record?.id}
                  onUpdate={(key, value) => updateQuestion(i, key, value)}
                  onRemove={() => removeRow(i)}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={addRow}
          variant="secondary"
          className="sm:w-48 font-bold border-2 border-transparent hover:border-border"
        >
          + Add Row
        </Button>
        <Button onClick={handleSubmitAll} disabled={submitting} variant="brand" className="flex-1">
          {submitting ? "Saving..." : "Save All Valid Questions"}
        </Button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-destructive font-bold text-center bg-destructive/10 p-3 rounded-lg border border-destructive/20"
          >
            {error}
          </motion.p>
        )}
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
