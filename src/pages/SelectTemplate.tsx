import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";
import { makeGameCode } from "@/lib/gameCode";
import type { GameSettings, GameTemplateRecord, QuestionCategoryRecord, QuestionRecord } from "@/lib/pbTypes";
import GameRulesSettings from "@/components/setup/GameRulesSettings";
import { DEFAULT_GAME_SETTINGS, effectiveBoardValues, normalizeSettings } from "@/lib/scoring";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_CODE_ATTEMPTS = 5;

function isUniqueIdCollision(err: unknown): boolean {
  const e = err as { status?: number; response?: { data?: { uniqueID?: unknown }; message?: string } };
  return e?.status === 400 && (Boolean(e?.response?.data?.uniqueID) || /unique/i.test(e?.response?.message || ""));
}

export default function SelectTemplate({ selectedTeams }: { selectedTeams: string[] }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [values, setValues] = useState<number[]>([]);

  const [templates, setTemplates] = useState<GameTemplateRecord[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<GameTemplateRecord | null>(null);
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_GAME_SETTINGS });

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const records = await pb
          .collection("game_templates")
          .getFullList<GameTemplateRecord>({
            sort: "-created",
            expand: "user",
          });

        const currentUserId = pb.authStore.record?.id;
        const sorted = records.sort((a, b) => {
          const aMine = a.user === currentUserId;
          const bMine = b.user === currentUserId;
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
        const categoryIds = selectedTemplate.categories ?? [];
        const questionIds = selectedTemplate.questions ?? [];

        const categoryRecords = categoryIds.length
          ? await pb.collection("question_categories").getFullList<QuestionCategoryRecord>({
              filter: categoryIds.map((id) => pb.filter("id = {:id}", { id })).join(" || "),
            })
          : [];
        const byCatId = new Map(categoryRecords.map((c) => [c.id, c]));
        const orderedCategories = categoryIds
          .map((id) => byCatId.get(id))
          .filter((c): c is QuestionCategoryRecord => Boolean(c));
        setCategories(orderedCategories.map((cat) => cat.name));

        const qs = questionIds.length
          ? await pb.collection("questions").getFullList<QuestionRecord>({
              filter: questionIds.map((id) => pb.filter("id = {:id}", { id })).join(" || "),
            })
          : [];

        let maxQs = 0;
        for (const catId of categoryIds) {
          const qCount = qs.filter((q) => q.category === catId).length;
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
      let createdCode: string | null = null;
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
        const uniqueID = makeGameCode();
        try {
          const normalizedSettings = normalizeSettings(settings);
          await pb.collection("games").create({
            title: `Game: ${selectedTemplate.title}`,
            uniqueID,
            template: selectedTemplate.id,
            host: pb.authStore.record?.id,
            teams: selectedTeams,
            categories,
            values: effectiveBoardValues(values, values.length, normalizedSettings),
            teamScores: selectedTeams.map((t) => ({ id: t, score: 0 })),
            answeredQuestions: [],
            buzzRound: 0,
            showAnswer: false,
            buzzerUnlocked: false,
            hostForceShowQuestion: false,
            settings: normalizedSettings,
            passedTeams: [],
            round: 1,
          });
          createdCode = uniqueID;
          break;
        } catch (err) {
          if (isUniqueIdCollision(err) && attempt < MAX_CODE_ATTEMPTS - 1) {
            continue;
          }
          throw err;
        }
      }

      if (createdCode) {
        navigate(
          `/game/${createdCode}/${normalizeSettings(settings).gameMode === "solo" ? "solo" : "host"}`
        );
      }
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
            const isMine = template.user === pb.authStore.record?.id;
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

      {selectedTemplate && (
        <GameRulesSettings settings={settings} onChange={setSettings} />
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button
          onClick={startGame}
          disabled={!selectedTemplate || starting || selectedTeams.length === 0}
          variant="brand"
          className="w-full md:w-auto md:min-w-[200px] h-14 text-lg"
        >
          {starting ? "Starting Game..." : "Start Game"}
        </Button>
        {selectedTemplate && (
          <Button
            type="button"
            variant="secondary"
            className="h-14"
            onClick={async () => {
              try {
                const userId = pb.authStore.record?.id;
                if (!userId) return;
                const copy = await pb.collection("game_templates").create<GameTemplateRecord>({
                  title: `${selectedTemplate.title} (Copy)`,
                  categories: selectedTemplate.categories,
                  questions: selectedTemplate.questions,
                  user: userId,
                  isPublic: false,
                });
                setTemplates((prev) => [copy, ...prev]);
                setSelectedTemplate(copy);
              } catch {
                setError("Could not duplicate template.");
              }
            }}
          >
            Duplicate Template
          </Button>
        )}
      </div>

      {templates.some((t) => t.isPublic && t.user !== pb.authStore.record?.id) && (
        <div className="mt-8 pt-6 border-t border-border/40 space-y-3" data-testid="public-template-gallery">
          <h3 className="text-lg font-bold text-foreground">Public Template Gallery</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates
              .filter((t) => t.isPublic && t.user !== pb.authStore.record?.id)
              .map((tpl) => (
                <div key={tpl.id} className="bg-background/50 p-4 rounded-xl border border-border/40 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold truncate">{tpl.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {tpl.categories.length} categories • {tpl.questions.length} questions
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const userId = pb.authStore.record?.id;
                      if (!userId) return;
                      const cloned = await pb.collection("game_templates").create<GameTemplateRecord>({
                        title: `${tpl.title} (Clone)`,
                        categories: tpl.categories,
                        questions: tpl.questions,
                        user: userId,
                        isPublic: false,
                      });
                      setTemplates((prev) => [cloned, ...prev]);
                      setSelectedTemplate(cloned);
                    }}
                  >
                    Clone
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}

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
