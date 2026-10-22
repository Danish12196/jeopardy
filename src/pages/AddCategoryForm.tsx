"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import pb from "@/pb";

const difficultyOptions = ["Easy", "Medium", "Hard"];

export default function AddCategoryForm() {
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await pb
      .collection("question_categories")
      .create({ name, difficulty, isPublic, user: pb.authStore.model?.id });
    setName("");
    setDifficulty("Easy");
    setIsPublic(false);
  };

  return (
    <div className="space-y-4 bg-blue-800 p-4 rounded border border-blue-600">
      <Input
        placeholder="Category Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-white text-black"
      />
      <Select value={difficulty} onValueChange={setDifficulty}>
        <SelectTrigger className="bg-white text-black">
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
      <div className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          Make Public
      </div>
      <Button onClick={handleSubmit} className="bg-yellow-400 text-black font-bold hover:bg-yellow-500 w-full">Add Category</Button>
    </div>
  );
}
