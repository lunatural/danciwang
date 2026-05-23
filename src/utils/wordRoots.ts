interface RootEntry {
  root: string;
  meaning: string;
  meaningCn: string;
  examples: string[];
}

const prefixes: RootEntry[] = [
  { root: "a-", meaning: "not, without", meaningCn: "不、无", examples: ["amoral", "atypical"] },
  { root: "ab-", meaning: "away from", meaningCn: "离开、偏离", examples: ["abnormal", "absorb"] },
  { root: "ad-", meaning: "to, toward", meaningCn: "向、朝", examples: ["advance", "admit"] },
  { root: "anti-", meaning: "against", meaningCn: "反对、对抗", examples: ["antibody", "antonym"] },
  { root: "auto-", meaning: "self", meaningCn: "自己、自动", examples: ["automatic", "automobile"] },
  { root: "bene-", meaning: "good, well", meaningCn: "好、善", examples: ["benefit", "benevolent"] },
  { root: "bi-", meaning: "two", meaningCn: "二、双", examples: ["bicycle", "bilingual"] },
  { root: "circum-", meaning: "around", meaningCn: "环绕、周围", examples: ["circumstance", "circumference"] },
  { root: "co-/com-/con-", meaning: "together, with", meaningCn: "一起、共同", examples: ["cooperate", "combine", "connect"] },
  { root: "contra-", meaning: "against", meaningCn: "反对、相反", examples: ["contradict", "contrast"] },
  { root: "de-", meaning: "down, away, remove", meaningCn: "向下、离开、去除", examples: ["decrease", "depart", "destroy"] },
  { root: "dis-", meaning: "not, opposite of", meaningCn: "不、相反", examples: ["disagree", "disappear"] },
  { root: "en-/em-", meaning: "make, put into", meaningCn: "使、放入", examples: ["enable", "employ"] },
  { root: "ex-", meaning: "out, former", meaningCn: "出、前任", examples: ["export", "exclude"] },
  { root: "extra-", meaning: "beyond, outside", meaningCn: "超出、额外", examples: ["extraordinary", "extreme"] },
  { root: "fore-", meaning: "before, front", meaningCn: "前、预先", examples: ["forecast", "foresee"] },
  { root: "il-/im-/in-/ir-", meaning: "not", meaningCn: "不、非", examples: ["illegal", "impossible", "inactive", "irregular"] },
  { root: "inter-", meaning: "between, among", meaningCn: "之间、互相", examples: ["international", "interact"] },
  { root: "mal-", meaning: "bad, wrong", meaningCn: "坏、错", examples: ["malfunction", "malnutrition"] },
  { root: "micro-", meaning: "small", meaningCn: "小、微", examples: ["microscope", "microphone"] },
  { root: "mid-", meaning: "middle", meaningCn: "中间", examples: ["midnight", "midway"] },
  { root: "mis-", meaning: "wrong, bad", meaningCn: "错误、坏", examples: ["mistake", "misunderstand"] },
  { root: "mono-", meaning: "one, single", meaningCn: "一、单一", examples: ["monopoly", "monologue"] },
  { root: "multi-", meaning: "many", meaningCn: "多", examples: ["multiple", "multiply"] },
  { root: "non-", meaning: "not", meaningCn: "不、非", examples: ["nonstop", "nonprofit"] },
  { root: "out-", meaning: "beyond, more than", meaningCn: "超过、外出", examples: ["outcome", "outstanding"] },
  { root: "over-", meaning: "too much, above", meaningCn: "过度、在上", examples: ["overcome", "overlook"] },
  { root: "per-", meaning: "through, thoroughly", meaningCn: "贯穿、完全", examples: ["perfect", "perform"] },
  { root: "post-", meaning: "after", meaningCn: "之后", examples: ["postpone", "postgraduate"] },
  { root: "pre-", meaning: "before", meaningCn: "之前、预先", examples: ["predict", "prevent"] },
  { root: "pro-", meaning: "forward, for", meaningCn: "向前、支持", examples: ["progress", "promote"] },
  { root: "re-", meaning: "again, back", meaningCn: "再、回", examples: ["return", "review"] },
  { root: "semi-", meaning: "half", meaningCn: "一半", examples: ["semifinal", "semiconductor"] },
  { root: "sub-", meaning: "under, below", meaningCn: "下、次", examples: ["submarine", "subway"] },
  { root: "super-", meaning: "above, beyond", meaningCn: "上、超", examples: ["superior", "supermarket"] },
  { root: "tele-", meaning: "far, distant", meaningCn: "远", examples: ["telephone", "television"] },
  { root: "trans-", meaning: "across, change", meaningCn: "跨越、转变", examples: ["transport", "transform"] },
  { root: "tri-", meaning: "three", meaningCn: "三", examples: ["triangle", "tricycle"] },
  { root: "un-", meaning: "not, opposite", meaningCn: "不、相反", examples: ["unable", "unfair"] },
  { root: "under-", meaning: "below, insufficient", meaningCn: "下、不足", examples: ["underground", "underestimate"] },
  { root: "up-", meaning: "up, upward", meaningCn: "向上", examples: ["update", "upgrade"] },
  { root: "with-", meaning: "against, back", meaningCn: "反对、向后", examples: ["withdraw", "withhold"] },
];

const suffixes: RootEntry[] = [
  { root: "-able/-ible", meaning: "capable of", meaningCn: "能…的", examples: ["readable", "flexible"] },
  { root: "-al", meaning: "relating to", meaningCn: "…的（形容词）", examples: ["personal", "national"] },
  { root: "-ance/-ence", meaning: "state or quality", meaningCn: "状态、性质", examples: ["importance", "confidence"] },
  { root: "-ant/-ent", meaning: "one who, that which", meaningCn: "…的人/物", examples: ["assistant", "student"] },
  { root: "-ary/-ory", meaning: "relating to, place for", meaningCn: "…的、…场所", examples: ["ordinary", "laboratory"] },
  { root: "-ate", meaning: "to make", meaningCn: "使…（动词）", examples: ["activate", "communicate"] },
  { root: "-cy/-ty/-ity", meaning: "state or quality", meaningCn: "性质、状态", examples: ["privacy", "safety", "ability"] },
  { root: "-ee", meaning: "person who receives", meaningCn: "被…的人", examples: ["employee", "trainee"] },
  { root: "-en", meaning: "to make", meaningCn: "使变成…", examples: ["strengthen", "widen"] },
  { root: "-er/-or", meaning: "one who does", meaningCn: "做…的人/物", examples: ["teacher", "actor"] },
  { root: "-ese", meaning: "of a place or style", meaningCn: "…的（风格/国家）", examples: ["Chinese", "Japanese"] },
  { root: "-ess", meaning: "female", meaningCn: "女性", examples: ["actress", "hostess"] },
  { root: "-ful", meaning: "full of", meaningCn: "充满…的", examples: ["beautiful", "powerful"] },
  { root: "-hood", meaning: "state, condition", meaningCn: "状态、身份", examples: ["childhood", "neighborhood"] },
  { root: "-ian", meaning: "person from/skilled in", meaningCn: "…的人", examples: ["musician", "librarian"] },
  { root: "-ic/-ical", meaning: "relating to", meaningCn: "…的", examples: ["economic", "historical"] },
  { root: "-ify", meaning: "to make", meaningCn: "使…化", examples: ["simplify", "classify"] },
  { root: "-ing", meaning: "action or process", meaningCn: "动作/过程", examples: ["building", "learning"] },
  { root: "-ion/-tion/-sion", meaning: "act or process", meaningCn: "动作、过程", examples: ["action", "education", "decision"] },
  { root: "-ish", meaning: "somewhat, like", meaningCn: "有点…的", examples: ["childish", "reddish"] },
  { root: "-ism", meaning: "doctrine, belief", meaningCn: "主义、学说", examples: ["socialism", "capitalism"] },
  { root: "-ist", meaning: "one who practices", meaningCn: "…家/者", examples: ["scientist", "artist"] },
  { root: "-ive", meaning: "tending to", meaningCn: "有…倾向的", examples: ["active", "creative"] },
  { root: "-ize/-ise", meaning: "to make", meaningCn: "使…化", examples: ["realize", "organize"] },
  { root: "-less", meaning: "without", meaningCn: "无…的", examples: ["homeless", "endless"] },
  { root: "-logy", meaning: "study of", meaningCn: "…学", examples: ["biology", "psychology"] },
  { root: "-ly", meaning: "in a manner", meaningCn: "…地（副词）", examples: ["quickly", "carefully"] },
  { root: "-ment", meaning: "result, action", meaningCn: "结果、动作", examples: ["movement", "development"] },
  { root: "-ness", meaning: "state of being", meaningCn: "性质、状态", examples: ["happiness", "darkness"] },
  { root: "-ous/-ious", meaning: "full of", meaningCn: "充满…的", examples: ["famous", "dangerous"] },
  { root: "-ship", meaning: "position, condition", meaningCn: "身份、关系", examples: ["friendship", "leadership"] },
  { root: "-ward", meaning: "direction", meaningCn: "朝向", examples: ["forward", "backward"] },
  { root: "-y", meaning: "characterized by", meaningCn: "有…特征的", examples: ["rainy", "healthy"] },
];

const roots: RootEntry[] = [
  { root: "act", meaning: "to do, drive", meaningCn: "做、行动", examples: ["action", "active", "react"] },
  { root: "aud", meaning: "to hear", meaningCn: "听", examples: ["audio", "audience", "auditorium"] },
  { root: "bio", meaning: "life", meaningCn: "生命", examples: ["biology", "biography", "antibiotic"] },
  { root: "cap/capt/cept", meaning: "to take, seize", meaningCn: "拿、抓", examples: ["capture", "accept", "concept"] },
  { root: "ced/ceed/cess", meaning: "to go, yield", meaningCn: "走、让步", examples: ["proceed", "succeed", "access"] },
  { root: "cent", meaning: "hundred", meaningCn: "百", examples: ["century", "percent", "centimeter"] },
  { root: "chron", meaning: "time", meaningCn: "时间", examples: ["chronic", "synchronize", "chronology"] },
  { root: "cid/cis", meaning: "to cut, kill", meaningCn: "切、杀", examples: ["decide", "precise", "suicide"] },
  { root: "circ", meaning: "ring, circle", meaningCn: "环、圆", examples: ["circle", "circus", "circulate"] },
  { root: "claim/clam", meaning: "to shout, call", meaningCn: "喊、叫", examples: ["exclaim", "proclaim", "clamor"] },
  { root: "clud/clus", meaning: "to close, shut", meaningCn: "关闭", examples: ["include", "exclude", "conclusion"] },
  { root: "cogn", meaning: "to know", meaningCn: "知道、认识", examples: ["recognize", "cognitive", "incognito"] },
  { root: "corp", meaning: "body", meaningCn: "身体、团体", examples: ["corporation", "corpse", "incorporate"] },
  { root: "cred", meaning: "to believe, trust", meaningCn: "相信、信任", examples: ["credit", "incredible", "credentials"] },
  { root: "cur/curs", meaning: "to run", meaningCn: "跑", examples: ["current", "occur", "excursion"] },
  { root: "dem", meaning: "people", meaningCn: "人民", examples: ["democracy", "epidemic", "demographic"] },
  { root: "dic/dict", meaning: "to say, speak", meaningCn: "说、讲", examples: ["dictate", "predict", "dictionary"] },
  { root: "duc/duct", meaning: "to lead", meaningCn: "引导", examples: ["conduct", "produce", "introduce"] },
  { root: "equ", meaning: "equal", meaningCn: "相等", examples: ["equal", "equality", "equation"] },
  { root: "fac/fic/fec", meaning: "to make, do", meaningCn: "做、制造", examples: ["factory", "difficult", "effect"] },
  { root: "fer", meaning: "to carry, bring", meaningCn: "携带、带来", examples: ["transfer", "refer", "conference"] },
  { root: "fid", meaning: "faith, trust", meaningCn: "信任", examples: ["confidence", "fidelity", "federal"] },
  { root: "fin", meaning: "end, limit", meaningCn: "结束、界限", examples: ["finish", "final", "define"] },
  { root: "flex/flect", meaning: "to bend", meaningCn: "弯曲", examples: ["flexible", "reflect", "deflect"] },
  { root: "form", meaning: "shape", meaningCn: "形状、形式", examples: ["reform", "transform", "uniform"] },
  { root: "gen", meaning: "birth, race, kind", meaningCn: "出生、种类", examples: ["generate", "generous", "gene"] },
  { root: "grad/gress", meaning: "to step, go", meaningCn: "走、步", examples: ["graduate", "progress", "aggressive"] },
  { root: "graph/gram", meaning: "to write, draw", meaningCn: "写、画", examples: ["photograph", "program", "graphic"] },
  { root: "ject", meaning: "to throw", meaningCn: "投、掷", examples: ["reject", "project", "inject"] },
  { root: "junct/join", meaning: "to join, connect", meaningCn: "连接", examples: ["junction", "join", "conjunction"] },
  { root: "lect/leg", meaning: "to choose, gather", meaningCn: "选择、收集", examples: ["collect", "elect", "select"] },
  { root: "loc", meaning: "place", meaningCn: "地方", examples: ["location", "local", "dislocate"] },
  { root: "log", meaning: "word, reason, speech", meaningCn: "言语、逻辑", examples: ["logic", "dialogue", "apology"] },
  { root: "luc/lum", meaning: "light", meaningCn: "光", examples: ["illuminate", "translucent", "luminous"] },
  { root: "magn", meaning: "great, large", meaningCn: "大", examples: ["magnificent", "magnify", "magnitude"] },
  { root: "man/manu", meaning: "hand", meaningCn: "手", examples: ["manual", "manufacture", "manuscript"] },
  { root: "mem/memor", meaning: "mindful, remember", meaningCn: "记忆", examples: ["memory", "remember", "memorial"] },
  { root: "ment", meaning: "mind, think", meaningCn: "心智、思考", examples: ["mental", "mention", "comment"] },
  { root: "mit/miss", meaning: "to send", meaningCn: "发送", examples: ["submit", "admit", "mission"] },
  { root: "mort", meaning: "death", meaningCn: "死亡", examples: ["mortal", "immortal", "mortgage"] },
  { root: "mov/mot", meaning: "to move", meaningCn: "移动", examples: ["movement", "motion", "promote"] },
  { root: "nat", meaning: "born", meaningCn: "出生", examples: ["nature", "nation", "native"] },
  { root: "nov", meaning: "new", meaningCn: "新", examples: ["novel", "innovate", "renovate"] },
  { root: "ord", meaning: "order", meaningCn: "顺序", examples: ["order", "ordinary", "coordinate"] },
  { root: "path", meaning: "feeling, suffering", meaningCn: "感受、痛苦", examples: ["sympathy", "pathetic", "empathy"] },
  { root: "ped/pod", meaning: "foot", meaningCn: "脚", examples: ["pedestrian", "tripod", "pedal"] },
  { root: "pend/pens", meaning: "to hang, weigh, pay", meaningCn: "悬挂、衡量、支付", examples: ["depend", "expensive", "suspend"] },
  { root: "phil", meaning: "love", meaningCn: "爱", examples: ["philosophy", "philanthropy", "bibliophile"] },
  { root: "phon", meaning: "sound, voice", meaningCn: "声音", examples: ["telephone", "symphony", "microphone"] },
  { root: "poli", meaning: "city, state", meaningCn: "城市、国家", examples: ["politics", "policy", "metropolitan"] },
  { root: "port", meaning: "to carry", meaningCn: "携带、运送", examples: ["transport", "export", "portable"] },
  { root: "pos/pon", meaning: "to place, put", meaningCn: "放置", examples: ["position", "compose", "postpone"] },
  { root: "press", meaning: "to press", meaningCn: "压", examples: ["express", "impress", "depress"] },
  { root: "psych", meaning: "mind, soul", meaningCn: "心灵、精神", examples: ["psychology", "psychiatry", "psyche"] },
  { root: "quer/quest/quir", meaning: "to seek, ask", meaningCn: "寻求、问", examples: ["question", "request", "inquire"] },
  { root: "rupt", meaning: "to break", meaningCn: "打破、断裂", examples: ["interrupt", "bankrupt", "erupt"] },
  { root: "sci", meaning: "to know", meaningCn: "知道", examples: ["science", "conscious", "conscience"] },
  { root: "scrib/script", meaning: "to write", meaningCn: "写", examples: ["describe", "prescription", "manuscript"] },
  { root: "sens/sent", meaning: "to feel", meaningCn: "感觉", examples: ["sensitive", "consent", "sensation"] },
  { root: "sequ/secut", meaning: "to follow", meaningCn: "跟随", examples: ["sequence", "consequence", "persecute"] },
  { root: "serv", meaning: "to keep, serve", meaningCn: "保持、服务", examples: ["service", "reserve", "observe"] },
  { root: "sign", meaning: "mark, sign", meaningCn: "标记、符号", examples: ["signal", "design", "significant"] },
  { root: "simil/simul", meaning: "like, same", meaningCn: "相似、同时", examples: ["similar", "simulate", "assimilate"] },
  { root: "sol", meaning: "alone, sun", meaningCn: "单独、太阳", examples: ["solo", "solar", "isolate"] },
  { root: "spec/spic", meaning: "to look, see", meaningCn: "看", examples: ["inspect", "respect", "conspicuous"] },
  { root: "spir", meaning: "to breathe", meaningCn: "呼吸", examples: ["spirit", "inspire", "respire"] },
  { root: "st/stat", meaning: "to stand, state", meaningCn: "站立、状态", examples: ["stable", "station", "status"] },
  { root: "struct", meaning: "to build", meaningCn: "建造", examples: ["structure", "construct", "destroy"] },
  { root: "sum/sumpt", meaning: "to take", meaningCn: "拿、取", examples: ["assume", "consume", "presume"] },
  { root: "tact/tang", meaning: "to touch", meaningCn: "触摸", examples: ["contact", "tangible", "intact"] },
  { root: "tend/tens/tent", meaning: "to stretch, hold", meaningCn: "伸展、保持", examples: ["extend", "tension", "intend"] },
  { root: "terr", meaning: "earth, land", meaningCn: "土地", examples: ["territory", "terrain", "Mediterranean"] },
  { root: "tract", meaning: "to pull, drag", meaningCn: "拉、拖", examples: ["attract", "contract", "subtract"] },
  { root: "vac/van", meaning: "to be empty", meaningCn: "空", examples: ["vacant", "vanish", "vacuum"] },
  { root: "ven/vent", meaning: "to come", meaningCn: "来", examples: ["event", "prevent", "adventure"] },
  { root: "vers/vert", meaning: "to turn", meaningCn: "转", examples: ["convert", "diverse", "reverse"] },
  { root: "vid/vis", meaning: "to see", meaningCn: "看", examples: ["vision", "visible", "provide"] },
  { root: "vit/viv", meaning: "to live", meaningCn: "活、生命", examples: ["vital", "survive", "vivid"] },
  { root: "voc/vok", meaning: "to call, voice", meaningCn: "叫、声音", examples: ["voice", "provoke", "advocate"] },
  { root: "volv/volut", meaning: "to roll, turn", meaningCn: "滚、转", examples: ["involve", "revolution", "evolve"] },
];

export interface WordRootResult {
  prefixes: RootEntry[];
  suffixes: RootEntry[];
  roots: RootEntry[];
}

export function analyzeWordRoots(word: string): WordRootResult {
  const lower = word.toLowerCase();
  const foundPrefixes: RootEntry[] = [];
  const foundSuffixes: RootEntry[] = [];
  const foundRoots: RootEntry[] = [];

  for (const p of prefixes) {
    const prefixRoot = p.root.replace(/-/g, "").replace(/\/.*$/, "");
    if (lower.startsWith(prefixRoot) && prefixRoot.length >= 2) {
      foundPrefixes.push(p);
    }
    // Also check variant forms
    const variants = p.root.split("/");
    for (const v of variants) {
      const clean = v.replace(/-/g, "");
      if (clean.length >= 2 && lower.startsWith(clean) && !foundPrefixes.includes(p)) {
        foundPrefixes.push(p);
      }
    }
  }

  for (const s of suffixes) {
    const suffixRoot = s.root.replace(/-/g, "").replace(/\/.*$/, "");
    if (lower.endsWith(suffixRoot) && suffixRoot.length >= 2) {
      foundSuffixes.push(s);
    }
    const variants = s.root.split("/");
    for (const v of variants) {
      const clean = v.replace(/-/g, "");
      if (clean.length >= 2 && lower.endsWith(clean) && !foundSuffixes.includes(s)) {
        foundSuffixes.push(s);
      }
    }
  }

  for (const r of roots) {
    if (lower.includes(r.root) && r.root.length >= 2) {
      foundRoots.push(r);
    }
  }

  // Dedup and limit
  return {
    prefixes: foundPrefixes.slice(0, 3),
    suffixes: foundSuffixes.slice(0, 3),
    roots: foundRoots.slice(0, 5),
  };
}
