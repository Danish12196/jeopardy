"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import pb from "@/pb";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <div className="space-y-4 bg-blue-800 p-4 rounded border border-blue-600">
      <ScrollArea className="max-w-full overflow-auto rounded border border-blue-500">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blue-500 bg-blue-900 text-left text-white">
              <th className="p-2">Question</th>
              <th className="p-2">Answer</th>
              <th className="p-2">Hint</th>
              <th className="p-2 w-20">Value</th>
              <th className="p-2 w-48">Category</th>
              <th className="p-2 w-24">Order (Diff)</th>
              <th className="p-2 w-24">Public</th>
              <th className="p-2 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={i} className="border-b border-blue-600/50 bg-blue-950">
                <td className="p-2">
                  <Input
                    value={q.question}
                    onChange={(e) =>
                      updateQuestion(i, "question", e.target.value)
                    }
                    className="bg-white text-black"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={q.answer}
                    onChange={(e) =>
                      updateQuestion(i, "answer", e.target.value)
                    }
                    className="bg-white text-black"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={q.hint}
                    onChange={(e) => updateQuestion(i, "hint", e.target.value)}
                    className="bg-white text-black"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    value={q.value}
                    onChange={(e) =>
                      updateQuestion(i, "value", +e.target.value)
                    }
                    className="bg-white text-black"
                  />
                </td>
                <td className="p-2">
                  <Select
                    value={q.category}
                    onValueChange={(val) => updateQuestion(i, "category", val)}
                  >
                    <SelectTrigger className="bg-white text-black">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => {
                          const isMine = cat.user === pb.authStore.model?.id;
                          return (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name} {!isMine && "(Public)"}
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
                    <SelectTrigger className="bg-white text-black">
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent>
                      {difficultyOptions.map((diff) => (
                        <SelectItem key={diff} value={diff}>
                          {diff}
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
                        className="w-4 h-4 cursor-pointer"
                    />
                </td>
                <td className="p-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeRow(i)}
                    className="w-full"
                  >
                    Del
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      <div className="flex gap-4">
        <Button onClick={addRow} className="bg-blue-600 hover:bg-blue-500 font-bold text-white">Add Row</Button>
        <Button onClick={handleSubmitAll} className="bg-green-600 hover:bg-green-500 font-bold text-white flex-1">
          Save All Valid Questions
        </Button>
      </div>
    </div>
  );
}
