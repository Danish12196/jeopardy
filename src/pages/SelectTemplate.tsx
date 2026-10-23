import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function makeGameCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export default function SelectTemplate({ selectedTeams }: { selectedTeams: string[] }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [values, setValues] = useState<number[]>([]);

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const records = await pb
            .collection("game_templates")
            .getFullList({
            sort: "-created",
            expand: "user",
            });

        const sorted = records.sort((a, b) => {
            const aMine = a.user === pb.authStore.model?.id;
            const bMine = b.user === pb.authStore.model?.id;
            if (aMine && !bMine) return -1;
            if (!aMine && bMine) return 1;
            return 0;
        });

        setTemplates(sorted);
      } catch (err) {
          console.error("Failed to fetch templates:", err);
      }
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    const fetchTemplateDetails = async () => {
      if (!selectedTemplate) return;
      try {
          const categoryRecords = await Promise.all(
            selectedTemplate.categories.map((id: string) =>
              pb.collection("question_categories").getOne(id)
            )
          );
          setCategories(categoryRecords.map((cat) => cat.name));

          const qs = await pb.collection("questions").getFullList({
              filter: selectedTemplate.questions.map((id: string) => `id="${id}"`).join(" || ")
          });

          let maxQs = 0;
          for (const catId of selectedTemplate.categories) {
              const qCount = qs.filter(q => q.category === catId).length;
              if (qCount > maxQs) maxQs = qCount;
          }

          setValues(Array.from({ length: maxQs }, (_, i) => (i + 1) * 100));

      } catch (err) {
          console.error("Failed to fetch template details:", err);
      }
    };
    fetchTemplateDetails();
  }, [selectedTemplate]);

  const startGame = async () => {
    if (!selectedTemplate || starting) return;
    if (selectedTeams.length === 0) {
      setError("Please select at least one team above.");
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const uniqueID = makeGameCode();
      await pb.collection("games").create({
        title: `Game: ${selectedTemplate.title}`,
        uniqueID,
        template: selectedTemplate.id,
        teams: selectedTeams,
        categories,
        values,
        teamScores: selectedTeams.map((t) => ({ id: t, score: 0 })),
        answeredQuestions: [],
        buzzerQueue: [],
        showAnswer: false,
        buzzerUnlocked: false,
        hostForceShowQuestion: false
      });

      navigate(`/game/${uniqueID}/host`);
    } catch (err) {
      console.error("Failed to create game:", err);
      setError("Couldn't create the game. Check the console for details.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card/50 p-6 rounded-xl border border-border/40"
    >
      <label className="block mb-3 font-semibold text-lg">Select a Template to Play</label>
      <Select
        value={selectedTemplate?.id || ""}
        onValueChange={(val) => {
          const t = templates.find((t) => t.id === val);
          setSelectedTemplate(t || null);
        }}
      >
        <SelectTrigger className="w-full md:w-2/3 h-12 text-md bg-background">
          <SelectValue placeholder="Choose a template..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => {
            const isMine = template.user === pb.authStore.model?.id;
            const authorName = template.expand?.user?.username || template.expand?.user?.email || "Unknown";
            return (
                <SelectItem key={template.id} value={template.id}>
                {template.title} {isMine ? "(Yours)" : `(by ${authorName})`}
                </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <AnimatePresence>
      {selectedTemplate && (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 text-sm bg-background/50 p-6 rounded-xl border border-border/50 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div>
              <p className="text-muted-foreground uppercase text-xs font-bold tracking-wider mb-1">Title</p>
              <p className="font-semibold text-lg truncate" title={selectedTemplate.title}>{selectedTemplate.title}</p>
          </div>
          <div>
              <p className="text-muted-foreground uppercase text-xs font-bold tracking-wider mb-1">Categories</p>
              <p className="font-semibold text-lg">{selectedTemplate.categories.length}</p>
          </div>
          <div>
              <p className="text-muted-foreground uppercase text-xs font-bold tracking-wider mb-1">Questions</p>
              <p className="font-semibold text-lg">{selectedTemplate.questions.length}</p>
          </div>
          <div>
              <p className="text-muted-foreground uppercase text-xs font-bold tracking-wider mb-1">Board Size</p>
              <p className="font-semibold text-lg">{categories.length}x{values.length}</p>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <Button
        onClick={startGame}
        disabled={!selectedTemplate || starting || selectedTeams.length === 0}
        variant="jeopardy"
        className="mt-8 w-full md:w-auto md:min-w-[200px] h-14 text-lg"
      >
        {starting ? "Starting Game..." : "Start Game"}
      </Button>

      <AnimatePresence>
      {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-sm text-destructive font-bold bg-destructive/10 p-3 rounded-lg border border-destructive/20 inline-block"
          >
              {error}
          </motion.p>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
