import initSqlJs, { type SqlJsStatic } from "sql.js";
import JSZip from "jszip";

export interface AnkiNote {
  fields: Record<string, string>;
  tags: string[];
  guid: string;
}

export interface AnkiDeck {
  name: string;
  noteCount: number;
}

let sql: SqlJsStatic | null = null;

async function getSql() {
  if (!sql) {
    sql = await initSqlJs({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${f}` });
  }
  return sql;
}

async function extractDbFromApkg(file: File): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(file);
  // Find the SQLite database file in the archive
  const matches = zip.file(/^[^_].*\.anki2$/i);
  const dbFile = matches.length > 0 ? matches[0] : zip.file("collection.anki2");
  if (!dbFile) throw new Error("未找到 Anki 数据库文件，请确认文件格式正确");
  return dbFile.async("uint8array");
}

function parseModels(modelsJson: string): Map<number, { name: string; fields: string[] }> {
  const map = new Map<number, { name: string; fields: string[] }>();
  const models = JSON.parse(modelsJson);
  for (const [mid, model] of Object.entries(models) as [string, Record<string, unknown>][]) {
    const flds = (model.flds as Array<{ name: string; ord: number }>) || [];
    const fields = flds.sort((a, b) => a.ord - b.ord).map((f) => f.name);
    map.set(Number(mid), { name: model.name as string, fields });
  }
  return map;
}

function parseDecks(decksJson: string): Map<number, string> {
  const map = new Map<number, string>();
  const decks = JSON.parse(decksJson);
  for (const [did, deck] of Object.entries(decks) as [string, Record<string, unknown>][]) {
    if (Number(did) === 1) continue; // skip default deck
    map.set(Number(did), deck.name as string);
  }
  return map;
}

/**
 * Parse an .apkg file and return all notes organized by deck.
 */
export async function parseAnkiFile(file: File): Promise<{
  deckName: string;
  notes: AnkiNote[];
}> {
  const SQL = await getSql();
  const dbData = await extractDbFromApkg(file);
  const db = new SQL.Database(dbData);

  // Read models and decks from col table
  const colResult = db.exec("SELECT models, decks FROM col");
  const modelsJson = colResult[0]?.values[0]?.[0] as string | undefined;
  const decksJson = colResult[0]?.values[0]?.[1] as string | undefined;

  const models = modelsJson ? parseModels(modelsJson) : new Map();
  const decks = decksJson ? parseDecks(decksJson) : new Map();

  // Read cards to get deck mapping
  const cardResult = db.exec("SELECT nid, did FROM cards");
  const cardMap = new Map<number, number>(); // nid -> did
  if (cardResult[0]) {
    for (const row of cardResult[0].values) {
      cardMap.set(row[0] as number, row[1] as number);
    }
  }

  // Read all notes
  const notesResult = db.exec("SELECT id, guid, mid, flds, tags FROM notes");
  const notes: AnkiNote[] = [];
  const deckCounts = new Map<string, number>();

  if (notesResult[0]) {
    for (const row of notesResult[0].values) {
      const nid = row[0] as number;
      const guid = row[1] as string;
      const mid = row[2] as number;
      const flds = row[3] as string;
      const tags = ((row[4] as string) || "").split(/\s+/).filter(Boolean);

      const model = models.get(mid);
      const fieldNames = model?.fields || [];
      const fieldValues = flds.split("\x1f");

      const fields: Record<string, string> = {};
      fieldNames.forEach((name, i) => {
        fields[name] = fieldValues[i]?.replace(/<[^>]+>/g, "").trim() || "";
      });

      // Map common field names to canonical names
      const canonical: Record<string, string> = {};
      for (const [key, val] of Object.entries(fields)) {
        const lower = key.toLowerCase();
        if (lower.includes("word") || lower.includes("term") || lower.includes("单词") || lower.includes("词")) {
          canonical["Word"] = canonical["Word"] || val;
        } else if (lower.includes("def") || lower.includes("meaning") || lower.includes("释义") || lower.includes("定义") || lower.includes("解释")) {
          canonical["Definition"] = canonical["Definition"] || val;
        } else if (lower.includes("example") || lower.includes("sentence") || lower.includes("例句")) {
          canonical["Example"] = canonical["Example"] ? canonical["Example"] + "; " + val : val;
        } else if (lower.includes("phonetic") || lower.includes("pron") || lower.includes("音标") || lower.includes("发音")) {
          canonical["Phonetic"] = canonical["Phonetic"] || val;
        } else if (lower.includes("pos") || lower.includes("词性") || lower.includes("part of speech")) {
          canonical["PartOfSpeech"] = canonical["PartOfSpeech"] || val;
        }
      }

      const merged = { ...fields, ...canonical };

      // Determine deck for this note
      const did = cardMap.get(nid);
      if (did && decks.has(did)) {
        const deckName = decks.get(did)!;
        deckCounts.set(deckName, (deckCounts.get(deckName) || 0) + 1);
      } else {
        deckCounts.set("默认", (deckCounts.get("默认") || 0) + 1);
      }

      notes.push({ fields: merged, tags, guid });
    }
  }

  db.close();

  // Determine primary deck name
  let deckName = "导入的词库";
  if (deckCounts.size > 0) {
    const sorted = [...deckCounts.entries()].sort((a, b) => b[1] - a[1]);
    deckName = sorted[0][0];
  }
  // Use filename as fallback
  if (deckName === "默认" || deckName === "导入的词库") {
    deckName = file.name.replace(/\.apkg$/i, "");
  }

  return { deckName, notes };
}

/**
 * Search imported Anki data for a given word.
 */
export function searchAnki(word: string): { word: string; definition: string; example?: string; phonetic?: string; partOfSpeech?: string; tags: string[] }[] {
  const lowerWord = word.toLowerCase().trim();
  const stored = localStorage.getItem("anki_data");
  if (!stored) return [];

  try {
    const data: { notes: AnkiNote[]; deckName: string }[] = JSON.parse(stored);
    const results: { word: string; definition: string; example?: string; phonetic?: string; partOfSpeech?: string; tags: string[] }[] = [];

    for (const deck of data) {
      for (const note of deck.notes) {
        const f = note.fields;
        const wordField = f["Word"] || f[Object.keys(f)[0]] || "";
        // Match exact or close to the search term
        if (
          wordField.toLowerCase() === lowerWord ||
          wordField.toLowerCase().startsWith(lowerWord) ||
          lowerWord.startsWith(wordField.toLowerCase())
        ) {
          const definition = f["Definition"] || f[Object.keys(f)[1]] || "";
          const example = f["Example"] || undefined;
          const phonetic = f["Phonetic"] || undefined;
          const partOfSpeech = f["PartOfSpeech"] || undefined;
          results.push({ word: wordField, definition, example, phonetic, partOfSpeech, tags: note.tags });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

const ANKI_CACHE_KEY = "anki_cache_data";

export function getAnkiDecks(): { name: string; count: number }[] {
  try {
    const raw = localStorage.getItem(ANKI_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as { name: string; count: number }[];
  } catch {
    return [];
  }
}

function saveAnkiDecks(decks: { name: string; count: number }[]) {
  localStorage.setItem(ANKI_CACHE_KEY, JSON.stringify(decks));
}

export function removeAllAnkiData() {
  localStorage.removeItem("anki_data");
  localStorage.removeItem(ANKI_CACHE_KEY);
}

export function importAnkiData(deckName: string, notes: AnkiNote[]) {
  // Save notes for searching
  const stored = localStorage.getItem("anki_data");
  let decks: { deckName: string; notes: AnkiNote[] }[] = [];
  if (stored) {
    try { decks = JSON.parse(stored); } catch { decks = []; }
  }
  // Replace existing deck with same name
  decks = decks.filter((d) => d.deckName !== deckName);
  decks.push({ deckName, notes });
  localStorage.setItem("anki_data", JSON.stringify(decks));

  // Update deck list
  const deckList = getAnkiDecks().filter((d) => d.name !== deckName);
  deckList.push({ name: deckName, count: notes.length });
  saveAnkiDecks(deckList);
}
