async function fetchMyMemory(text: string, langpair: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`
      );
      const data = await res.json();
      const result = (data?.responseData?.translatedText || "").trim();
      if (result && result !== text) return result;
    } catch { /* retry */ }
  }
  return "";
}

export async function translateWithFallback(
  text: string,
  from: string,
  to: string
): Promise<string | null> {
  const langpair = from === "zh" ? "zh|en" : "en|zh";
  const result = await fetchMyMemory(text, langpair);
  return result || null;
}
