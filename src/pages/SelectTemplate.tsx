import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import superuserClient from "@/super-user.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SelectTemplate() {
  const navigate = useNavigate();

  const [numTeams, setNumTeams] = useState(2);
  const [teams, setTeams] = useState(["Team 1", "Team 2"]);
  const [categories, setCategories] = useState([
    "Cat 1",
    "Cat 2",
    "Cat 3",
    "Cat 4",
    "Cat 5",
    "Cat 6",
  ]);
  const [values, setValues] = useState([100, 200, 300, 400, 500]);

  const [questionSet, setQuestionSet] = useState<any | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      const records = await superuserClient
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
          superuserClient.collection("question_categories").getOne(id)
        )
      );
      const names = categoryRecords.map((cat) => cat.name);
      setCategories(names);
    };
    fetchCategoryNames();
  }, [selectedTemplate]);

  const startGame = async () => {
    if (!selectedTemplate) return;

    const newGame = {
      title: `Game: ${selectedTemplate.title}`,
      template: selectedTemplate.id,
      teams: teams.map((name) => ({ name, score: 0 })),
      categories,
      values,
      usedQuestions: [],
    };

    try {
      const gameRecord = await superuserClient
        .collection("games")
        .create(newGame);

      console.log("Created game:", gameRecord);

      // Optionally store in localStorage
      localStorage.setItem("jeopardy-game", JSON.stringify(gameRecord));
      navigate("/game");
    } catch (err) {
      console.error("Failed to create game:", err);
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
        className="bg-yellow-400 hover:bg-yellow-500 px-4 py-2 rounded font-bold"
      >
        Start Game
      </Button>
    </div>
  );
}
