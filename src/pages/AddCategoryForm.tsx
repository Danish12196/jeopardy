"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import superuserClient from "@/super-user.js";

export default function AddCategoryForm() {
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [difficultyOptions, setDifficultyOptions] = useState<string[]>([]);

  useEffect(() => {
    const fetchFieldOptions = async () => {
      const records = await superuserClient.collections.getOne(
        "question_categories"
      );
      const difficultyField = records.fields.find(
        (f) => f.name === "difficulty" && f.type === "select"
      );

      if (difficultyField) {
        setDifficultyOptions(difficultyField.values || []);
      }
    };
    fetchFieldOptions();
  }, []);

  const handleSubmit = async () => {
    await superuserClient
      .collection("question_categories")
      .create({ name, difficulty, isPublic: true });
    setName("");
    setDifficulty("Easy");
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Category Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Select value={difficulty} onValueChange={setDifficulty}>
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
      <Button onClick={handleSubmit}>Add Category</Button>
    </div>
  );
}
