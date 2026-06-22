export interface ECDictEntry {
  t?: string;    // Chinese translation
  d?: string;    // English definition
  p?: string;    // phonetic
  pos?: string;  // part of speech
  tag?: string;  // exam tags
  col?: number;  // collins
  oxf?: number;  // oxford
  bnc?: number;  // bnc frequency
  frq?: number;  // frequency
}

type DictData = Record<string, ECDictEntry>;

let dictPromise: Promise<DictData> | null = null;
let dictData: DictData | null = null;

function loadDict(): Promise<DictData> {
  if (dictData) return Promise.resolve(dictData);
  if (dictPromise) return dictPromise;

  dictPromise = Promise.all([
    fetch("/ecdict_1.json").then((res) => res.json()),
    fetch("/ecdict_2.json").then((res) => res.json()),
  ])
    .then(([part1, part2]) => {
      const merged = { ...part1, ...part2 } as DictData;
      dictData = merged;
      return merged;
    })
    .catch((err) => {
      dictPromise = null;
      throw err;
    });

  return dictPromise;
}

export function isDictLoaded(): boolean {
  return dictData !== null;
}

function cleanPartOfSpeech(raw: string): string {
  if (!raw) return "";
  // ECDICT pos field often has frequency data like "v:42/n:58"
  const parts = raw.split("/").map((p) => p.replace(/:\d+/g, "").trim());
  const map: Record<string, string> = {
    v: "v.", n: "n.", adj: "adj.", adv: "adv.", prep: "prep.",
    conj: "conj.", pron: "pron.", art: "art.", num: "num.",
    int: "int.", aux: "aux.", vt: "vt.", vi: "vi.",
    abbr: "abbr.", det: "det.", interj: "interj.",
  };
  const cleaned = parts.map((p) => map[p.toLowerCase()] || p).filter(Boolean).join("/");
  if (/\d/.test(cleaned) && cleaned.length > 10) return "";
  return cleaned;
}

export async function searchLocalDict(word: string): Promise<{
  word: string;
  phonetic: string;
  definition: string;
  translation: string;
  partOfSpeech: string;
  tags: string;
} | null> {
  const dict = await loadDict();
  const key = word.toLowerCase().trim();

  let entry = dict[key] || dict[word.trim()];
  if (!entry) return null;

  // New compact format: "phonetic|pos|chinese_translation"
  if (typeof entry === "string") {
    const parts = entry.split("|");
    return {
      word: word.trim(),
      phonetic: parts[0] || "",
      definition: "",
      translation: parts[2] || parts[0] || "",
      partOfSpeech: cleanPartOfSpeech(parts[1] || ""),
      tags: "",
    };
  }

  // Old object format (backward compat)
  return {
    word: word.trim(),
    phonetic: entry.p || "",
    definition: entry.d || "",
    translation: entry.t || "",
    partOfSpeech: cleanPartOfSpeech(entry.pos || ""),
    tags: entry.tag || "",
  };
}

export function preloadDict(): void {
  if (!dictPromise && !dictData) {
    const preload = () => loadDict();
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(preload);
    } else {
      setTimeout(preload, 2000);
    }
  }
}
