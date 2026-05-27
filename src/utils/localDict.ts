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

  dictPromise = fetch('/ecdict.json')
    .then((res) => res.json() as Promise<DictData>)
    .then((data) => {
      dictData = data;
      return data;
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

/**
 * Search the local ECDICT dictionary for a word.
 * Returns null if not found, or a formatted result.
 */
export async function searchLocalDict(word: string): Promise<{
  word: string;
  phonetic: string;
  definition: string;    // English definition
  translation: string;   // Chinese translation
  partOfSpeech: string;
  tags: string;
} | null> {
  const dict = await loadDict();
  const key = word.toLowerCase().trim();

  // Try exact match first
  let entry = dict[key] || dict[word.trim()];
  if (!entry) return null;

  return {
    word: word.trim(),
    phonetic: entry.p || '',
    definition: entry.d || '',
    translation: entry.t || '',
    partOfSpeech: entry.pos || '',
    tags: entry.tag || '',
  };
}

/**
 * Preload dictionary in background
 */
export function preloadDict(): void {
  if (!dictPromise && !dictData) {
    // Use requestIdleCallback or setTimeout to not block main thread
    const preload = () => loadDict();
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(preload);
    } else {
      setTimeout(preload, 2000);
    }
  }
}
