"use client";

import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AddCategoryForm from "./AddCategoryForm";
import AddBulkQuestionForm from "./AddBulkQuestionForm";
import SelectTemplate from "./SelectTemplate";

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

  const [questionSet, setQuestionSet] = useState<any | null>(null);

  return (
    <div className="flex flex-col h-screen w-full p-4 mx-auto">
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

      <Tabs defaultValue="use-template" className=" w-[100%]">
        <TabsList>
          <TabsTrigger value="use-template">Use a Template</TabsTrigger>
          <TabsTrigger value="create-template" disabled>
            Create a template
          </TabsTrigger>
          <TabsTrigger value="add-categories">Add New Categories</TabsTrigger>
          <TabsTrigger value="add-bulk-questions">
            Add Bulk Questions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="use-template">
          <SelectTemplate />
        </TabsContent>
        <TabsContent value="use-template">
          Change your password here.
        </TabsContent>
        <TabsContent value="add-categories">
          <AddCategoryForm />
        </TabsContent>

        <TabsContent value="add-bulk-questions">
          <AddBulkQuestionForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
