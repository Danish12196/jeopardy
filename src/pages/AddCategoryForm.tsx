import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
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
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await pb
      .collection("question_categories")
      .create({ name, difficulty, isPublic, user: pb.authStore.model?.id });
    setName("");
    setDifficulty("Easy");
    setIsPublic(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card/50 p-6 rounded-xl border border-border/40 max-w-xl mx-auto space-y-6"
    >
      <div className="space-y-2">
          <label className="text-sm font-semibold">Category Name</label>
          <Input
            placeholder="E.g., World History"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-background text-foreground h-12"
          />
      </div>

      <div className="space-y-2">
          <label className="text-sm font-semibold">Difficulty</label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="bg-background text-foreground h-12">
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
      </div>

      <div className="flex items-center gap-3 bg-background/30 p-4 rounded-lg border border-border/40">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-5 h-5 accent-accent cursor-pointer" />
          <div className="text-sm">
              <p className="font-semibold">Make Public</p>
              <p className="text-muted-foreground text-xs">Allow other users to see and use this category</p>
          </div>
      </div>

      <Button onClick={handleSubmit} variant="jeopardy" className="w-full h-14 text-lg">Add Category</Button>

      <AnimatePresence>
          {success && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-green-400 font-bold text-center bg-green-900/20 p-2 rounded"
              >
                  Category added!
              </motion.p>
          )}
      </AnimatePresence>
    </motion.div>
  );
}
