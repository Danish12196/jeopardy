import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddCategoryForm from "./AddCategoryForm";
import AddBulkQuestionForm from "./AddBulkQuestionForm";
import SelectTemplate from "./SelectTemplate";
import CreateTemplate from "./CreateTemplate";
import pb from "@/pb";

export default function GameSetup() {
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        if (!pb.authStore.isValid) return;
        const records = await pb.collection("teams").getFullList({
          filter: `user = "${pb.authStore.model?.id}"`,
          sort: "-created"
        });
        setAvailableTeams(records);
      } catch (err) {
        console.error("Failed to fetch teams:", err);
      }
    };
    fetchTeams();
  }, []);

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const record = await pb.collection("teams").create({
        name: newTeamName.trim(),
        user: pb.authStore.model?.id,
        isPublic: false
      });
      setAvailableTeams([record, ...availableTeams]);
      setSelectedTeams([...selectedTeams, record.id]);
      setNewTeamName("");
    } catch (err) {
      console.error("Failed to create team:", err);
    }
  };

  const toggleTeam = (id: string) => {
    if (selectedTeams.includes(id)) {
      setSelectedTeams(selectedTeams.filter(t => t !== id));
    } else {
      setSelectedTeams([...selectedTeams, id]);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full p-4 mx-auto text-white bg-blue-950">
      <h1 className="text-3xl font-bold mb-6 text-yellow-400">Jeopardy Game Setup</h1>

      <div className="bg-blue-900 p-4 rounded mb-6 border border-blue-700">
        <h2 className="text-xl font-bold mb-4">1. Select Teams</h2>

        <div className="flex gap-4 mb-4">
            <Input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="New Team Name"
              className="text-black bg-white"
            />
            <Button onClick={createTeam} className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold">Add Team</Button>
        </div>

        <div className="flex flex-wrap gap-2">
            {availableTeams.length === 0 && <p className="text-gray-400">No teams found. Create one above.</p>}
            {availableTeams.map(t => (
                <button
                    key={t.id}
                    onClick={() => toggleTeam(t.id)}
                    className={`px-4 py-2 rounded border-2 font-bold ${
                        selectedTeams.includes(t.id)
                        ? "bg-green-600 border-green-400 text-white"
                        : "bg-blue-800 border-blue-600 text-gray-300 hover:bg-blue-700"
                    }`}
                >
                    {t.name}
                </button>
            ))}
        </div>
      </div>

      <div className="bg-blue-900 p-4 rounded flex-1 border border-blue-700 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">2. Select or Create Content</h2>

        <Tabs defaultValue="use-template" className="w-full">
            <TabsList className="bg-blue-950 border border-blue-800 mb-4">
            <TabsTrigger value="use-template" className="data-[state=active]:bg-blue-700 data-[state=active]:text-yellow-400">Use a Template</TabsTrigger>
            <TabsTrigger value="create-template" className="data-[state=active]:bg-blue-700 data-[state=active]:text-yellow-400">Create a template</TabsTrigger>
            <TabsTrigger value="add-categories" className="data-[state=active]:bg-blue-700 data-[state=active]:text-yellow-400">Add New Categories</TabsTrigger>
            <TabsTrigger value="add-bulk-questions" className="data-[state=active]:bg-blue-700 data-[state=active]:text-yellow-400">Add Bulk Questions</TabsTrigger>
            </TabsList>

            <TabsContent value="use-template">
                <SelectTemplate selectedTeams={selectedTeams} availableTeams={availableTeams} />
            </TabsContent>

            <TabsContent value="create-template">
                <CreateTemplate />
            </TabsContent>

            <TabsContent value="add-categories">
                <AddCategoryForm />
            </TabsContent>

            <TabsContent value="add-bulk-questions">
                <AddBulkQuestionForm />
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
