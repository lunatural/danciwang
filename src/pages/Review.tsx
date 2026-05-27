import { useEffect, useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "react-router-dom";
import { getReviewSchedule, getWords, updateReviewSchedule } from "../hooks/useData";
import { incrementDailyCount } from "../utils/dailyActivity";
import { fetchWord, fetchExampleSentences, type WordData, type ExampleSentence } from "../utils/api";
import { calculateNextReview } from "../utils/sm2";
import FlashCard from "../components/FlashCard";
import RatingButtons from "../components/RatingButtons";
import { WordTooltip } from "../components/WordTooltip";
import { PartyPopper } from "lucide-react";

interface ReviewWord {
  scheduleId: string;
  word: string;
  data: WordData | null;
  examples: ExampleSentence[];
}

export default function Review() {
  const { user } = useAuth();
  const [allDueWords, setAllDueWords] = useState<ReviewWord[]>([]);
  const [dueWords, setDueWords] = useState<ReviewWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingWord, setLoadingWord] = useState(false);
  const [groupFilter, setGroupFilter] = useState("全部");
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [allScheduled, setAllScheduled] = useState<{ id: string; word: string; group: string; nextReviewAt: string; intervalDays: number; repetitions: number }[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [tooltip, setTooltip] = useState<{ word: string; anchor: DOMRect } | null>(null);
  const location = useLocation();
  const navigateFrom = location.pathname + location.search;

  // Track fetch generation to cancel stale requests
  const fetchGenRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!user) return;
    const schedule = getReviewSchedule(user.id);
    const now = new Date().toISOString();
    const due = schedule.filter((s) => s.nextReviewAt <= now);
    const reviewWords = due.map((s) => ({ scheduleId: s.id, word: s.word, data: null, examples: [] as ExampleSentence[] }));
    setAllDueWords(reviewWords);

    const groups = new Set<string>();
    for (const w of reviewWords) {
      groups.add(wordGroupMap.get(w.word) || "未分组");
    }
    setAvailableGroups(Array.from(groups).sort());

    const filtered = filterByGroup(reviewWords, groupFilter);
    setDueWords(filtered);

    // All scheduled words (including future ones) for review history
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
  }, [user]);

  const changeGroup = (group: string) => {
    setGroupFilter(group);
    const filtered = filterByGroup(allDueWords, group);
    setDueWords(filtered);
    setCurrentIndex(0);
    setFlipped(false);
    setLoadingWord(false);
    fetchGenRef.current += 1;
  };

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

  // Load word data for current index
  useEffect(() => {
    if (dueWords.length === 0 || currentIndex >= dueWords.length) {
      setLoadingWord(false);
      return;
    }
    const word = dueWords[currentIndex];
    if (word.data) return;

    setFlipped(false);
    setLoadingWord(true);

    const gen = ++fetchGenRef.current;
    const idx = currentIndex;
    Promise.all([
      fetchWord(word.word),
      fetchExampleSentences(word.word),
    ]).then(([data, exs]) => {
      if (gen !== fetchGenRef.current) return;
      setDueWords((prev) => {
        if (idx >= prev.length) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], data, examples: exs };
        return updated;
      });
      setLoadingWord(false);
    }).catch(() => {
      if (gen === fetchGenRef.current) setLoadingWord(false);
    });
  }, [currentIndex, dueWords.length]);

  const handleRate = (rating: "forgot" | "hard" | "good") => {
    if (!user) return;
    const current = dueWords[currentIndex];
    const schedule = getReviewSchedule(user.id);
    const item = schedule.find((s) => s.id === current.scheduleId);
    if (!item) return;

    const updated = calculateNextReview(item, rating);
    updateReviewSchedule(user.id, current.scheduleId, updated);
    incrementDailyCount(user.id, "reviewedCount");

    // Update allScheduled for the rated word
    const nextDate = updated.nextReviewAt || new Date(Date.now() + (updated.intervalDays || 1) * 86400000).toISOString();
    setAllScheduled((prev) => {
      const mapped = prev.map((s) =>
        s.id === current.scheduleId
          ? { ...s, nextReviewAt: nextDate, intervalDays: updated.intervalDays || 1, repetitions: updated.repetitions || (item.repetitions + 1) }
          : s
      );
      mapped.sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime());
      return mapped;
    });

    setFlipped(false);
    if (currentIndex < dueWords.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setDueWords([]);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">加载中...</div>
    );
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
              <p className="text-base sm:text-xl text-gray-600 font-medium">
                当前分组没有需要复习的单词
              </p>
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
                <p className="text-center text-gray-400 text-xs mt-1.5">
                  今日剩余 {dueWords.length - currentIndex} 个单词待复习
                </p>
              </div>

              {loadingWord || !current?.data ? (
                <div className="text-center text-gray-400 py-16 sm:py-20 text-sm">
                  加载单词中...
                </div>
              ) : (
                <div key={current.word} style={{ perspective: "1000px" }}>
                  <div
                    onMouseMove={tiltCard}
                    onMouseLeave={tiltReset}
                    className="transition-[transform] duration-200 ease-linear"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <FlashCard
                      data={current.data}
                      flipped={flipped}
                      onClick={() => setFlipped(!flipped)}
                      examples={current.examples}
                    />
                    {flipped && <RatingButtons onRate={handleRate} />}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Review history — stacked cards */}
      {allScheduled.length > 0 && (
        <div className="glass rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-purple-700">
              复习记录
            </h2>
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
              const urgencyColor = text === "现在"
                ? "#ef4444"
                : text.endsWith("小时后")
                  ? "#f97316"
                  : text === "明天"
                    ? "#d97706"
                    : text.match(/^\d天后$/) && parseInt(text) <= 3
                      ? "#ca8a04"
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
                  {/* Left accent bar */}
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
                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                      {text}
                    </span>
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
                style={{
                  boxShadow: "0px 3px 3.5px rgba(119, 113, 113, 0.3)",
                }}
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
