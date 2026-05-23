export interface WordData {
  word: string;
  phonetic?: string;
  audio?: string;
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
    synonyms: string[];
    antonyms: string[];
  }[];
  sourceUrls: string[];
}

const BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";

export async function fetchWord(word: string): Promise<WordData | null> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const entry = data[0];
    const phonetic =
      entry.phonetic ||
      entry.phonetics?.find((p: { text?: string }) => p.text)?.text ||
      "";

    const audio =
      entry.phonetics?.find((p: { audio?: string }) => p.audio)?.audio || "";

    const meanings = (entry.meanings || []).map(
      (m: {
        partOfSpeech?: string;
        definitions?: { definition: string; example?: string }[];
        synonyms?: string[];
        antonyms?: string[];
      }) => ({
        partOfSpeech: m.partOfSpeech || "",
        definitions: (m.definitions || []).map((d) => ({
          definition: d.definition,
          example: d.example || undefined,
        })),
        synonyms: m.synonyms || [],
        antonyms: m.antonyms || [],
      })
    );

    return {
      word: entry.word,
      phonetic,
      audio,
      meanings,
      sourceUrls: entry.sourceUrls || [],
    };
  } catch {
    return null;
  }
}

export interface SynonymData {
  word: string;
  synonyms: string[];
}

export async function fetchSynonyms(word: string): Promise<SynonymData> {
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=10`
    );
    const data = await res.json();
    return {
      word,
      synonyms: data.map((d: { word: string }) => d.word),
    };
  } catch {
    return { word, synonyms: [] };
  }
}

const translationCache: Record<string, string> = {};

export async function translateToChinese(text: string): Promise<string> {
  if (!text) return "";
  if (translationCache[text]) return translationCache[text];

  // Check localStorage cache
  const cacheKey = `tr_${text}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    translationCache[text] = cached;
    return cached;
  }

  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh`
    );
    const data = await res.json();
    const translated = data?.responseData?.translatedText || "";
    if (translated && translated !== text) {
      translationCache[text] = translated;
      try { localStorage.setItem(cacheKey, translated); } catch { /* storage full */ }
      return translated;
    }
  } catch { /* translation unavailable */ }
  return "";
}

export interface WordForm {
  word: string;
  forms: { form: string; tags: string }[];
}

const vocabLists: Record<string, string[]> = {
  "中考核心词汇": ["abandon", "ability", "abroad", "absent", "absorb", "abstract", "abundant", "academic", "accelerate", "accent", "accept", "access", "accident", "accommodation", "accompany", "accomplish", "account", "accurate", "accuse", "achieve", "achievement", "acid", "acknowledge", "acquire", "adapt", "addict", "adequate", "adjust", "admire", "admit", "adopt", "advance", "advantage", "adventure", "advertise", "advice", "affair", "affect", "afford", "aggressive", "agreement", "agriculture", "aircraft", "alarm", "album", "alcohol", "allow", "amaze", "ambition", "amount", "amuse", "analyze", "ancestor", "ancient", "anger", "anniversary", "announce", "annual", "anxious", "apart", "apology", "apparent", "appeal", "appetite", "application", "appointment", "appreciate", "approach", "appropriate", "approve", "architecture", "argue", "arise", "arrange", "arrest", "article", "artificial", "aspect", "assess", "assign", "assist", "associate", "assume", "atmosphere", "attach", "attack", "attempt", "attend", "attention", "attitude", "attract", "audience", "author", "authority", "automatic", "available", "avenue", "average", "avoid", "award", "aware", "awful", "bachelor", "background", "balance", "ban", "band", "bankrupt", "bargain", "barrier", "basic", "battle", "bear", "beauty", "behave", "behavior", "belief", "belong", "bend", "benefit", "bitter", "blame", "blanket", "bleed", "bless", "block", "board", "boil", "border", "bore", "bother", "bottom", "bound", "branch", "brand", "brave", "breath", "brief", "brilliant", "broadcast", "budget", "bunch", "burden", "burst", "cabin", "campaign", "cancel", "candidate", "capable", "capacity", "capital", "capture", "career", "carpet", "carve", "catalog", "category", "cause", "caution", "ceiling", "celebrate", "central", "ceremony", "certificate", "chain", "challenge", "champion", "channel", "chapter", "character", "characteristic", "charge", "charity", "chart", "chase", "chemical", "chief", "circumstance", "citizen", "civil", "civilization", "claim", "classic", "classify", "climate", "clinic", "coach", "collapse", "collection", "column", "combine", "comedy", "comfort", "command", "comment", "commerce", "commercial", "commission", "commit", "communication", "companion", "company", "compare", "compensate", "compete", "competence", "complaint", "complex", "component", "compose", "composition", "comprehension", "concentrate", "concept", "concern", "conclude", "concrete", "condition", "conduct", "conference", "confidence", "confirm", "conflict", "confuse", "congratulate", "connect", "conscience", "conscious", "consequence", "conservative", "consider", "consistent", "constant", "construct", "construction", "consume", "consumer", "contact", "contain", "contemporary", "content", "context", "continent", "continue", "contract", "contrast", "contribute", "contribution", "convenient", "conversation", "convince", "cooperate", "corporation", "correct", "correspond", "county", "court", "crash", "create", "creative", "credit", "crime", "criminal", "crisis", "critical", "crucial", "cultivate", "culture", "cure", "curious", "currency", "current", "curriculum", "custom", "data", "database", "deadline", "debate", "debt", "decade", "declare", "decline", "decorate", "decrease", "defeat", "defence", "defend", "define", "definite", "degree", "delay", "delicate", "deliver", "demand", "demonstrate", "department", "departure", "depend", "deposit", "depress", "describe", "description", "desert", "deserve", "design", "desire", "desperate", "destination", "destroy", "detail", "detect", "determine", "develop", "device", "devote", "dialogue", "dictation", "diet", "differ", "digest", "digital", "dilemma", "dimension", "diploma", "director", "disability", "disappoint", "disaster", "discipline", "discount", "discover", "discovery", "discrimination", "disease", "dismiss", "display", "distance", "distinguish", "distribute", "district", "disturb", "diverse", "division", "document", "domestic", "dominate", "donate", "draft", "dramatic", "due", "duration", "dynamic", "eager", "earn", "earthquake", "economic", "edition", "editor", "educate", "education", "effective", "efficient", "effort", "elder", "elect", "electricity", "electronic", "element", "embarrass", "emerge", "emotion", "emperor", "emphasis", "employ", "employee", "employer", "employment", "enable", "encounter", "encourage", "energy", "engage", "engine", "enormous", "ensure", "enterprise", "entertain", "enthusiasm", "entire", "environment", "equal", "equipment", "error", "escape", "essay", "essential", "establish", "estate", "estimate", "evaluate", "event", "evidence", "evident", "evolution", "exact", "examine", "exchange", "excite", "executive", "exercise", "exhibition", "exist", "expand", "expect", "expense", "experiment", "expert", "explain", "explicit", "exploit", "explore", "export", "expose", "express", "extension", "extent", "external", "extraordinary", "extreme", "facility", "factor", "faith", "false", "familiar", "fashion", "fault", "favor", "feast", "feature", "federal", "female", "fiction", "fierce", "figure", "finance", "financial", "firework", "flame", "flash", "flesh", "flexible", "flight", "float", "flood", "flourish", "flow", "focus", "fold", "forbid", "forecast", "foreign", "formal", "former", "fortune", "foundation", "fountain", "fragile", "framework", "frequent", "frontier", "function", "fund", "fundamental", "funeral", "furthermore", "gain", "gallery", "gap", "garbage", "gas", "gather", "gene", "general", "generate", "generation", "generous", "genius", "genuine", "gesture", "global", "globe", "glory", "goods", "govern", "grace", "gradual", "graduate", "grain", "grand", "grant", "grasp", "gravity", "greenhouse", "guarantee", "guidance", "guilty", "gymnasium", "handle", "harbour", "hardship", "harm", "harmony", "harvest", "hatred", "heading", "headline", "heaven", "heel", "height", "hesitate", "highlight", "highway", "historic", "holy", "honour", "horizon", "horrible", "household", "housing", "humour", "hunt", "hurricane", "hydrogen", "ideal", "identity", "ignore", "illegal", "illustrate", "image", "imagination", "immigrant", "impact", "import", "impress", "impression", "improve", "incident", "include", "income", "increase", "indeed", "independent", "indicate", "individual", "industry", "infer", "inflation", "influence", "inform", "information", "initial", "initiative", "injure", "innocent", "innovation", "input", "inquire", "insert", "inspect", "inspire", "instant", "instead", "institute", "institution", "instruction", "instrument", "insurance", "intellectual", "intelligence", "intend", "intense", "intention", "interact", "interest", "internal", "international", "internet", "interpret", "interrupt", "interview", "invade", "invent", "invest", "investigate", "investment", "involve", "isolate", "issue", "item", "jam", "joint", "journal", "journey", "judge", "justice", "justify", "keen", "kindergarten", "laboratory", "lack", "landscape", "lantern", "launch", "leading", "league", "leak", "leather", "legal", "legend", "leisure", "length", "lesson", "liberal", "liberate", "liberty", "lifestyle", "lightning", "likely", "limit", "link", "liquid", "literature", "lively", "loan", "local", "locate", "location", "logical", "loose", "lounge", "loyal", "luggage", "lung", "luxury", "machinery", "magic", "magnificent", "maintain", "major", "majority", "manage", "management", "mankind", "manner", "manufacture", "march", "margin", "market", "marriage", "mass", "master", "material", "matter", "mature", "maximum", "measure", "mechanism", "media", "medical", "medium", "memory", "mental", "mention", "merchant", "mercy", "merely", "method", "midnight", "migrate", "mild", "military", "million", "mineral", "minimum", "minister", "minority", "miracle", "miserable", "mission", "mistake", "mixture", "mobile", "moderate", "modest", "monitor", "monument", "mood", "moral", "motion", "motivate", "motor", "mountainous", "mourn", "movement", "murder", "muscle", "museum", "musician", "mutual", "mystery", "nail", "narrow", "nation", "national", "nationality", "native", "natural", "naughty", "necessary", "negative", "neglect", "negotiate", "neighbourhood", "nervous", "network", "nevertheless", "noble", "normal", "notice", "novel", "nowadays", "nowhere", "nuclear", "numerous", "nutrition", "obey", "object", "objective", "observe", "obtain", "obvious", "occasion", "occupy", "occur", "offence", "official", "opera", "operate", "operation", "opinion", "opponent", "opportunity", "oppose", "opposite", "option", "orbit", "ordinary", "organ", "organize", "origin", "original", "otherwise", "outcome", "outdoor", "outstanding", "overcome", "overlook", "overseas", "owe", "pace", "pack", "package", "painful", "panic", "paragraph", "parallel", "parcel", "participate", "particular", "partly", "passage", "passenger", "passive", "patience", "pattern", "pause", "payment", "peaceful", "peak", "penalty", "pension", "perform", "performance", "period", "permanent", "permission", "permit", "personal", "personality", "personnel", "persuade", "phenomenon", "philosophy", "physical", "pilot", "platform", "pleasant", "pleasure", "pledge", "plot", "plus", "poetry", "poison", "policy", "polish", "political", "politician", "politics", "pollution", "popular", "population", "portion", "portrait", "position", "positive", "possess", "possession", "possibility", "potential", "pour", "poverty", "power", "powerful", "practical", "precious", "precise", "predict", "prefer", "preference", "prejudice", "premier", "prepare", "presentation", "preserve", "president", "pressure", "presumably", "pretend", "prevent", "previous", "pride", "primary", "principle", "prior", "priority", "prison", "private", "privilege", "procedure", "process", "produce", "product", "profession", "professional", "profit", "program", "progress", "prohibit", "project", "promise", "promote", "proper", "property", "proportion", "proposal", "prospect", "protect", "protein", "protest", "proud", "prove", "provide", "province", "provision", "psychological", "publication", "publicity", "publish", "pulse", "punctual", "punish", "purchase", "pure", "purpose", "pursue", "qualification", "quality", "quantity", "quit", "race", "racial", "radiation", "range", "rank", "rapid", "rare", "rate", "rather", "raw", "react", "realistic", "reality", "reasonable", "rebel", "reception", "reckon", "recognize", "recommend", "recover", "recreation", "recycle", "reduce", "refer", "referee", "reference", "reflect", "reform", "refresh", "regard", "regardless", "region", "register", "regret", "regular", "reject", "relate", "relationship", "relative", "relax", "release", "relevant", "reliable", "relief", "religion", "rely", "remain", "remark", "remarkable", "remedy", "remote", "remove", "renew", "replace", "represent", "representative", "reputation", "request", "require", "requirement", "reservation", "reserve", "resign", "resist", "resolve", "resource", "respect", "respond", "responsibility", "responsible", "restore", "restriction", "result", "retire", "reveal", "revenue", "review", "revolution", "reward", "ridiculous", "risk", "rival", "rocket", "romantic", "root", "rough", "routine", "royal", "ruin", "rural", "sacred", "sacrifice", "safety", "salary", "satellite", "satisfaction", "satisfy", "scan", "scare", "scatter", "scene", "schedule", "scheme", "scholar", "scientific", "scream", "sculpture", "secondary", "section", "secure", "security", "seek", "seize", "select", "selfish", "seminar", "senior", "sensation", "sensitive", "separate", "sequence", "series", "severe", "shadow", "shallow", "sharp", "shelter", "shift", "shortcoming", "significant", "silence", "similar", "simple", "simplify", "sincere", "situation", "skilful", "skill", "slight", "smart", "smooth", "social", "society", "software", "solar", "solid", "solution", "somehow", "sorrow", "source", "sow", "spare", "specialist", "species", "specific", "spirit", "spiritual", "splendid", "split", "sponsor", "spot", "squeeze", "stable", "stage", "stain", "standard", "starve", "statistics", "status", "steady", "steel", "steep", "stem", "stick", "stimulate", "stock", "storage", "strategy", "strength", "strengthen", "stress", "strike", "structure", "struggle", "studio", "style", "subject", "submit", "subsequent", "substance", "substitute", "succeed", "success", "suffer", "sufficient", "suggest", "suitable", "summarize", "summary", "superb", "superior", "supply", "support", "suppose", "supreme", "surface", "surgeon", "surplus", "surround", "surrounding", "survey", "survive", "suspect", "suspend", "sustain", "swallow", "swear", "symbol", "sympathy", "symptom", "system", "tackle", "talent", "target", "technique", "technology", "telescope", "temporary", "tendency", "tender", "terminal", "territory", "terror", "theme", "theoretical", "therapy", "therefore", "thorough", "thought", "thread", "threat", "thrill", "thrive", "throughout", "thus", "tight", "tissue", "tolerate", "topic", "tough", "tourism", "tournament", "track", "trade", "tradition", "traditional", "tragedy", "transfer", "transform", "translate", "transparent", "transport", "trap", "treasure", "treat", "treaty", "tremble", "trend", "trial", "tribe", "trick", "triumph", "troop", "tropical", "trouble", "truly", "trust", "truth", "tune", "tutor", "typical", "ultimate", "undergo", "underground", "underline", "understand", "undertake", "unemployment", "unfair", "unfortunate", "uniform", "union", "unique", "unite", "unity", "universal", "universe", "university", "update", "upper", "upset", "urban", "urge", "urgent", "usual", "vacant", "vague", "vain", "valid", "valuable", "value", "variety", "various", "vehicle", "venture", "version", "vertical", "vessel", "victim", "violence", "virtue", "virus", "visible", "vision", "visual", "vital", "vivid", "vocabulary", "volume", "voluntary", "volunteer", "wage", "wander", "warmth", "wealth", "weapon", "weather", "website", "wedding", "welfare", "western", "whereas", "whisper", "widespread", "willingness", "wisdom", "withdraw", "witness", "wonder", "worthwhile", "worthy", "youth"],
};

export function getVocabLists(): { name: string; count: number }[] {
  return Object.entries(vocabLists).map(([name, words]) => ({
    name,
    count: words.length,
  }));
}

export function getVocabList(name: string): string[] {
  return vocabLists[name] || [];
}
