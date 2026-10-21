import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function SelectTemplate({ teams }: { teams: string[] }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [categories, setCategories] = useState([
    "Cat 1",
    "Cat 2",
    "Cat 3",
    "Cat 4",
    "Cat 5",
    "Cat 6",
  ]);
  const [values, setValues] = useState([100, 200, 300, 400, 500]);

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      const records = await pb
        .collection("game_templates")
        .getFullList({
          sort: "-created",
        });

      setTemplates(records);
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    const fetchCategoryNames = async () => {
      if (!selectedTemplate) return;
      const categoryRecords = await Promise.all(
        selectedTemplate.categories.map((id: string) =>
          pb.collection("question_categories").getOne(id)
        )
      );
      const names = categoryRecords.map((cat) => cat.name);
      setCategories(names);
    };
    fetchCategoryNames();
  }, [selectedTemplate]);

  const startGame = async () => {
    if (!selectedTemplate || starting) return;
    const teamNames = teams.map((t) => t.trim()).filter(Boolean);
    if (teamNames.length === 0) {
      setError("Add at least one team.");
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const teamRecords = await Promise.all(
        teamNames.map((name) => pb.collection("teams").create({ name }))
      );

      const uniqueID = makeGameCode();
      await pb.collection("games").create({
        title: `Game: ${selectedTemplate.title}`,
        uniqueID,
        template: selectedTemplate.id,
        teams: teamRecords.map((t) => t.id),
        categories,
        values,
        teamScores: teamRecords.map((t) => ({ id: t.id, score: 0 })),
        answeredQuestions: [],
        buzzerQueue: [],
        showAnswer: false,
        buzzerUnlocked: false,
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
    <div>
      <label className="block mt-4 mb-2 font-semibold">Select Template:</label>
      <Select
        value={selectedTemplate?.id || ""}
        onValueChange={(val) => {
          const t = templates.find((t) => t.id === val);
          setSelectedTemplate(t || null);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedTemplate && (
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            <strong>Title:</strong> {selectedTemplate.title}
          </p>
          <p>
            <strong>Categories:</strong> {selectedTemplate.categories.length}
          </p>
          <p>
            <strong>Questions:</strong> {selectedTemplate.questions.length}
          </p>
        </div>
      )}

      <label className="block mt-4 mb-2 font-semibold">
        Template Categories:
      </label>
      {categories.map((cat, i) => (
        <Input
          key={i}
          value={cat}
          onChange={(e) => {
            const newCats = [...categories];
            newCats[i] = e.target.value;
            setCategories(newCats);
          }}
          className="mb-2 p-2 w-full rounded border"
        />
      ))}
      <label className="block mt-4 mb-2 font-semibold">
        Row Values (comma separated):
      </label>
      <Input
        value={values.join(",")}
        onChange={(e) => {
          const vals = e.target.value.split(",").map((v) => parseInt(v.trim()));
          setValues(vals);
        }}
        className="mb-4 p-2 w-full rounded border"
      />
      <Button
        onClick={startGame}
        disabled={!selectedTemplate || starting}
        className="bg-yellow-400 hover:bg-yellow-500 px-4 py-2 rounded font-bold"
      >
        {starting ? "Starting..." : "Start Game"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
