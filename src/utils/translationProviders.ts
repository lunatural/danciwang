export function isTranslationWarning(text: string): boolean {
  const upper = text.toUpperCase();
  return upper.includes("MYMEMORY WARNING") || upper.includes("YOU USED ALL AVAILABLE FREE TRANSLATIONS");
}

async function fetchMyMemory(text: string, langpair: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}&de=vocabmaster@email.com`
      );
      const data = await res.json();
      const result = (data?.responseData?.translatedText || "").trim();
      if (result && result !== text && !isTranslationWarning(result)) return result;
    } catch { /* retry */ }
  }
  return "";
}

async function fetchBaiduSug(text: string): Promise<string> {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `kw=${encodeURIComponent(text)}`,
    });
    const data = await res.json();
    if (data?.errno === 0 && Array.isArray(data?.data) && data.data.length > 0) {
      const result = (data.data[0].v || "").trim();
      if (result && result !== text) return result;
    }
  } catch { /* ignore */ }
  return "";
}

export async function translateWithFallback(
  text: string,
  from: string,
  to: string
): Promise<string | null> {
  const langpair = from === "zh" ? "zh|en" : "en|zh";

  // 1. MyMemory with email (sentence-level, ~50000 chars/day)
  const myMemoryResult = await fetchMyMemory(text, langpair);
  if (myMemoryResult) return myMemoryResult;

  // 2. Baidu sug (word-level dictionary, unlimited)
  const baiduResult = await fetchBaiduSug(text);
  if (baiduResult && baiduResult !== text) return baiduResult;

  return null;
}
