"use client";

import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type GameState = {
  teams: { name: string; score: number }[];
  categories: string[];
  values: number[]; // e.g., [100, 200, 300, 400, 500]
  usedQuestions: Set<string>; // e.g., "2-1"
};

export default function GameSetup() {
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

  const [questionFiles] = useState(["classic.json", "wacky.json"]); // list of files in /public/questions
  const [selectedFile, setSelectedFile] = useState("classic.json");
  const [questionSet, setQuestionSet] = useState<any | null>(null);
  const [customFiles, setCustomFiles] = useState<string[]>([]);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    const stored = Object.keys(localStorage)
      .filter((key) => key.startsWith("custom-questions:"))
      .map((key) => key.replace("custom-questions:", ""));
    setCustomFiles(stored);
  }, []);

  useEffect(() => {
    const loadFile = async () => {
      console.log("Loading file:", selectedFile);
      if (selectedFile.startsWith("custom")) {
        const data = localStorage.getItem(`custom-questions:${selectedFile}`);
        console.log("Custom file data:", data);
        if (data) {
          const parsed = JSON.parse(data);
          console.log("Loaded custom file:", parsed);
          setQuestionSet(parsed);
          setCategories(parsed.categories.map((cat: any) => cat.title));
          setValues(parsed.categories[0].questions.map((q: any) => q.value));
        }
      } else {
        const res = await fetch(`/questions/${selectedFile}`);
        const parsed = await res.json();
        setQuestionSet(parsed);
        setCategories(parsed.categories.map((cat: any) => cat.title));
        setValues(parsed.categories[0].questions.map((q: any) => q.value));
      }
    };

    loadFile();
  }, [selectedFile]);

  const startGame = () => {
    const gameState = {
      teams: teams.map((name) => ({ name, score: 0 })),
      categories,
      values,
      usedQuestions: [],
      questions: questionSet.categories,
    };
    localStorage.setItem("jeopardy-game", JSON.stringify(gameState));
    navigate("/game");
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl">Jeopardy Game Setup</h1>

      <label className="block mb-2 font-semibold">Number of Teams:</label>
      <Input
        type="number"
        value={numTeams}
        onChange={(e) => {
          const n = parseInt(e.target.value);
          setNumTeams(n);
          setTeams(Array.from({ length: n }, (_, i) => `Team ${i + 1}`));
        }}
        className="mb-4 p-2 w-full rounded border"
      />
      <label className="block mb-2 font-semibold">Team Names:</label>
      {teams.map((team, i) => (
        <Input
          key={i}
          value={team}
          onChange={(e) => {
            const newTeams = [...teams];
            newTeams[i] = e.target.value;
            setTeams(newTeams);
          }}
          className="mb-2 p-2 w-full rounded border"
        />
      ))}

      <Tabs defaultValue="template" className=" w-[100%]">
        <TabsList>
          <TabsTrigger value="template">Use a Template</TabsTrigger>
          <TabsTrigger value="scratch">Create from scratch</TabsTrigger>
        </TabsList>
        <TabsContent value="template">
          Make changes to your account here.
        </TabsContent>
        <TabsContent value="scratch">Change your password here.</TabsContent>
      </Tabs>
      <label className="block mt-4 mb-2 font-semibold">
        Select Question Set:
      </label>

      <select
        value={selectedFile}
        onChange={(e) => setSelectedFile(e.target.value)}
        className="mb-4 p-2 w-full rounded border"
      >
        <optgroup label="Built-in">
          {questionFiles.map((file, i) => (
            <option key={i} value={file}>
              {file}
            </option>
          ))}
        </optgroup>
        <optgroup label="Custom Uploads">
          {customFiles.map((file, i) => (
            <option key={i} value={file}>
              {file}
            </option>
          ))}
        </optgroup>
      </select>
      <a
        href="/questions/classic.json"
        download="classic.json"
        className="mb-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        ⬇ Download Example File
      </a>
      <label className="block mt-4 mb-2 font-semibold">
        Upload Custom File:
      </label>
      <Input
        type="file"
        accept=".json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          try {
            const parsed = JSON.parse(text);
            localStorage.setItem(
              `custom-questions:${file.name}`,
              JSON.stringify(parsed)
            );
            setCustomFiles((prev) => [...prev, file.name]);
          } catch (err) {
            alert("Invalid JSON file.");
          }
        }}
        className="mb-4"
      />
      <label className="block mt-4 mb-2 font-semibold">Categories:</label>
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
