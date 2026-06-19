import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSyncVersion } from "../App";
import { useLocation } from "react-router-dom";
import { getReviewSchedule, getWords, updateReviewSchedule } from "../hooks/useData";
import { incrementDailyCount } from "../utils/dailyActivity";
import { fetchWord, fetchExampleSentences, translateToChinese, type WordData, type ExampleSentence } from "../utils/api";
import { calculateNextReview } from "../utils/sm2";
import FlashCard from "../components/FlashCard";
import RatingButtons from "../components/RatingButtons";
import QuizChoice from "../components/QuizChoice";
import QuizSpell from "../components/QuizSpell";
import ReviewResult from "../components/ReviewResult";
import { WordTooltip } from "../components/WordTooltip";
import { PartyPopper } from "lucide-react";

type QuizMode = "choice" | "spell" | "flashcard";
type ReviewMode = "mixed" | QuizMode;

const modeLabels: Record<ReviewMode, string> = {
  mixed: "混合",
  choice: "选择",
  spell: "拼写",
  flashcard: "闪卡",
};

interface ReviewWord {
  scheduleId: string;
  word: string;
  data: WordData | null;
  examples: ExampleSentence[];
  mode: QuizMode;
}

export default function Review() {
  const { user } = useAuth();
  const syncVersion = useSyncVersion();
  const [allDueWords, setAllDueWords] = useState<ReviewWord[]>([]);
  const [dueWords, setDueWords] = useState<ReviewWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("mixed");
  const [groupFilter, setGroupFilter] = useState("全部");
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [allScheduled, setAllScheduled] = useState<{ id: string; word: string; group: string; nextReviewAt: string; intervalDays: number; repetitions: number }[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [tooltip, setTooltip] = useState<{ word: string; anchor: DOMRect } | null>(null);
  const [loadingWord, setLoadingWord] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const startTimeRef = useRef(Date.now());
  const resultsRef = useRef<{ word: string; correct: boolean }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dueWordsRef = useRef<ReviewWord[]>([]);
  dueWordsRef.current = dueWords;
  const fetchGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const location = useLocation();
  const navigateFrom = location.pathname + location.search;

  // Chinese translations cache for distractors
  const cnCache = useRef<Map<string, string>>(new Map());

  const wordGroupMap = new Map<string, string>();
  if (user) {
    for (const w of getWords(user.id)) {
      wordGroupMap.set(w.word, w.group);
    }
  }

  const filterByGroup = (ws: ReviewWord[], group: string): ReviewWord[] => {
    if (group === "全部") return ws;
    return ws.filter((w) => wordGroupMap.get(w.word) === group);
  };

  // Assign modes based on selection (mixed = rotation, otherwise all same)
  function assignMode(i: number): QuizMode {
    if (reviewMode !== "mixed") return reviewMode;
    const modes: QuizMode[] = ["choice", "spell", "flashcard"];
    return modes[i % 3];
  }

  useEffect(() => {
    if (!user) return;
    const schedule = getReviewSchedule(user.id);
    const now = new Date().toISOString();
    const due = schedule.filter((s) => s.nextReviewAt <= now);

    const oldDataMap = new Map(dueWordsRef.current.map((w) => [w.word, { data: w.data, examples: w.examples }]));
    const reviewWords = due.map((s, i) => {
      const old = oldDataMap.get(s.word);
      return {
        scheduleId: s.id,
        word: s.word,
        data: old?.data || null,
        examples: old?.examples || [],
        mode: assignMode(i),
      };
    });
    setAllDueWords(reviewWords);

    const groups = new Set<string>();
    for (const w of reviewWords) {
      groups.add(wordGroupMap.get(w.word) || "未分组");
    }
    setAvailableGroups(Array.from(groups).sort());

    const filtered = filterByGroup(reviewWords, groupFilter);
    setDueWords(filtered);

    const scheduled = schedule.map((s) => ({
      id: s.id,
      word: s.word,
      group: wordGroupMap.get(s.word) || "未分组",
      nextReviewAt: s.nextReviewAt,
      intervalDays: s.intervalDays,
      repetitions: s.repetitions,
    }));
    scheduled.sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime());
    setAllScheduled(scheduled);

    setLoading(false);
  }, [user, syncVersion, reviewMode]);

  const changeGroup = (group: string) => {
    setGroupFilter(group);
    const filtered = filterByGroup(allDueWords, group);
    setDueWords(filtered);
    setCurrentIndex(0);
    setFlipped(false);
    setLoadingWord(false);
    if (abortRef.current) abortRef.current.abort();
    fetchGenRef.current += 1;
  };

  // Load word data for current index
  useEffect(() => {
    if (dueWords.length === 0 || currentIndex >= dueWords.length) {
      setLoadingWord(false);
      return;
    }
    const word = dueWords[currentIndex];
    if (word.data) {
      setLoadingWord(false);
      return;
    }

    setLoadingWord(true);
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const gen = ++fetchGenRef.current;
    const idx = currentIndex;
    const w = word.word;

    const timeout = setTimeout(() => {
      if (gen === fetchGenRef.current) {
        setDueWords((prev) => {
          if (idx >= prev.length) return prev;
          const u = [...prev];
          u[idx] = { ...u[idx], data: null, examples: [] };
          return u;
        });
        setLoadingWord(false);
      }
    }, 20000);

    Promise.all([
      fetchWord(w),
      fetchExampleSentences(w),
    ]).then(async ([data, exs]) => {
      clearTimeout(timeout);
      if (gen !== fetchGenRef.current) return;
      // Pre-cache Chinese translation for distractor use
      if (data && !cnCache.current.has(w)) {
        const cn = await translateToChinese(data.meanings[0]?.definitions[0]?.definition || "");
        if (cn) cnCache.current.set(w, cn);
      }
      setDueWords((prev) => {
        if (idx >= prev.length) return prev;
        const u = [...prev];
        u[idx] = { ...u[idx], data, examples: exs };
        return u;
      });
      setLoadingWord(false);
    }).catch(() => {
      clearTimeout(timeout);
      if (gen === fetchGenRef.current) setLoadingWord(false);
    });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [currentIndex, dueWords.length]);

  // Preload next word data
  useEffect(() => {
    if (dueWords.length === 0 || currentIndex + 1 >= dueWords.length) return;
    const next = dueWords[currentIndex + 1];
    if (next.data) return;
    Promise.all([
      fetchWord(next.word),
      fetchExampleSentences(next.word),
    ]).then(async ([data, exs]) => {
      if (data && !cnCache.current.has(next.word)) {
        const cn = await translateToChinese(data.meanings[0]?.definitions[0]?.definition || "");
        if (cn) cnCache.current.set(next.word, cn);
      }
      setDueWords((prev) => {
        const idx = currentIndex + 1;
        if (idx >= prev.length) return prev;
        const u = [...prev];
        u[idx] = { ...u[idx], data, examples: exs };
        return u;
      });
    }).catch(() => {});
  }, [currentIndex, dueWords.length]);

  // Scroll to top when word index changes
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [currentIndex]);

  const handleRate = (rating: "forgot" | "hard" | "good") => {
    if (!user) return;
    const current = dueWords[currentIndex];
    const schedule = getReviewSchedule(user.id);
    const item = schedule.find((s) => s.id === current.scheduleId);
    if (!item) return;

    const updated = calculateNextReview(item, rating);
    updateReviewSchedule(user.id, current.scheduleId, updated);
    incrementDailyCount(user.id, "reviewedCount");

    resultsRef.current.push({ word: current.word, correct: rating === "good" });
    advanceWord();
  };

  const handleQuizResult = (correct: boolean) => {
    if (!user) return;
    const current = dueWords[currentIndex];
    const schedule = getReviewSchedule(user.id);
    const item = schedule.find((s) => s.id === current.scheduleId);
    if (!item) return;

    const rating = correct ? "good" : (current.mode === "spell" ? "hard" : "forgot");
    const updated = calculateNextReview(item, rating);
    updateReviewSchedule(user.id, current.scheduleId, updated);
    incrementDailyCount(user.id, "reviewedCount");

    resultsRef.current.push({ word: current.word, correct });
    advanceWord();
  };

  const advanceWord = () => {
    setFlipped(false);
    if (currentIndex < dueWords.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleRestart = () => {
    setCompleted(false);
    setCurrentIndex(0);
    setDueWords([]);
    setLoading(true);
    resultsRef.current = [];
    // Trigger reload via syncVersion dependency reset
    startTimeRef.current = Date.now();
    // Force reload
    const schedule = getReviewSchedule(user!.id);
    const now = new Date().toISOString();
    const due = schedule.filter((s) => s.nextReviewAt <= now);
    const reviewWords = due.map((s, i) => ({
      scheduleId: s.id,
      word: s.word,
      data: null as WordData | null,
      examples: [] as ExampleSentence[],
      mode: assignMode(i),
    }));
    setAllDueWords(reviewWords);
    const filtered = filterByGroup(reviewWords, groupFilter);
    setDueWords(filtered);
    setLoading(false);
  };

  // Build distractor list from other due words (MUST be before any early return for hook consistency)
  const distractors = useMemo(() => {
    const c = dueWords.length > 0 ? dueWords[currentIndex] : undefined;
    if (!c || c.mode !== "choice") return [];
    return dueWords
      .filter((w) => w.word !== c.word)
      .map((w) => cnCache.current.get(w.word) || "")
      .filter((c) => c.length > 0)
      .slice(0, 5);
  }, [currentIndex, dueWords.length]);

  if (loading) {
    return <div className="text-center text-gray-400 py-10 text-sm">加载中...</div>;
  }

  if (completed) {
    const total = resultsRef.current.length;
    const correct = resultsRef.current.filter((r) => r.correct).length;
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    return <ReviewResult total={total} correct={correct} duration={duration} onRestart={handleRestart} />;
  }

  const current = dueWords.length > 0 ? dueWords[currentIndex] : undefined;

  function renderDaysLabel(nextReviewAt: string) {
    const now = new Date();
    const diffMs = new Date(nextReviewAt).getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 0) return { text: "现在", color: "text-red-500 bg-red-50" };
    if (diffHours < 24) return { text: Math.ceil(diffHours) + "小时后", color: "text-orange-500 bg-orange-50" };
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return { text: "明天", color: "text-amber-600 bg-amber-50" };
    if (diffDays <= 3) return { text: diffDays + "天后", color: "text-yellow-600 bg-yellow-50" };
    if (diffDays <= 7) return { text: diffDays + "天后", color: "text-blue-500 bg-blue-50" };
    return { text: diffDays + "天后", color: "text-green-500 bg-green-50" };
  }

  return (
    <div ref={containerRef} className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-purple-700">复习</h1>

      {allDueWords.length === 0 ? (
        <div className="text-center py-12 sm:py-16">
          <PartyPopper size={48} strokeWidth={1.2} className="mx-auto mb-3 sm:mb-4 text-purple-400" />
          <p className="text-base sm:text-xl text-gray-600 font-medium">
            {allScheduled.length > 0 ? "今天没有需要复习的单词" : "还没有复习记录"}
          </p>
          <p className="text-gray-400 mt-2 text-sm">
            {allScheduled.length > 0 ? "看看下方的复习记录吧" : "去「查单词」页面添加新单词吧"}
          </p>
        </div>
      ) : (
        <>
          {/* Mode switcher */}
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            {(Object.keys(modeLabels) as ReviewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setReviewMode(mode)}
                className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  reviewMode === mode
                    ? "bg-purple-500/80 backdrop-blur-sm text-white"
                    : "bg-white/50 backdrop-blur-sm text-purple-600 border border-white/40 hover:bg-white/70"
                }`}
              >
                {modeLabels[mode]}
              </button>
            ))}
          </div>

          {availableGroups.length > 0 && (
            <div className="flex gap-1.5 sm:gap-2 flex-wrap">
              <button
                onClick={() => changeGroup("全部")}
                className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  groupFilter === "全部"
                    ? "bg-purple-500/80 backdrop-blur-sm text-white"
                    : "bg-white/50 backdrop-blur-sm text-purple-600 border border-white/40 hover:bg-white/70"
                }`}
              >
                全部<span className="ml-1 opacity-70">({allDueWords.length})</span>
              </button>
              {availableGroups.map((group) => {
                const count = allDueWords.filter(
                  (w) => wordGroupMap.get(w.word) === group ||
                    (group === "未分组" && !wordGroupMap.has(w.word))
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

          {dueWords.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <p className="text-base sm:text-xl text-gray-600 font-medium">当前分组没有需要复习的单词</p>
              <button
                onClick={() => changeGroup("全部")}
                className="mt-4 px-5 py-2 bg-purple-500/80 backdrop-blur-sm text-white rounded-xl hover:bg-purple-500/90 transition-all text-sm border border-white/30"
              >
                查看全部
              </button>
            </div>
          ) : (
            <>
              <div className="w-full max-w-xs mx-auto">
                <div className="h-1.5 rounded-full bg-white/40 backdrop-blur-sm overflow-hidden border border-white/50">
                  <div
                    className="h-full rounded-full bg-purple-400/60 transition-all duration-500 ease-out"
                    style={{ width: `${(currentIndex / Math.max(dueWords.length, 1)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                  <span>
                    {current?.mode === "choice" ? "选择题" : current?.mode === "spell" ? "拼写题" : "闪卡"}
                  </span>
                  <span>今日剩余 {dueWords.length - currentIndex} 个</span>
                </div>
              </div>

              {loadingWord ? (
                <div className="text-center text-gray-400 py-16 sm:py-20 text-sm">加载单词中...</div>
              ) : current?.data ? (
                <>
                  {current.mode === "choice" && (
                    <QuizChoice
                      key={current.word + currentIndex}
                      data={current.data}
                      distractors={distractors}
                      onResult={handleQuizResult}
                    />
                  )}
                  {current.mode === "spell" && (
                    <QuizSpell
                      key={current.word + currentIndex}
                      data={current.data}
                      examples={current.examples}
                      onResult={handleQuizResult}
                    />
                  )}
                  {current.mode === "flashcard" && (
                    <div key={current.word + currentIndex} style={{ perspective: "1000px" }}>
                      <FlashCard
                        data={current.data}
                        flipped={flipped}
                        onClick={() => setFlipped(!flipped)}
                        examples={current.examples}
                      />
                      {flipped && <RatingButtons onRate={handleRate} />}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-400 py-16 sm:py-20 text-sm">加载单词中...</div>
              )}
            </>
          )}
        </>
      )}

      {/* Review history */}
      {allScheduled.length > 0 && (
        <div className="glass rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-purple-700">复习记录</h2>
            <span className="text-xs text-gray-400 bg-white/50 px-2 py-0.5 rounded-full">
              {allScheduled.length} 个单词
            </span>
          </div>

          <div
            className="relative overflow-hidden"
            style={{
              maxHeight: historyExpanded ? "5000px" : "200px",
              transition: "max-height 0.45s cubic-bezier(0.68, -0.55, 0.27, 1.55)",
            }}
          >
            {allScheduled.map((item, i) => {
              const { text, color } = renderDaysLabel(item.nextReviewAt);
              const urgencyColor = text === "现在" ? "#ef4444"
                : text.endsWith("小时后") ? "#f97316"
                : text === "明天" ? "#d97706"
                : text.match(/^\d天后$/) && parseInt(text) <= 3 ? "#ca8a04"
                : "#22c55e";

              let stackStyle: React.CSSProperties = {};
              if (!historyExpanded) {
                if (allScheduled.length <= 3) {
                  stackStyle = {};
                } else if (i < allScheduled.length - 3) {
                  stackStyle = { position: "absolute", opacity: 0, pointerEvents: "none" };
                } else {
                  const relIdx = i - (allScheduled.length - 3);
                  const offsets = ["translateY(150%) scale(0.88)", "translateY(75%) scale(0.93)", "translateY(0) scale(0.96)"];
                  const zIndices = [0, 1, 2];
                  stackStyle = {
                    position: "relative",
                    transform: offsets[relIdx],
                    zIndex: zIndices[relIdx],
                    opacity: 1,
                  };
                }
              }

              return (
                <div
                  key={item.id}
                  className="relative rounded-2xl bg-white border border-gray-100 flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm"
                  style={{
                    marginBottom: historyExpanded ? "8px" : "0px",
                    transition: "all 0.35s cubic-bezier(0.68, -0.55, 0.27, 1.55)",
                    ...stackStyle,
                  }}
                >
                  <span
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
                    style={{ backgroundColor: urgencyColor }}
                  />
                  <div className="flex items-center gap-2.5 min-w-0 ml-1">
                    <span
                      className="text-sm font-medium text-purple-600 hover:text-purple-800 hover:underline underline-offset-2 transition-colors cursor-pointer truncate"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTooltip({ word: item.word, anchor: (e.target as HTMLElement).getBoundingClientRect() });
                      }}
                    >
                      {item.word}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{item.group}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
                    <span className="text-[10px] sm:text-xs text-gray-400">
                      {new Date(item.nextReviewAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                    </span>
                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{text}</span>
                    <span className="text-[10px] text-gray-300 hidden sm:inline">
                      间隔{item.intervalDays}天·第{item.repetitions}次
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {allScheduled.length > 3 && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setHistoryExpanded(!historyExpanded)}
                className="relative px-8 py-2 bg-white rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm font-semibold text-gray-600 border-0 cursor-pointer"
                style={{ boxShadow: "0px 3px 3.5px rgba(119, 113, 113, 0.3)" }}
              >
                {historyExpanded ? "收起" : "展开全部"}
                <span
                  className="absolute border-t-2 border-l-2 border-gray-500 w-2 h-2 right-5 top-[13px] transition-all duration-300"
                  style={{
                    transform: historyExpanded ? "rotate(45deg)" : "rotate(225deg)",
                    top: historyExpanded ? "17px" : "13px",
                  }}
                />
              </button>
            </div>
          )}
        </div>
      )}

      {tooltip && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTooltip(null)} />
          <WordTooltip
            word={tooltip.word}
            anchor={tooltip.anchor}
            onClose={() => setTooltip(null)}
            navigateFrom={navigateFrom}
          />
        </>
      )}
    </div>
  );
}
