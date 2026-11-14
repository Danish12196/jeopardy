import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";
import type { QuestionCategoryRecord, QuestionRecord } from "@/lib/pbTypes";
import BulkQuestionRow, { type QuestionDraft } from "@/components/setup/BulkQuestionRow";
import { filterQuestions, parseTags } from "@/lib/contentLibrary";

const emptyRow = (): QuestionDraft => ({
  question: "",
  answer: "",
  hint: "",
  mediaUrl: "",
  mediaFile: null,
  questionType: "buzzer",
  optionsText: "",
  tagsText: "",
  value: 100,
  category: "",
  difficulty: "1",
  isPublic: false,
});

export default function AddBulkQuestionForm() {
  const [categories, setCategories] = useState<QuestionCategoryRecord[]>([]);
  const [existingQuestions, setExistingQuestions] = useState<QuestionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [diffFilter, setDiffFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const filteredLibrary = useMemo(
    () =>
      filterQuestions(existingQuestions, {
        query: searchQuery,
        difficulty: diffFilter,
        tag: tagFilter,
      }),
    [existingQuestions, searchQuery, diffFilter, tagFilter]
  );

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
    const parseOptions = (q: QuestionDraft) =>
      q.questionType === "multiple_choice" && q.optionsText
        ? q.optionsText.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    try {
      if (hasFiles) {
        for (const q of validQuestions) {
          const form = new FormData();
          form.append("question", q.question);
          form.append("answer", q.answer);
          form.append("hint", q.hint);
          form.append("mediaUrl", q.mediaUrl ?? "");
          form.append("questionType", q.questionType ?? "buzzer");
          form.append("options", JSON.stringify(parseOptions(q)));
          form.append("tags", JSON.stringify(parseTags(q.tagsText ?? "")));
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
            questionType: q.questionType ?? "buzzer",
            options: parseOptions(q),
            tags: parseTags(q.tagsText ?? ""),
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
      const refreshed = await pb.collection("questions").getFullList<QuestionRecord>({ sort: "-created", requestKey: null });
      setExistingQuestions(refreshed);
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
        const [records, qs] = await Promise.all([
          pb.collection("question_categories").getFullList<QuestionCategoryRecord>({ expand: "user", requestKey: null }),
          pb.collection("questions").getFullList<QuestionRecord>({ sort: "-created", requestKey: null }),
        ]);

        const currentUserId = pb.authStore.record?.id;
        const sorted = records.sort((a, b) => {
          const aMine = a.user === currentUserId;
          const bMine = b.user === currentUserId;
          if (aMine && !bMine) return -1;
          if (!aMine && bMine) return 1;
          return 0;
        });

        setCategories(sorted);
        setExistingQuestions(qs);
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

      <div className="pt-4 border-t border-border/40 space-y-3" data-testid="question-library">
        <h3 className="text-lg font-bold text-foreground">
          Question Library ({filteredLibrary.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions or answers..."
            aria-label="Search Question Library"
            className="flex-1 min-w-[200px] bg-background"
          />
          <select
            value={diffFilter}
            onChange={(e) => setDiffFilter(e.target.value)}
            aria-label="Filter by Difficulty"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All difficulties</option>
            {["1", "2", "3", "4", "5"].map((d) => (
              <option key={d} value={d}>Difficulty {d}</option>
            ))}
          </select>
          <Input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Filter by tag..."
            aria-label="Filter by Tag"
            className="w-40 bg-background"
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
          {filteredLibrary.slice(0, 50).map((q) => (
            <div key={q.id} className="bg-background/50 p-3 rounded-lg border border-border/30 flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <div className="font-semibold truncate">{q.question}</div>
                <div className="text-xs text-muted-foreground truncate">Answer: {q.answer}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(q.tags ?? []).map((t) => (
                  <span key={t} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
                {q.difficulty && (
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded">D{q.difficulty}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
