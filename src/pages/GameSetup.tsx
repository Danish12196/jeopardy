import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import AddCategoryForm from "./AddCategoryForm";
import AddBulkQuestionForm from "./AddBulkQuestionForm";
import SelectTemplate from "./SelectTemplate";
import CreateTemplate from "./CreateTemplate";
import BoardImportExport from "./BoardImportExport";
import pb from "@/pb";
import type { TeamRecord } from "@/lib/pbTypes";

export default function GameSetup() {
  const navigate = useNavigate();
  const [availableTeams, setAvailableTeams] = useState<TeamRecord[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmoji, setNewTeamEmoji] = useState("🚀");
  const [newTeamColor, setNewTeamColor] = useState("#FF5A1F");
  const [newTeamMembers, setNewTeamMembers] = useState("");

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        if (!pb.authStore.isValid) return;
        // The teams list rule limits results to the signed-in user's teams,
        // so no client filter is needed. (A filter on `user` returned 400 on
        // databases created before teams had a `user` field.)
        const records = await pb.collection("teams").getFullList<TeamRecord>({
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
    const members = newTeamMembers
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    try {
      const record = await pb.collection("teams").create<TeamRecord>({
        name: newTeamName.trim(),
        emoji: newTeamEmoji.trim(),
        color: newTeamColor,
        members,
        user: pb.authStore.record?.id,
        isPublic: false
      });
      setAvailableTeams([record, ...availableTeams]);
      setSelectedTeams([...selectedTeams, record.id]);
      setNewTeamName("");
      setNewTeamMembers("");
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
    <div className="flex flex-col h-screen w-full max-w-6xl mx-auto p-4 md:p-8 text-foreground bg-background bg-animated-gradient">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-accent drop-shadow-md text-center md:text-left"
        >
          Lockout Game Setup
        </motion.h1>
        <div className="flex items-center gap-2 self-center md:self-auto">
          <Button asChild variant="secondary">
            <a href="/history">History & Stats</a>
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            Log out
          </Button>
        </div>
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

        <div className="flex flex-col md:flex-row flex-wrap gap-3 mb-6 items-center">
            <Input
              value={newTeamEmoji}
              onChange={e => setNewTeamEmoji(e.target.value)}
              aria-label="Team Emoji"
              placeholder="🚀"
              className="w-16 text-center"
            />
            <input
              type="color"
              value={newTeamColor}
              onChange={e => setNewTeamColor(e.target.value)}
              aria-label="Team Color"
              className="h-10 w-12 rounded border border-border bg-background cursor-pointer"
            />
            <Input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="New Team Name"
              className="md:max-w-xs"
              onKeyDown={(e) => e.key === 'Enter' && createTeam()}
            />
            <Input
              value={newTeamMembers}
              onChange={e => setNewTeamMembers(e.target.value)}
              placeholder="Members (comma-separated, optional)"
              aria-label="Team Members"
              className="md:max-w-xs"
            />
            <Button onClick={createTeam} variant="brand">Add Team</Button>
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
                    style={t.color ? { borderColor: t.color } : undefined}
                    className={`px-6 py-3 rounded-xl border-2 font-bold transition-all ${
                        selectedTeams.includes(t.id)
                        ? "bg-accent border-accent text-accent-foreground shadow-[0_0_15px_rgba(255,90,31,0.4)]"
                        : "bg-secondary border-border/50 text-secondary-foreground hover:border-primary/50"
                    }`}
                >
                    {t.emoji ? `${t.emoji} ` : ""}{t.name}
                </motion.button>
            ))}
            </AnimatePresence>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-md p-6 rounded-2xl flex-1 border border-border/50 shadow-xl flex flex-col min-h-0"
      >
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-lg">2</span>
            Select or Create Content
        </h2>

        <Tabs defaultValue="use-template" className="w-full flex-1 flex flex-col min-h-0">
            <TabsList className="bg-muted border border-border/50 mb-6 flex-wrap h-auto p-1 rounded-xl">
                <TabsTrigger value="use-template" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex-1 min-w-[150px] py-2">Use a Template</TabsTrigger>
                <TabsTrigger value="create-template" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex-1 min-w-[150px] py-2">Create a Template</TabsTrigger>
                <TabsTrigger value="add-categories" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex-1 min-w-[150px] py-2">Categories</TabsTrigger>
                <TabsTrigger value="add-bulk-questions" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex-1 min-w-[150px] py-2">Questions</TabsTrigger>
                <TabsTrigger value="import-export" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex-1 min-w-[150px] py-2">Import / Export</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <TabsContent value="use-template" className="m-0 mt-2">
                    <SelectTemplate selectedTeams={selectedTeams} />
                </TabsContent>

                <TabsContent value="create-template" className="m-0 mt-2">
                    <CreateTemplate />
                </TabsContent>

                <TabsContent value="add-categories" className="m-0 mt-2">
                    <AddCategoryForm />
                </TabsContent>

                <TabsContent value="add-bulk-questions" className="m-0 mt-2">
                    <AddBulkQuestionForm />
                </TabsContent>

                <TabsContent value="import-export" className="m-0 mt-2">
                    <BoardImportExport />
                </TabsContent>
            </div>
        </Tabs>
      </motion.div>
    </div>
  );
}
