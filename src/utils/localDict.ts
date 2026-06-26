type DictData = Record<string, string>;

let oxfordData: DictData | null = null;
let oxfordPromise: Promise<DictData> | null = null;

// ── 剑桥词典数据 ──
export interface CambridgeMeaning {
  partOfSpeech: string;
  definitions: { definition: string; example: string }[];
}

export interface CambridgeDictResult {
  word: string;
  phonetic: string;
  audio: string;
  meanings: CambridgeMeaning[];
}

// 按分组缓存剑桥词典数据（按需加载，不一次性全加载）
const cambridgeCache: Record<string, Record<string, CambridgeDictResult>> = {};
const cambridgePromises: Record<string, Promise<Record<string, CambridgeDictResult>>> = {};

// 根据单词首字母确定所属分组
function getCambridgeRange(word: string): string {
  const first = word.toLowerCase()[0];
  if (first >= 'a' && first <= 'd') return 'a-d';
  if (first >= 'e' && first <= 'h') return 'e-h';
  if (first >= 'i' && first <= 'l') return 'i-l';
  if (first >= 'm' && first <= 'p') return 'm-p';
  if (first >= 'q' && first <= 't') return 'q-t';
  return 'u-z';
}

function loadOxford(): Promise<DictData> {
  if (oxfordData) return Promise.resolve(oxfordData);
  if (oxfordPromise) return oxfordPromise;
  oxfordPromise = Promise.all([
    fetch("/oxford_1.json").then((res) => res.json()),
    fetch("/oxford_2.json").then((res) => res.json()),
  ]).then(([p1, p2]) => {
    oxfordData = { ...p1, ...p2 } as DictData;
    return oxfordData;
  }).catch((err) => { oxfordPromise = null; throw err; });
  return oxfordPromise;
}

// 按需加载单个分组（只加载当前单词需要的那个文件）
function loadCambridgeRange(range: string): Promise<Record<string, CambridgeDictResult>> {
  if (cambridgeCache[range]) return Promise.resolve(cambridgeCache[range]);
  if (cambridgePromises[range]) return cambridgePromises[range];
  cambridgePromises[range] = fetch(`/cambridge_${range}.json`)
    .then((res) => res.ok ? res.json() : {})
    .then((data) => {
      cambridgeCache[range] = data;
      return data;
    })
    .catch(() => ({}));
  return cambridgePromises[range];
}

export function isDictLoaded(): boolean {
  return oxfordData !== null;
}

export function isCambridgeLoaded(): boolean {
  return Object.keys(cambridgeCache).length > 0;
}

function cleanPartOfSpeech(raw: string): string {
  if (!raw) return "";
  const map: Record<string, string> = {
    v: "v.", n: "n.", adj: "adj.", adv: "adv.", prep: "prep.",
    conj: "conj.", pron: "pron.", art: "art.", int: "int.",
    aux: "aux.", vt: "vt.", vi: "vi.", abbr: "abbr.",
  };
  return map[raw.toLowerCase()] || raw;
}

// Check if a "translation" is actually an Oxford style note (not a real Chinese translation)
const STYLE_KEYWORDS = /\b(?:英式|美式|英国|美国|也作|亦作|也用于|非正式|正式|口语|书面|古语|古用法|老式|旧式|旧用法|俚语|粗话|粗俗|比喻|谚语|频率较低|频率较高|用于|亦用于|参见|亦见|缩写|复数|单数|不可数|可数|及物|不及物|过去式|过去分词|现在分词|比较级|最高级|第三人称|see also|also|compare|cf\.|esp\.|usu\.)\b/;

const LATIN_CHARS = /[a-zA-Z]/;
const CHINESE_CHARS = /[一-鿿]/;

function isStyleNote(translation: string): boolean {
  if (!translation) return false;
  const t = translation.trim();
  // Too short to be a real translation
  const chineseChars = (t.match(CHINESE_CHARS) || []).length;
  if (chineseChars < 1) return true;
  // Contains Latin characters mixed with style keywords → likely metadata
  if (LATIN_CHARS.test(t)) return true;
  // If more than half the text is style keywords, it's not a real translation
  if (STYLE_KEYWORDS.test(t) && chineseChars < 4) return true;
  return false;
}

export async function searchLocalDict(word: string): Promise<{
  word: string; phonetic: string; definition: string;
  translation: string; partOfSpeech: string; tags: string;
} | null> {
  const key = word.toLowerCase().trim();

  try {
    const ox = await loadOxford();
    const entry = ox[key] || ox[word.trim()];
    if (!entry) return null;

    // Format: phonetic|POS|english_definition|chinese_translation
    const parts = entry.split("|");
    const rawTranslation = parts[3] || "";
    return {
      word: word.trim(),
      phonetic: parts[0] || "",
      definition: parts[2] || "",    // English definition from Oxford
      translation: isStyleNote(rawTranslation) ? "" : rawTranslation,   // Filter out style notes
      partOfSpeech: cleanPartOfSpeech(parts[1] || ""),
      tags: "",
    };
  } catch {
    return null;
  }
}

export async function searchCambridgeDict(word: string): Promise<CambridgeDictResult | null> {
  const key = word.toLowerCase().trim();
  const range = getCambridgeRange(key);
  try {
    const dict = await loadCambridgeRange(range);
    return dict[key] || null;
  } catch {
    return null;
  }
}

export function preloadDict(): void {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => loadOxford().catch(() => {}));
  } else {
    setTimeout(() => loadOxford().catch(() => {}), 2000);
  }
  // 剑桥词典不预加载（太大），按需加载单个分组
}
