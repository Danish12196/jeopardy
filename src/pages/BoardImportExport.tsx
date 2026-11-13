import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import pb from "@/pb";
import { boardToCsv, boardToJson, parseBoardFile, type Board, type BoardError } from "@/lib/boardFile";
import { downloadText, loadTemplateBoard, saveBoardAsTemplate, slug } from "@/lib/templateBoard";
import { openTdbToBoard } from "@/lib/contentLibrary";

export default function BoardImportExport() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [exportId, setExportId] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  const [fileName, setFileName] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [errors, setErrors] = useState<BoardError[]>([]);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    pb.collection("game_templates")
      .getFullList({ sort: "-created" })
      .then(setTemplates)
      .catch((err) => console.error("Failed to fetch templates:", err));
  }, [saved]);

  const exportAs = async (format: "csv" | "json") => {
    setExportError(null);
    try {
      const b = await loadTemplateBoard(pb, exportId);
      if (format === "csv") downloadText(`${slug(b.title)}.csv`, boardToCsv(b), "text/csv");
      else downloadText(`${slug(b.title)}.json`, boardToJson(b), "application/json");
    } catch (err: any) {
      setExportError(err?.message || "Export failed");
    }
  };

  const onFile = async (file: File | undefined) => {
    setSaved(null);
    setSaveError(null);
    if (!file) return;
    const result = parseBoardFile(file.name, await file.text());
    setFileName(file.name);
    setBoard(result.board);
    setErrors(result.errors);
    setTitle(result.board?.title ?? "");
  };

  const save = async () => {
    if (!board || errors.length || !title.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const t = await saveBoardAsTemplate(pb, { ...board, title: title.trim() }, isPublic);
      setSaved(t.title);
      setBoard(null);
      setFileName("");
    } catch (err: any) {
      setSaveError(err?.message || "Couldn't save the board");
    } finally {
      setSaving(false);
    }
  };

  const rows = board ? Math.max(0, ...board.categories.map((c) => c.questions.length)) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="bg-card/50 p-6 rounded-xl border border-border/40">
        <h2 className="text-xl font-bold mb-4">Export a template</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <Select value={exportId} onValueChange={setExportId}>
            <SelectTrigger className="md:w-2/3 h-12 bg-background" aria-label="Template to export">
              <SelectValue placeholder="Choose a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" className="h-12" disabled={!exportId} onClick={() => exportAs("csv")}>Download CSV</Button>
          <Button variant="secondary" className="h-12" disabled={!exportId} onClick={() => exportAs("json")}>Download JSON</Button>
        </div>
        {exportError && <p className="mt-3 text-sm text-destructive font-bold">{exportError}</p>}
      </div>

      <div className="bg-card/50 p-6 rounded-xl border border-border/40 space-y-4">
        <h2 className="text-xl font-bold">Import a board</h2>
        <p className="text-sm text-muted-foreground">
          CSV with the columns <code className="text-accent">category,value,question,answer,hint</code> (hint is optional), or the JSON
          that Export makes. You'll see a preview before anything is saved.
        </p>
        <Input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          aria-label="Board file"
          className="bg-background h-12 pt-2.5"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              setSaved(null);
              setSaveError(null);
              setErrors([]);
              try {
                const res = await fetch("https://opentdb.com/api.php?amount=10&type=multiple");
                const json = await res.json();
                const converted = openTdbToBoard(json.results ?? []);
                if (converted.categories.length === 0) {
                  setSaveError("No trivia questions returned.");
                  return;
                }
                setBoard({
                  title: "Open Trivia DB Pack",
                  categories: converted.categories.map((c) => ({
                    name: c.name,
                    questions: c.questions.map((q) => ({
                      question: q.question,
                      answer: q.answer,
                      hint: "",
                      value: q.value,
                    })),
                  })),
                });
                setTitle("Open Trivia DB Pack");
              } catch {
                setSaveError("Failed to fetch from Open Trivia DB.");
              }
            }}
          >
            Fetch from Open Trivia DB
          </Button>
          <span className="text-xs text-muted-foreground">
            Tip: For Google Sheets, use File → Download → CSV and upload above.
          </span>
        </div>

        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-sm bg-destructive/10 border border-destructive/30 rounded-lg p-4"
              role="alert"
            >
              <p className="font-bold text-destructive mb-2">{fileName} has {errors.length} problem{errors.length === 1 ? "" : "s"}. Fix the file and choose it again.</p>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((e, i) => <li key={i}>{e.message}</li>)}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {board && board.categories.length > 0 && (
          <div className="space-y-4">
            <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border/50 bg-background/30">
              <table className="w-full text-sm" data-testid="import-preview">
                <thead>
                  <tr className="bg-secondary/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    {board.categories.map((c) => <th key={c.name} className="p-3 font-bold">{c.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rows }).map((_, r) => (
                    <tr key={r} className="border-t border-border/20 align-top">
                      {board.categories.map((c) => {
                        const q = c.questions[r];
                        return (
                          <td key={c.name} className="p-3">
                            {q && (
                              <>
                                <div className="font-mono font-bold text-accent">{Number.isFinite(q.value) ? q.value : "?"}</div>
                                <div>{q.question || <span className="text-destructive">No question</span>}</div>
                                <div className="text-muted-foreground">A: {q.answer || <span className="text-destructive">missing</span>}</div>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1">
                <label className="block mb-2 text-sm font-semibold" htmlFor="import-title">Template title</label>
                <Input id="import-title" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background h-12" />
              </div>
              <label className="flex items-center gap-3 text-sm bg-background/50 px-6 h-12 rounded-lg border border-border/50 cursor-pointer">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-5 h-5 accent-accent" />
                Make Public
              </label>
              <Button variant="brand" className="h-12 md:min-w-[200px]" disabled={saving || errors.length > 0 || !title.trim()} onClick={save}>
                {saving ? "Saving..." : "Save as template"}
              </Button>
            </div>
          </div>
        )}

        {saveError && <p className="text-sm text-destructive font-bold">{saveError}</p>}
        {saved && (
          <p className="text-green-400 font-bold text-center bg-green-900/20 p-3 rounded-lg">
            Saved "{saved}". Pick it under Use a Template to play.
          </p>
        )}
      </div>
    </motion.div>
  );
}
