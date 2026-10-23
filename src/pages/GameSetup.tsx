import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AddCategoryForm from "./AddCategoryForm";
import AddBulkQuestionForm from "./AddBulkQuestionForm";
import SelectTemplate from "./SelectTemplate";
import CreateTemplate from "./CreateTemplate";
import pb from "@/pb";

export default function GameSetup() {
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const navigate = useNavigate();

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

  const handleLogout = () => {
      pb.authStore.clear();
      navigate("/login");
  };

  return (
    <div className="flex flex-col min-h-screen w-full max-w-6xl mx-auto p-4 md:p-8 text-foreground bg-background bg-animated-gradient">
      <div className="flex justify-between items-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-accent drop-shadow-md text-center md:text-left"
          >
            Jeopardy Game Setup
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
              <Button onClick={handleLogout} variant="destructive" size="sm" className="font-bold border border-destructive/50">
                  Logout
              </Button>
          </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-card/60 backdrop-blur-md p-6 rounded-2xl mb-8 border border-border/50 shadow-xl"
      >
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-lg">1</span>
            Select Teams
        </h2>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="New Team Name"
              className="md:max-w-sm"
              onKeyDown={(e) => e.key === 'Enter' && createTeam()}
            />
            <Button onClick={createTeam} variant="jeopardy">Add Team</Button>
        </div>

        <div className="flex flex-wrap gap-3">
            {availableTeams.length === 0 && <p className="text-muted-foreground italic">No teams found. Create one above to get started.</p>}
            <AnimatePresence>
            {availableTeams.map(t => (
                <motion.button
                    key={t.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleTeam(t.id)}
                    className={`px-6 py-3 rounded-xl border-2 font-bold transition-all ${
                        selectedTeams.includes(t.id)
                        ? "bg-green-600 border-green-400 text-white shadow-[0_0_15px_rgba(74,222,128,0.4)]"
                        : "bg-secondary border-border/50 text-secondary-foreground hover:border-primary/50"
                    }`}
                >
                    {t.name}
                </motion.button>
            ))}
            </AnimatePresence>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-md p-6 rounded-2xl flex-1 border border-border/50 shadow-xl flex flex-col"
      >
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-lg">2</span>
            Select or Create Content
        </h2>

        <Tabs defaultValue="use-template" className="w-full flex-1 flex flex-col">
            <TabsList className="bg-muted border border-border/50 mb-6 flex flex-wrap h-auto p-1 rounded-xl">
                <TabsTrigger value="use-template" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex-1 min-w-[150px] py-2">Use a Template</TabsTrigger>
                <TabsTrigger value="create-template" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex-1 min-w-[150px] py-2">Create a Template</TabsTrigger>
                <TabsTrigger value="add-categories" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex-1 min-w-[150px] py-2">Categories</TabsTrigger>
                <TabsTrigger value="add-bulk-questions" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex-1 min-w-[150px] py-2">Questions</TabsTrigger>
            </TabsList>

            <div className="flex-1">
                <TabsContent value="use-template" className="m-0 mt-2">
                    <SelectTemplate selectedTeams={selectedTeams} />
                </TabsContent>

                <TabsContent value="create-template" className="m-0 mt-2">
                    <CreateTemplate />
                </TabsContent>

                <TabsContent value="add-categories" className="m-0 mt-2">
                    <AddCategoryForm />
                </TabsContent>

                <TabsContent value="add-bulk-questions" className="m-0 mt-2 overflow-x-auto">
                    <AddBulkQuestionForm />
                </TabsContent>
            </div>
        </Tabs>
      </motion.div>
    </div>
  );
}
