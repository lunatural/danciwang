import type { WordData, ExampleSentence } from "../utils/api";

interface LocalDictResult {
  word: string; phonetic: string; definition: string;
  translation: string; partOfSpeech: string; tags: string;
}

/** Merge ECDICT + Free Dictionary API + examples into one comprehensive WordData */
export function mergeWordData(
  word: string,
  local: LocalDictResult | null,
  apiData: WordData | null,
  examples: ExampleSentence[]
): WordData {
  const meanings: WordData["meanings"] = [];

  // 1. ECDICT Chinese translations as primary — filter out suspect entries
  if (local && (local.translation || local.definition)) {
    const cnParts = (local.translation || local.definition)
      .split(/[；;\\n]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => {
        // Skip single-word "definitions" like "Treasure." — probably wrong entry
        const chars = s.replace(/[a-zA-Z\s\.\,\;\:\!]/g, "");
        return chars.length >= 3 || s.length > 30;
      });

    if (cnParts.length > 0) {
      meanings.push({
        partOfSpeech: local.partOfSpeech || apiData?.meanings?.[0]?.partOfSpeech || "",
        definitions: cnParts.map((cn: string) => ({
          definition: cn,
          example: "",
          synonyms: [] as string[],
          antonyms: [] as string[],
        })),
        synonyms: [],
        antonyms: [],
      });
    }
  }

  // 2. API meanings always included (with examples and synonyms)
  if (apiData) {
    // Build set of existing definition texts for dedup
    const existingTexts = new Set(
      meanings.flatMap((m) => m.definitions.map((d) => d.definition.toLowerCase().replace(/[^a-z\\u4e00-\\u9fff]/g, "")))
    );

    for (const apiM of apiData.meanings) {
      const newDefs = apiM.definitions.filter((d) => {
        const key = d.definition.toLowerCase().replace(/[^a-z\\u4e00-\\u9fff]/g, "");
        return !existingTexts.has(key) && key.length > 0;
      });
      if (newDefs.length === 0) continue;

      meanings.push({
        partOfSpeech: apiM.partOfSpeech,
        definitions: newDefs.map((d) => ({
          definition: d.definition,
          example: d.example || "",
          synonyms: [] as string[],
          antonyms: [] as string[],
        })),
        synonyms: apiM.synonyms || [],
        antonyms: apiM.antonyms || [],
      });
    }
  }

  // 3. If no data at all, use API directly
  if (meanings.length === 0 && apiData) {
    return apiData;
  }

  // 4. Collect all synonyms across sources
  const allSynonyms: string[] = [];
  if (apiData) {
    for (const m of apiData.meanings) {
      allSynonyms.push(...(m.synonyms || []));
    }
  }

  return {
    word,
    phonetic: local?.phonetic || apiData?.phonetic || "",
    audio: apiData?.audio || "",
    meanings: meanings.map((m, i) => ({
      ...m,
      synonyms: i === 0 ? [...new Set(allSynonyms)] : m.synonyms,
    })),
    sourceUrls: apiData?.sourceUrls || [],
  };
}
