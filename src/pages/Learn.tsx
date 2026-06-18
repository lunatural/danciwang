import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSyncVersion } from "../App";
import { getLearningWords, getWords, moveToReview } from "../hooks/useData";
import { incrementDailyCount } from "../utils/dailyActivity";
import { fetchWord, fetchExampleSentences, translateToChinese, type WordData, type ExampleSentence } from "../utils/api";
import { searchLocalDict } from "../utils/localDict";
import ClickableText from "../components/ClickableText";
import { BookOpen, Check } from "lucide-react";
import gsap from "gsap";

type SortMode = "default" | "random" | "az" | "za";

function sortWords(words: string[], mode: SortMode): string[] {
  const arr = [...words];
  switch (mode) {
    case "random":
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    case "az":
      return arr.sort((a, b) => a.localeCompare(b));
    case "za":
      return arr.sort((a, b) => b.localeCompare(a));
    default:
      return arr;
  }
}

export default function Learn() {
  const { user } = useAuth();
  const syncVersion = useSyncVersion();
  const navigate = useNavigate();
  const [allLearningWords, setAllLearningWords] = useState<string[]>([]);
  const [originalWords, setOriginalWords] = useState<string[]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [examples, setExamples] = useState<ExampleSentence[]>([]);
  const [cnTranslations, setCnTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingWord, setLoadingWord] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [groupFilter, setGroupFilter] = useState("全部");
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Word data cache for instant switching
  const wordCache = useRef<Map<string, { data: WordData; examples: ExampleSentence[] }>>(new Map());
  const prefetching = useRef<Set<string>>(new Set());
  // Track current word to prevent stale responses
  const currentWordRef = useRef<string>("");
  const wordsRef = useRef<string[]>([]);
  wordsRef.current = words;

  const wordGroupMap = new Map<string, string>();
  if (user) {
    for (const w of getWords(user.id)) {
      wordGroupMap.set(w.word, w.group);
    }
  }

  const filterByGroup = useCallback(
    (ws: string[], group: string): string[] => {
      if (group === "全部") return ws;
      return ws.filter((w) => wordGroupMap.get(w) === group);
    },
    [wordGroupMap]
  );

  useEffect(() => {
    if (!user) return;
    const raw = getLearningWords(user.id);
    setAllLearningWords(raw);

    const groups = new Set<string>();
    for (const w of raw) {
      groups.add(wordGroupMap.get(w) || "未分组");
    }
    setAvailableGroups(Array.from(groups).sort());

    const filtered = filterByGroup(raw, groupFilter);
    setOriginalWords(filtered);
    setWords(filtered);
    setLoading(false);

    // Initial word load
    if (filtered.length > 0) {
      loadWord(filtered[0]);
    }
  }, [user, syncVersion]);

  const changeGroup = (group: string) => {
    setGroupFilter(group);
    const filtered = filterByGroup(allLearningWords, group);
    setOriginalWords(filtered);
    const sorted = sortMode === "default" ? filtered : sortWords(filtered, sortMode);
    setWords(sorted);
    setCurrentIndex(0);
    setWordData(null);
    setExamples([]);
    if (sorted.length > 0) {
      loadWord(sorted[0]);
    }
  };

  const applySort = useCallback(
    (mode: SortMode) => {
      setSortMode(mode);
      const sorted = sortWords(originalWords, mode);
      setWords(sorted);
      setCurrentIndex(0);
      setWordData(null);
      setExamples([]);
      if (sorted.length > 0) {
        loadWord(sorted[0]);
      }
    },
    [originalWords]
  );

  const loadWord = useCallback((word: string) => {
    // Mark this word as current — stale responses will be ignored
    currentWordRef.current = word;

    // Check cache first — instant display
    const cached = wordCache.current.get(word);
    if (cached) {
      setWordData(cached.data);
      setExamples(cached.examples);
      setLoadingWord(false);
      // Pre-fetch next word
      const idx = wordsRef.current.indexOf(word);
      if (idx >= 0 && idx + 1 < wordsRef.current.length) {
        prefetchWord(wordsRef.current[idx + 1]);
      }
      return;
    }

    setLoadingWord(true);

    // Try ECDICT for instant display while API loads
    searchLocalDict(word).then((local) => {
      // Ignore stale response
      if (currentWordRef.current !== word) return;
      if (local) {
        const localData: WordData = {
          word: local.word,
          phonetic: local.phonetic,
          meanings: [{
            partOfSpeech: local.partOfSpeech,
            definitions: [{
              definition: local.definition || local.translation || "",
              example: "",
              synonyms: [],
              antonyms: [],
            }],
            synonyms: [],
            antonyms: [],
          }],
          audio: "",
          sourceUrl: "",
        };
        setWordData(localData);
        setExamples([]);
        setLoadingWord(false);
      }
    });

    // Fetch full API data
    Promise.all([
      fetchWord(word),
      fetchExampleSentences(word),
    ]).then(([data, exs]) => {
      // Ignore stale response
      if (currentWordRef.current !== word) return;
      if (data) {
        wordCache.current.set(word, { data, examples: exs });
        setWordData(data);
        setExamples(exs);
      }
      setLoadingWord(false);
      // Pre-fetch next word
      const idx = wordsRef.current.indexOf(word);
      if (idx >= 0 && idx + 1 < wordsRef.current.length) {
        prefetchWord(wordsRef.current[idx + 1]);
      }
    });
  }, []);

  // Pre-fetch word data into cache in background
  const prefetchWord = useCallback((word: string) => {
    if (wordCache.current.has(word) || prefetching.current.has(word)) return;
    prefetching.current.add(word);
    Promise.all([
      fetchWord(word),
      fetchExampleSentences(word),
    ]).then(([data, exs]) => {
      // Only cache if data is valid
      if (data) wordCache.current.set(word, { data, examples: exs });
      prefetching.current.delete(word);
    }).catch(() => {
      prefetching.current.delete(word);
    });
  }, []);

  // Fetch Chinese translations for definitions
  useEffect(() => {
    if (!wordData) return;
    const defs: string[] = [];
    for (const m of wordData.meanings) {
      for (const d of m.definitions.slice(0, 3)) {
        if (d.definition) defs.push(d.definition);
      }
    }
    if (defs.length === 0) return;
    Promise.all(defs.map((d) => translateToChinese(d))).then((results) => {
      const map: Record<string, string> = {};
      defs.forEach((d, i) => {
        if (results[i]) map[d] = results[i];
      });
      setCnTranslations(map);
    });
  }, [wordData]);

  // Card entrance animation
  useEffect(() => {
    if (!cardRef.current || loadingWord) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 20, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power2.out" }
    );
  }, [wordData, loadingWord]);

  // Scroll to top when word index changes
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [currentIndex]);

  const tiltCard = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 20;
    const y = (e.clientY - top - height / 2) / 20;
    el.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  };

  const tiltReset = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "rotateY(0deg) rotateX(0deg)";
  };

  const handleLearned = () => {
    if (!user || words.length === 0) return;
    const word = words[currentIndex];
    moveToReview(user.id, word);
    incrementDailyCount(user.id, "learnedCount");
    setAllLearningWords((prev) => prev.filter((w) => w !== word));
    const remainingOriginal = originalWords.filter((w) => w !== word);
    setOriginalWords(remainingOriginal);
    const remaining = words.filter((_, i) => i !== currentIndex);
    setWords(remaining);
    if (remaining.length === 0) {
      setWordData(null);
      return;
    }
    const nextIndex = currentIndex >= remaining.length ? 0 : currentIndex;
    setCurrentIndex(nextIndex);
    loadWord(remaining[nextIndex]);
  };

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "default", label: "默认顺序" },
    { value: "az", label: "A-Z" },
    { value: "za", label: "Z-A" },
    { value: "random", label: "随机打乱" },
  ];

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">加载中...</div>
    );
  }

  if (allLearningWords.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-purple-700">学习新单词</h1>
        <div className="text-center py-12 sm:py-16">
          <BookOpen size={48} strokeWidth={1.2} className="mx-auto mb-3 sm:mb-4 text-purple-400" />
          <p className="text-base sm:text-xl text-gray-600 font-medium">没有待学习的单词</p>
          <p className="text-gray-400 mt-2 text-sm">去「单词本」导入内置词汇表开始学习吧</p>
          <button
            onClick={() => navigate("/words")}
            className="mt-4 px-5 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors text-sm"
          >
            去单词本
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-purple-700 mb-2 sm:mb-3">
          学习新单词
        </h1>
        {availableGroups.length > 0 && (
          <div className="flex gap-1.5 sm:gap-2 flex-wrap mb-2 sm:mb-3">
            <button
              onClick={() => changeGroup("全部")}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                groupFilter === "全部"
                  ? "bg-purple-500/80 backdrop-blur-sm text-white"
                  : "bg-white/50 backdrop-blur-sm text-purple-600 border border-white/40 hover:bg-white/70"
              }`}
            >
              全部<span className="ml-1 opacity-70">({allLearningWords.length})</span>
            </button>
            {availableGroups.map((group) => {
              const count = allLearningWords.filter(
                (w) => wordGroupMap.get(w) === group || (group === "未分组" && !wordGroupMap.has(w))
              ).length;
              return (
                <button
                  key={group}
                  onClick={() => changeGroup(group)}
                  className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                    groupFilter === group
                      ? "bg-purple-500/80 backdrop-blur-sm text-white"
                      : "bg-white/50 backdrop-blur-sm text-purple-600 border border-white/40 hover:bg-white/70"
                  }`}
                >
                  {group}<span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => applySort(opt.value)}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                sortMode === opt.value
                  ? "bg-purple-500/80 backdrop-blur-sm text-white"
                  : "bg-white/50 backdrop-blur-sm text-purple-600 border border-white/40 hover:bg-white/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {words.length === 0 ? (
        <div className="text-center py-12 sm:py-16">
          <p className="text-base sm:text-xl text-gray-600 font-medium">
            当前分组没有待学习的单词
          </p>
          <button
            onClick={() => changeGroup("全部")}
            className="mt-4 px-5 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors text-sm"
          >
            查看全部
          </button>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="w-full max-w-xs mx-auto">
            <div className="h-1.5 rounded-full bg-white/40 backdrop-blur-sm overflow-hidden border border-white/50">
              <div
                className="h-full rounded-full bg-green-400/60 transition-all duration-500 ease-out"
                style={{ width: `${((originalWords.length - words.length) / Math.max(originalWords.length, 1)) * 100}%` }}
              />
            </div>
            <p className="text-center text-gray-400 text-xs mt-1.5">
              还剩 {words.length} 个单词待学习
            </p>
          </div>

          {loadingWord || !wordData ? (
            <div className="text-center text-gray-400 py-16 sm:py-20 text-sm">
              加载单词中...
            </div>
          ) : (
            <div style={{ perspective: "1000px" }}>
              <div
                onMouseMove={tiltCard}
                onMouseLeave={tiltReset}
                className="transition-[transform,box-shadow] duration-200 ease-linear"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div
                  ref={cardRef}
                  key={wordData.word}
                  className="glass-raised rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4"
                  style={{ transform: "translateZ(20px)" }}
                >
                  <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-purple-700 mb-1 sm:mb-2">
                      {wordData.word}
                    </h2>
                {wordData.phonetic && (
                  <p className="text-gray-500 text-base sm:text-lg">{wordData.phonetic}</p>
                )}
              </div>

              {wordData.audio && (
                <div className="flex justify-center">
                  <audio key={wordData.word} controls className="h-8">
                    <source src={wordData.audio} type="audio/mpeg" />
                  </audio>
                </div>
              )}

              {wordData.meanings.map((m, i) => (
                <div key={i}>
                  <span className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                    {m.partOfSpeech}
                  </span>
                  <ul className="space-y-1 sm:space-y-1.5">
                    {m.definitions.slice(0, 3).map((d, j) => (
                      <li key={j} className="text-gray-700 text-xs sm:text-sm">
                        <span className="font-medium text-purple-600">{j + 1}.</span>{" "}
                        <ClickableText text={d.definition} />
                        {cnTranslations[d.definition] && (
                          <span className="text-gray-400 ml-1">{cnTranslations[d.definition]}</span>
                        )}
                        {d.example && (
                          <span className="text-gray-400 block ml-4 mt-0.5 italic text-xs">
                            "<ClickableText text={d.example} />"
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {m.synonyms.length > 0 && (
                    <p className="text-xs sm:text-sm mt-1.5 sm:mt-2">
                      <span className="text-gray-500">近义词：</span>
                      <span className="text-purple-600">
                        {m.synonyms.slice(0, 8).map((s, i) => (
                          <span key={s}>
                            {i > 0 && "、"}
                            <ClickableText text={s} />
                          </span>
                        ))}
                      </span>
                    </p>
                  )}
                </div>
              ))}

              {examples.length > 0 && (
                <div className="bg-blue-50/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-blue-100/50">
                  <p className="text-xs sm:text-sm font-medium text-blue-700 mb-2">例句</p>
                  <ul className="space-y-2">
                    {examples.slice(0, 4).map((ex, i) => (
                      <li key={i} className="text-xs sm:text-sm">
                        <p className="text-gray-800 italic">"<ClickableText text={ex.english} />"</p>
                        {ex.chinese && (
                          <p className="text-blue-600 mt-0.5 ml-2">{ex.chinese}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-center pt-2 sm:pt-4">
                <button
                  onClick={handleLearned}
                  className="px-6 sm:px-8 py-2.5 sm:py-3 bg-green-400/70 backdrop-blur-sm hover:bg-green-400/85 text-white rounded-xl font-medium text-base sm:text-lg transition-all border border-white/30 inline-flex items-center gap-2"
                >
                  <Check size={20} strokeWidth={2} />
                  我学会了
                </button>
              </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
