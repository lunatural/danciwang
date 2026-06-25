import type { WordData, ExampleSentence } from "../utils/api";
import type { CambridgeDictResult } from "./localDict";

interface LocalDictResult {
  word: string; phonetic: string; definition: string;
  translation: string; partOfSpeech: string; tags: string;
}

/** Merge Cambridge (primary) > Free Dictionary API > Oxford dictionary (fallback) */
export function mergeWordData(
  word: string,
  local: LocalDictResult | null,
  apiData: WordData | null,
  examples: ExampleSentence[],
  cambridge?: CambridgeDictResult | null
): WordData {
  const meanings: WordData["meanings"] = [];

  // ── Cambridge Dictionary as primary ──
  if (cambridge && cambridge.meanings.length > 0) {
    for (const m of cambridge.meanings) {
      meanings.push({
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions.map((d) => ({
          definition: d.definition,
          example: d.example || "",
          synonyms: [] as string[],
          antonyms: [] as string[],
        })),
        synonyms: [],
        antonyms: [],
      });
    }
  }

  // ── Free Dictionary API as secondary ──
  if (meanings.length === 0 && apiData) {
    for (const m of apiData.meanings) {
      meanings.push({
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions.map((d) => ({
          definition: d.definition,
          example: d.example || "",
          synonyms: [] as string[],
          antonyms: [] as string[],
        })),
        synonyms: m.synonyms || [],
        antonyms: m.antonyms || [],
      });
    }
  }

  // ── Oxford as fallback / supplement ──
  if (meanings.length === 0 && local && local.translation) {
    const defs: { definition: string; example: string; synonyms: string[]; antonyms: string[] }[] = [];
    if (local.translation) {
      defs.push({ definition: local.translation, example: "", synonyms: [], antonyms: [] });
    }
    if (local.definition && local.definition !== local.translation) {
      defs.push({ definition: local.definition, example: "", synonyms: [], antonyms: [] });
    }
    meanings.push({
      partOfSpeech: local.partOfSpeech || "",
      definitions: defs,
      synonyms: [],
      antonyms: [],
    });
  }

  // ── Collect synonyms ──
  const allSynonyms: string[] = [];
  if (apiData) {
    for (const m of apiData.meanings) {
      allSynonyms.push(...(m.synonyms || []));
    }
  }

  // ── Determine source ──
  let source: WordData['source'] = 'unknown';
  if (cambridge && cambridge.meanings.length > 0) source = 'cambridge';
  else if (apiData) source = 'free-api';
  else if (local) source = 'oxford';

  return {
    word,
    phonetic: cambridge?.phonetic || apiData?.phonetic || local?.phonetic || "",
    audio: cambridge?.audio || apiData?.audio || "",
    meanings: meanings.map((m, i) => ({
      ...m,
      synonyms: i === 0 ? [...new Set(allSynonyms)] : m.synonyms,
    })),
    sourceUrls: apiData?.sourceUrls || [],
    source,
  };
}
