import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import pb from "@/pb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Short code players type on the join page. No 0/O/1/I to avoid confusion.
function makeGameCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export default function SelectTemplate({ selectedTeams }: { selectedTeams: string[], availableTeams: any[] }) {
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

        // Filter based on our access rules (user owns it or it's public) is already handled by PocketBase
        // but we'll sort them to show user's templates first, then public ones.
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

          // Compute required values list based on max questions per category
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
    <div className="bg-blue-800 p-4 rounded border border-blue-600">
      <label className="block mb-2 font-semibold">Select Template:</label>
      <Select
        value={selectedTemplate?.id || ""}
        onValueChange={(val) => {
          const t = templates.find((t) => t.id === val);
          setSelectedTemplate(t || null);
        }}
      >
        <SelectTrigger className="bg-blue-950 text-white border-blue-500">
          <SelectValue placeholder="Choose a template..." />
        </SelectTrigger>
        <SelectContent className="bg-blue-950 text-white border-blue-500">
          {templates.map((template) => {
            const isMine = template.user === pb.authStore.model?.id;
            const authorName = template.expand?.user?.username || template.expand?.user?.email || "Unknown";
            return (
                <SelectItem key={template.id} value={template.id} className="focus:bg-blue-800">
                {template.title} {isMine ? "(Yours)" : `(by ${authorName})`}
                </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {selectedTemplate && (
        <div className="mt-4 text-sm text-gray-300 bg-blue-900 p-4 rounded border border-blue-700">
          <p><strong>Title:</strong> {selectedTemplate.title}</p>
          <p><strong>Categories:</strong> {categories.join(", ") || selectedTemplate.categories.length}</p>
          <p><strong>Questions:</strong> {selectedTemplate.questions.length}</p>
          <p><strong>Board Size:</strong> {categories.length}x{values.length}</p>
        </div>
      )}

      <Button
        onClick={startGame}
        disabled={!selectedTemplate || starting || selectedTeams.length === 0}
        className="mt-6 bg-yellow-400 text-black hover:bg-yellow-500 px-8 py-4 rounded font-bold w-full text-lg"
      >
        {starting ? "Starting Game..." : "Start Game"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-500 font-bold">{error}</p>}
    </div>
  );
}
