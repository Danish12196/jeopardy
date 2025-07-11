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
import superuserClient from "@/super-user.js";
import { ScrollArea } from "@/components/ui/scroll-area"; // Optional for horizontal overflow

type Question = {
  question: string;
  answer: string;
  hint: string;
  value: number;
  category: string;
  difficulty: string;
};

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
    },
  ]);
  const [difficultyOptions, setDifficultyOptions] = useState<string[]>([]);

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
      },
    ]);
  };

  const removeRow = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitAll = async () => {
    const validQuestions = questions.filter(
      (q) =>
        q.question.trim() && q.answer.trim() && q.value && q.category.trim()
    );

    const batch = superuserClient.createBatch();

    for (const q of validQuestions) {
      batch.collection("questions").create(q);
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
        },
      ]);
    } catch (err) {
      console.error("Batch error:", err);
    }
  };

  useEffect(() => {
    const loadCategories = async () => {
      const records = await superuserClient
        .collection("question_categories")
        .getFullList();
      setCategories(records);
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const fetchFieldOptions = async () => {
      const records = await superuserClient.collections.getOne("questions");
      const difficultyField = records.fields.find(
        (f) => f.name === "difficulty" && f.type === "select"
      );

      if (difficultyField) {
        setDifficultyOptions(difficultyField.values || []);
      }
    };
    fetchFieldOptions();
  }, []);

  return (
    <div className="space-y-4">
      <ScrollArea className="max-w-full overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted text-left">
              <th className="p-2">Question</th>
              <th className="p-2">Answer</th>
              <th className="p-2">Hint</th>
              <th className="p-2">Value</th>
              <th className="p-2">Category</th>
              <th className="p-2">Difficulty</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">
                  <Input
                    value={q.question}
                    onChange={(e) =>
                      updateQuestion(i, "question", e.target.value)
                    }
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={q.answer}
                    onChange={(e) =>
                      updateQuestion(i, "answer", e.target.value)
                    }
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={q.hint}
                    onChange={(e) => updateQuestion(i, "hint", e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    value={q.value}
                    onChange={(e) =>
                      updateQuestion(i, "value", +e.target.value)
                    }
                  />
                </td>
                <td className="p-2">
                  <Select
                    value={q.category}
                    onValueChange={(val) => updateQuestion(i, "category", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select Difficulty" />
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
                <td className="p-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeRow(i)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      <div className="flex gap-4">
        <Button onClick={addRow}>Add Row</Button>
        <Button onClick={handleSubmitAll} variant="default">
          Create All
        </Button>
      </div>
    </div>
  );
}
