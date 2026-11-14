// Board import/export: CSV and JSON <-> a plain board shape, with validation
// that reports problems per row before anything is saved.

export type BoardQuestion = { value: number; question: string; answer: string; hint?: string; mediaUrl?: string };
export type BoardCategory = { name: string; questions: BoardQuestion[] };
export type Board = { title: string; categories: BoardCategory[] };

export type BoardError = { row?: number; message: string };
export type ParseResult = { board: Board | null; errors: BoardError[] };

export const CSV_COLUMNS = ["category", "value", "question", "answer", "hint", "mediaurl"] as const;

/** Minimal RFC 4180 CSV reader: quoted fields, doubled quotes, CRLF, newlines inside quotes. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  // Drop blank lines.
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const csvField = (v: string | number | undefined) => {
  const s = v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function boardToCsv(board: Board): string {
  const hasMedia = board.categories.some((c) => c.questions.some((q) => q.mediaUrl));
  const cols = hasMedia ? ["category", "value", "question", "answer", "hint", "mediaUrl"] : ["category", "value", "question", "answer", "hint"];
  const lines = [cols.join(",")];
  for (const cat of board.categories) {
    for (const q of cat.questions) {
      const fields = hasMedia
        ? [cat.name, q.value, q.question, q.answer, q.hint ?? "", q.mediaUrl ?? ""]
        : [cat.name, q.value, q.question, q.answer, q.hint ?? ""];
      lines.push(fields.map(csvField).join(","));
    }
  }
  return lines.join("\n") + "\n";
}

export function boardToJson(board: Board): string {
  return JSON.stringify(board, null, 2) + "\n";
}

/** Checks a board for problems a game can't recover from. Row numbers are 1-based data rows when known. */
export function validateBoard(board: Board, rowOf?: (cat: number, q: number) => number | undefined): BoardError[] {
  const errors: BoardError[] = [];
  if (!board.categories.length) errors.push({ message: "The board has no categories." });
  const names = new Set<string>();
  board.categories.forEach((cat, ci) => {
    const key = cat.name.trim().toLowerCase();
    if (!key) errors.push({ message: `Category ${ci + 1} has no name.` });
    else if (names.has(key)) errors.push({ message: `Category "${cat.name}" appears twice.` });
    names.add(key);
    if (!cat.questions.length) errors.push({ message: `Category "${cat.name}" has no questions.` });
    const values = new Map<number, number>();
    cat.questions.forEach((q, qi) => {
      const row = rowOf?.(ci, qi);
      const where = row ? `Row ${row}` : `"${cat.name}" question ${qi + 1}`;
      if (!Number.isFinite(q.value) || q.value <= 0) errors.push({ row, message: `${where}: value must be a positive number.` });
      if (!q.question?.trim()) errors.push({ row, message: `${where}: missing question.` });
      if (!q.answer?.trim()) errors.push({ row, message: `${where}: missing answer.` });
      if (Number.isFinite(q.value)) {
        if (values.has(q.value)) {
          errors.push({ row, message: `${where}: duplicate value ${q.value} in "${cat.name}" (also on ${row ? `row ${values.get(q.value)}` : "another question"}).` });
        } else values.set(q.value, row ?? qi + 1);
      }
    });
  });
  return errors;
}

/** Sorts each category's questions by value (the board shows them low to high). */
function sortBoard(board: Board): Board {
  return { ...board, categories: board.categories.map((c) => ({ ...c, questions: [...c.questions].sort((a, b) => a.value - b.value) })) };
}

export function parseBoardCsv(text: string, title = "Imported board"): ParseResult {
  const rows = readCsv(text);
  if (!rows.length) return { board: null, errors: [{ message: "The file is empty." }] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const expected =
    header.length === 4 ? CSV_COLUMNS.slice(0, 4) : header.length === 5 ? CSV_COLUMNS.slice(0, 5) : CSV_COLUMNS;
  if (header.length !== expected.length || expected.some((c, i) => header[i] !== c)) {
    return {
      board: null,
      errors: [{ row: 1, message: `Header must be "category,value,question,answer,hint" (hint and mediaUrl are optional). Got "${rows[0].join(",")}".` }],
    };
  }
  const errors: BoardError[] = [];
  const categories: BoardCategory[] = [];
  const rowNums: number[][] = [];
  rows.slice(1).forEach((r, i) => {
    const row = i + 2; // 1-based, counting the header
    if (r.length !== header.length) {
      errors.push({ row, message: `Row ${row}: expected ${header.length} columns, found ${r.length}.` });
      return;
    }
    const [category, value, question, answer, hint, mediaUrl] = r.map((f) => f.trim());
    if (!category) { errors.push({ row, message: `Row ${row}: missing category.` }); return; }
    let ci = categories.findIndex((c) => c.name.toLowerCase() === category.toLowerCase());
    if (ci === -1) { ci = categories.push({ name: category, questions: [] }) - 1; rowNums.push([]); }
    categories[ci].questions.push({
      value: value === "" ? NaN : Number(value),
      question,
      answer,
      ...(hint ? { hint } : {}),
      ...(mediaUrl ? { mediaUrl } : {}),
    });
    rowNums[ci].push(row);
  });
  const board = { title, categories };
  errors.push(...validateBoard(board, (c, q) => rowNums[c]?.[q]));
  return { board: sortBoard(board), errors: dedupe(errors) };
}

export function parseBoardJson(text: string, fallbackTitle = "Imported board"): ParseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (err: any) {
    return { board: null, errors: [{ message: `Not valid JSON: ${err.message}` }] };
  }
  if (!data || !Array.isArray(data.categories)) {
    return { board: null, errors: [{ message: 'JSON must look like {"title": "...", "categories": [{"name": "...", "questions": [...]}]}.' }] };
  }
  const errors: BoardError[] = [];
  const categories: BoardCategory[] = data.categories.map((c: any, ci: number) => {
    if (!Array.isArray(c?.questions)) errors.push({ message: `Category ${ci + 1} needs a "questions" list.` });
    return {
      name: String(c?.name ?? "").trim(),
      questions: (Array.isArray(c?.questions) ? c.questions : []).map((q: any) => ({
        value: q?.value === undefined || q?.value === "" ? NaN : Number(q.value),
        question: String(q?.question ?? "").trim(),
        answer: String(q?.answer ?? "").trim(),
        ...(q?.hint ? { hint: String(q.hint).trim() } : {}),
      })),
    };
  });
  const board = { title: String(data.title ?? "").trim() || fallbackTitle, categories };
  errors.push(...validateBoard(board));
  return { board: sortBoard(board), errors };
}

/** Picks the parser from the file name, falling back to sniffing the text. */
export function parseBoardFile(name: string, text: string): ParseResult {
  const title = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Imported board";
  const isJson = /\.json$/i.test(name) || (!/\.csv$/i.test(name) && text.trimStart().startsWith("{"));
  return isJson ? parseBoardJson(text, title) : parseBoardCsv(text, title);
}

function dedupe(errors: BoardError[]) {
  const seen = new Set<string>();
  return errors.filter((e) => (seen.has(e.message) ? false : (seen.add(e.message), true)));
}
