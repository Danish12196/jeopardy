import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";

export default function CreateTemplate() {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const cats = await pb.collection("question_categories").getFullList({ sort: "-created", expand: "user" });
            const qs = await pb.collection("questions").getFullList({ sort: "-created", expand: "user,category" });

            setAvailableCategories(cats);
            setAvailableQuestions(qs);
        } catch (err) {
            console.error("Failed to fetch data for create template:", err);
        }
    };
    fetchData();
  }, []);

  const toggleCategory = (id: string) => {
    if (selectedCategories.includes(id)) {
        setSelectedCategories(selectedCategories.filter(c => c !== id));
        // Also remove questions belonging to this category
        const questionsToRemove = availableQuestions.filter(q => q.category === id).map(q => q.id);
        setSelectedQuestions(selectedQuestions.filter(q => !questionsToRemove.includes(q)));
    } else {
        setSelectedCategories([...selectedCategories, id]);
    }
  };

  const toggleQuestion = (id: string) => {
      if (selectedQuestions.includes(id)) {
          setSelectedQuestions(selectedQuestions.filter(q => q !== id));
      } else {
          setSelectedQuestions([...selectedQuestions, id]);
      }
  };

  const createTemplate = async () => {
      if (!title.trim()) {
          setError("Title is required.");
          return;
      }
      if (selectedCategories.length === 0) {
          setError("Select at least one category.");
          return;
      }

      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
          await pb.collection("game_templates").create({
              title,
              isPublic,
              user: pb.authStore.model?.id,
              categories: selectedCategories,
              questions: selectedQuestions
          });
          setSuccess(true);
          setTitle("");
          setSelectedCategories([]);
          setSelectedQuestions([]);
          setIsPublic(false);

          setTimeout(() => setSuccess(false), 3000);
      } catch (err: any) {
          setError(err.message || "Failed to create template");
      } finally {
          setLoading(false);
      }
  };

  return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card/50 p-6 rounded-xl border border-border/40"
      >
          <h2 className="text-xl font-bold mb-6">Create New Template</h2>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
                <label className="block mb-2 text-sm font-semibold">Template Title</label>
                <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="E.g., Friday Trivia"
                    className="bg-background text-foreground h-12"
                />
            </div>
            <div className="flex items-end mb-1">
                <label className="flex items-center gap-3 text-sm bg-background/50 px-6 h-12 rounded-lg border border-border/50 cursor-pointer hover:bg-background/80 transition-colors">
                    <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-5 h-5 cursor-pointer accent-accent" />
                    Make Public
                </label>
            </div>
          </div>

          <div className="mb-8">
              <label className="block mb-3 font-semibold border-b border-border/50 pb-2">Select Categories</label>
              <div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto p-4 bg-background/30 rounded-xl border border-border/30 custom-scrollbar">
                  {availableCategories.map(cat => {
                      const isMine = cat.user === pb.authStore.model?.id;
                      return (
                          <motion.button
                              key={cat.id}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleCategory(cat.id)}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                  selectedCategories.includes(cat.id)
                                  ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50"
                              }`}
                          >
                              {cat.name} {!isMine && <span className="opacity-60 font-normal ml-1">(Public)</span>}
                          </motion.button>
                      );
                  })}
              </div>
          </div>

          <AnimatePresence>
          {selectedCategories.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8"
              >
                <label className="block mb-3 font-semibold border-b border-border/50 pb-2">Select Questions for Included Categories</label>
                <div className="flex flex-col gap-4 max-h-80 overflow-y-auto p-4 bg-background/30 rounded-xl border border-border/30 custom-scrollbar">
                    {selectedCategories.map(catId => {
                        const cat = availableCategories.find(c => c.id === catId);
                        const qs = availableQuestions.filter(q => q.category === catId);

                        return (
                            <div key={catId} className="bg-card/40 p-4 rounded-lg border border-border/40">
                                <h4 className="font-bold text-accent mb-3">{cat?.name}</h4>
                                {qs.length === 0 ? <p className="text-sm text-muted-foreground italic">No questions available.</p> : (
                                    <div className="flex flex-col gap-2">
                                        {qs.map(q => (
                                            <div
                                                key={q.id}
                                                onClick={() => toggleQuestion(q.id)}
                                                className={`p-3 rounded-lg cursor-pointer text-sm flex gap-3 transition-colors ${
                                                    selectedQuestions.includes(q.id)
                                                    ? "bg-primary/20 border border-primary/50"
                                                    : "bg-background/50 hover:bg-background/80 border border-border/20"
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedQuestions.includes(q.id)}
                                                    readOnly
                                                    className="mt-1 accent-primary w-4 h-4 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="font-semibold text-foreground">{q.question}</div>
                                                    <div className="text-muted-foreground mt-1">A: {q.answer}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
              </motion.div>
          )}
          </AnimatePresence>

          <Button
            onClick={createTemplate}
            disabled={loading}
            variant="jeopardy"
            className="w-full py-6 text-lg mt-4"
          >
              {loading ? "Creating..." : "Save Template"}
          </Button>

          <AnimatePresence>
            {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-sm text-destructive font-bold p-3 bg-destructive/10 rounded border border-destructive/20 text-center">{error}</motion.p>
            )}
            {success && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-sm text-green-400 font-bold p-3 bg-green-900/20 rounded border border-green-500/20 text-center">Template created successfully!</motion.p>
            )}
          </AnimatePresence>
      </motion.div>
  );
}
