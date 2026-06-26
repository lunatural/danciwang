import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "react-router-dom";
import { getReviewSchedule, getWords, updateReviewSchedule } from "../hooks/useData";
import { incrementDailyCount } from "../utils/dailyActivity";
import { fetchWord, fetchExampleSentences, translateToChinese, type WordData, type ExampleSentence } from "../utils/api";
import { searchLocalDict, searchCambridgeDict } from "../utils/localDict";
import { mergeWordData } from "../utils/wordDataMerge";
import { calculateNextReview } from "../utils/sm2";
import FlashCard from "../components/FlashCard";
import RatingButtons from "../components/RatingButtons";
import QuizChoice from "../components/QuizChoice";
import QuizSpell from "../components/QuizSpell";
import ReviewResult from "../components/ReviewResult";
import ClickableText from "../components/ClickableText";
import { WordTooltip } from "../components/WordTooltip";
import { PartyPopper } from "lucide-react";

type QuizMode = "choice" | "spell" | "flashcard";

interface ReviewWord {
  scheduleId: string;
  word: string;
  data: WordData | null;
  examples: ExampleSentence[];
  mode: QuizMode;
}

export default function Review() {
  const { user } = useAuth();
  const [allDueWords, setAllDueWords] = useState<ReviewWord[]>([]);
  const [dueWords, setDueWords] = useState<ReviewWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [spellingEnabled, setSpellingEnabled] = useState(false);
  const [groupFilter, setGroupFilter] = useState("全部");
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [allScheduled, setAllScheduled] = useState<{ id: string; word: string; group: string; nextReviewAt: string; intervalDays: number; repetitions: number }[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [tooltip, setTooltip] = useState<{ word: string; anchor: DOMRect } | null>(null);
  const [loadingWord, setLoadingWord] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean } | null>(null);
  const [cnTranslation, setCnTranslation] = useState<string>("");
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

  // Auto-assign mode based on SM-2 data:
  //   - repetitions <= 1 or easeFactor < 2.0 → choice (unfamiliar)
  //   - easeFactor >= 2.5 && repetitions >= 3 → flashcard (familiar)
  //   - otherwise → choice (still learning)
  //   - if spelling enabled, randomly swap 20% to spell
  function assignMode(word: string): QuizMode {
    // Get SM-2 data for this word
    const schedule = getReviewSchedule(user?.id || "");
    const item = schedule.find((s) => s.word === word);

    let mode: QuizMode = "choice"; // default
    if (item) {
      if (item.easeFactor >= 2.5 && item.repetitions >= 3) {
        mode = "flashcard";
      }
      // else stays choice
    }

    // If spelling enabled, randomly make ~25% of questions spelling
    if (spellingEnabled && Math.random() < 0.25) {
      mode = "spell";
    }

    return mode;
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
        mode: assignMode(s.word),
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
  }, [user, spellingEnabled]);

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

    function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
      return Promise.race([
        p,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);
    }

    // 本地数据快速加载，外部 API 加 8 秒超时
    Promise.all([
      searchCambridgeDict(w),
      searchLocalDict(w),
      withTimeout(fetchWord(w), 8000),
      withTimeout(fetchExampleSentences(w), 8000),
    ]).then(async ([cambridge, local, data, exs]) => {
      clearTimeout(timeout);
      if (gen !== fetchGenRef.current) return;
      // Pre-cache Chinese translation for distractor use
      if (cambridge && !cnCache.current.has(w)) {
        if (local && local.translation) cnCache.current.set(w, local.translation);
      } else if (local && !cnCache.current.has(w)) {
        if (local.translation) cnCache.current.set(w, local.translation);
      } else if (data && !cnCache.current.has(w)) {
        const cn = await translateToChinese(data.meanings[0]?.definitions[0]?.definition || "");
        if (cn) cnCache.current.set(w, cn);
      }
      const merged = (cambridge || local || data)
        ? mergeWordData(w, local, data, exs || [], cambridge)
        : null;
      setDueWords((prev) => {
        if (idx >= prev.length) return prev;
        const u = [...prev];
        u[idx] = { ...u[idx], data: merged, examples: exs };
        return u;
      });
      setLoadingWord(false);
    }).catch(() => {
      clearTimeout(timeout);
      if (gen === fetchGenRef.current) setLoadingWord(false);
    });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [currentIndex, dueWords.length]);

  // Preload next word + cache translations for distractors
  useEffect(() => {
    if (dueWords.length === 0) return;

    // Preload next word data
    if (currentIndex + 1 < dueWords.length) {
      const next = dueWords[currentIndex + 1];
      if (!next.data) {
        function withTimeout2<T>(p: Promise<T>, ms: number): Promise<T | null> {
          return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
        }
        Promise.all([
          searchCambridgeDict(next.word),
          searchLocalDict(next.word),
          withTimeout2(fetchWord(next.word), 8000),
          withTimeout2(fetchExampleSentences(next.word), 8000),
        ]).then(async ([cambridge, local, data, exs]) => {
          if (cambridge && !cnCache.current.has(next.word)) {
            if (local && local.translation) cnCache.current.set(next.word, local.translation);
          } else if (local && !cnCache.current.has(next.word)) {
            if (local.translation) cnCache.current.set(next.word, local.translation);
          } else if (data && !cnCache.current.has(next.word)) {
            const cn = await translateToChinese(data.meanings[0]?.definitions[0]?.definition || "");
            if (cn) cnCache.current.set(next.word, cn);
          }
          const merged = (cambridge || local || data)
            ? mergeWordData(next.word, local, data, exs || [], cambridge)
            : null;
          setDueWords((prev) => {
            const idx = currentIndex + 1;
            if (idx >= prev.length) return prev;
            const u = [...prev];
            u[idx] = { ...u[idx], data: merged, examples: exs || [] };
            return u;
          });
        }).catch(() => {});
      }
    }

    // Also cache translations for 5 nearby words to use as distractors
    const unCached = dueWords
      .filter((w, i) => i !== currentIndex && !cnCache.current.has(w.word))
      .slice(0, 5);
    for (const w of unCached) {
      // Try local dictionary first (free, no API call)
      searchLocalDict(w.word).then((local) => {
        if (local?.translation) {
          cnCache.current.set(w.word, local.translation);
          return;
        }
        // Fallback to API translation
        fetchWord(w.word).then(async (data) => {
          if (data) {
            const cn = await translateToChinese(data.meanings[0]?.definitions[0]?.definition || "");
            if (cn) cnCache.current.set(w.word, cn);
          }
        });
      }).catch(() => {});
    }
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
    // 翻牌模式：评分后显示详情卡片，带滑动手势
    setLastResult({ correct: rating === "good" });
    setShowDetail(true);
    // 加载中文翻译
    if (current.data) {
      const def = current.data.meanings[0]?.definitions[0]?.definition || "";
      if (def) {
        translateToChinese(def).then((cn) => { if (cn) setCnTranslation(cn); });
      }
    }
  };

  const handleQuizResult = (correct: boolean) => {
    if (!user) return;
    const current = dueWords[currentIndex];
    if (!current) return;
    const schedule = getReviewSchedule(user.id);
    const item = schedule.find((s) => s.id === current.scheduleId);
    if (!item) return;

    const rating = correct ? "good" : (current.mode === "spell" ? "hard" : "forgot");
    const updated = calculateNextReview(item, rating);
    updateReviewSchedule(user.id, current.scheduleId, updated);
    incrementDailyCount(user.id, "reviewedCount");

    resultsRef.current.push({ word: current.word, correct });
    // 不再调用 advanceWord()——QuizChoice/QuizSpell 通过 onNext/onPrev 控制跳转
  };

  // 用 ref 存最新值，避免传给子组件的回调有闭包过时问题
  const idxRef = useRef(currentIndex);
  idxRef.current = currentIndex;
  const dueLenRef = useRef(dueWords.length);
  dueLenRef.current = dueWords.length;

  const advanceWord = useCallback(() => {
    setFlipped(false);
    setShowDetail(false);
    setLastResult(null);
    setCnTranslation("");
    const i = idxRef.current;
    if (i < dueLenRef.current - 1) {
      setCurrentIndex(i + 1);
    } else {
      setCompleted(true);
    }
  }, []);

  const goPrevWord = useCallback(() => {
    const i = idxRef.current;
    if (i > 0) {
      setShowDetail(false);
      setLastResult(null);
      setCnTranslation("");
      setCurrentIndex(i - 1);
    }
  }, []);

  // 滑动手势（触摸 + 鼠标，带视觉反馈）
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const detailCardRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (clientX: number, clientY: number) => {
    dragStartRef.current = { x: clientX, y: clientY };
    setIsDragging(true);
  };

  const handleDragMove = (clientX: number) => {
    if (!dragStartRef.current) return;
    const deltaX = clientX - dragStartRef.current.x;
    setDragOffset(deltaX);
  };

  const handleDragEnd = (clientX: number, clientY: number) => {
    if (!dragStartRef.current) return;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      deltaX < 0 ? advanceWord() : goPrevWord();
    }
    dragStartRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);

    const handleMouseMove = (ev: MouseEvent) => {
      handleDragMove(ev.clientX);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      handleDragEnd(ev.clientX, ev.clientY);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
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

  // Build smart distractor list — prefer confusable words
  const distractors = useMemo(() => {
    const current = dueWords.length > 0 ? dueWords[currentIndex] : undefined;
    if (!current || current.mode !== "choice") return [] as { word: string; translation: string }[];
    const targetWord = current.word.toLowerCase();
    const targetPos = current.data?.meanings?.[0]?.partOfSpeech || "";
    const targetPrefix2 = targetWord.slice(0, 2);
    const targetPrefix1 = targetWord[0];

    // Pre-compute synonym set for the target word
    const targetSynonymSet = new Set<string>();
    if (current.data) {
      for (const m of current.data.meanings) {
        for (const s of m.synonyms || []) {
          targetSynonymSet.add(s.toLowerCase());
        }
      }
    }

    // 判断是否为有效的中文释义（不是英文、不是脏数据）
    const isValidChinese = (text: string): boolean => {
      if (!text) return false;
      // 必须包含中文
      if (!/[一-鿿]/.test(text)) return false;
      // 至少 2 个中文字符
      const chineseChars = text.match(/[一-鿿]/g) || [];
      if (chineseChars.length < 2) return false;
      // 过滤词典格式碎片
      const badPatterns = /也作|缩写|英式|美式|复数|过去式|比较级|最高级|现在分词|过去分词|第三人称/;
      if (badPatterns.test(text)) return false;
      return true;
    };

    // Score each candidate by confusability
    const scored: { word: string; translation: string; score: number }[] = [];
    for (const w of dueWords) {
      if (w.word === current.word) continue;
      const cn = cnCache.current.get(w.word);
      // 只使用有效的中文翻译，不回退到英文
      const translation = cn || "";
      if (!isValidChinese(translation)) continue;

      const wl = w.word.toLowerCase();
      let score = 0;

      // Synonyms = best distractors
      if (targetSynonymSet.has(wl)) {
        score += 10;
      } else {
        // Check reverse synonym
        if (w.data) {
          for (const m of w.data.meanings) {
            for (const s of m.synonyms || []) {
              if (s.toLowerCase() === targetWord) { score += 10; break; }
            }
            if (score >= 10) break;
          }
        }
        // Same first 2 letters
        if (wl.slice(0, 2) === targetPrefix2) score += 5;
        else if (wl[0] === targetPrefix1) score += 3;
      }
      // Same part of speech
      if (targetPos && w.data?.meanings?.[0]?.partOfSpeech === targetPos) score += 2;
      // Similar length
      if (Math.abs(wl.length - targetWord.length) <= 2) score += 1;

      scored.push({ word: w.word, translation, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
  }, [currentIndex, dueWords]);

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
          {/* Spelling toggle */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setSpellingEnabled(!spellingEnabled)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                spellingEnabled
                  ? "bg-blue-500/80 text-white border-blue-400"
                  : "bg-white/40 text-gray-400 border-gray-200 hover:border-blue-300"
              }`}
            >
              拼写模式 {spellingEnabled ? "开" : "关"}
            </button>
            <span className="text-[10px] text-gray-400">
              自动根据熟悉度选择 · 选择 · 熟悉
            </span>
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
                  <span className="inline-flex items-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      current?.mode === "flashcard" ? "bg-green-100 text-green-600" :
                      current?.mode === "spell" ? "bg-blue-100 text-blue-600" :
                      "bg-purple-100 text-purple-600"
                    }`}>
                      {current?.mode === "flashcard" ? "熟悉" : current?.mode === "spell" ? "拼写" : "选择"}
                    </span>
                  </span>
                  <span>今日剩余 {dueWords.length - currentIndex} 个</span>
                </div>
              </div>

              {loadingWord ? (
                <div className="text-center text-gray-400 py-16 sm:py-20 text-sm">加载单词中...</div>
              ) : current?.data ? (
                /* ── 翻牌模式：评分后显示详情卡片（带滑动手势） ── */
                (showDetail && current.mode === "flashcard") ? (
                  <div
                    ref={detailCardRef}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleMouseDown}
                    className="glass-raised rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 relative select-none cursor-grab active:cursor-grabbing"
                    style={{
                      transform: `translateX(${dragOffset}px)`,
                      opacity: isDragging ? 0.85 : 1,
                      transition: isDragging ? "none" : "transform 0.3s ease, opacity 0.3s ease",
                    }}
                  >
                    {/* 评分结果 */}
                    {lastResult && (
                      <div className={`text-center text-sm font-medium py-1 rounded-lg ${lastResult.correct ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                        {lastResult.correct ? "✅ 已掌握" : "📝 需要复习"}
                      </div>
                    )}

                    <div className="text-center">
                      <h2 className="text-2xl sm:text-3xl font-bold text-purple-700 mb-1">{current.data.word}</h2>
                      {current.data.phonetic && (
                        <p className="text-gray-500 text-sm sm:text-base">{current.data.phonetic}</p>
                      )}
                    </div>

                    {current.data.audio && (
                      <div className="flex justify-center">
                        <audio key={current.data.word} controls className="h-8">
                          <source src={current.data.audio} type="audio/mpeg" />
                        </audio>
                      </div>
                    )}

                    {current.data.meanings.map((m, i) => (
                      <div key={i}>
                        <span className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs sm:text-sm font-medium mb-1.5">{m.partOfSpeech}</span>
                        <ul className="space-y-1 sm:space-y-1.5">
                          {(m.definitions || []).slice(0, 3).map((d, j) => (
                            <li key={j} className="text-gray-700 text-xs sm:text-sm">
                              <span className="font-medium text-purple-600">{j + 1}.</span> <ClickableText text={d.definition} />
                              {cnTranslation && j === 0 && <span className="text-gray-800 ml-1">{cnTranslation}</span>}
                              {d.example && <span className="text-gray-400 block ml-4 mt-0.5 italic text-xs">"<ClickableText text={d.example} />"</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {current.examples.length > 0 && (
                      <div className="bg-blue-50/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-blue-100/50">
                        <p className="text-xs sm:text-sm font-medium text-blue-700 mb-2">例句</p>
                        <ul className="space-y-2">
                          {current.examples.slice(0, 3).map((ex, i) => (
                            <li key={i} className="text-xs sm:text-sm">
                              <p className="text-gray-800 italic">"<ClickableText text={ex.english} />"</p>
                              {ex.chinese && <p className="text-blue-600 mt-0.5 ml-2">{ex.chinese}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 text-xs text-gray-400">
                      <span>← 右滑上一题</span>
                      <span>左滑下一题 →</span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button onClick={goPrevWord} disabled={currentIndex <= 0}
                        className="flex-1 px-4 py-2 bg-gray-200/60 hover:bg-gray-200/80 disabled:opacity-40 rounded-xl text-sm text-gray-600 transition-all">
                        ← 上一题
                      </button>
                      <button onClick={advanceWord}
                        className="flex-1 px-4 py-2 bg-purple-500/80 hover:bg-purple-500/90 text-white rounded-xl text-sm transition-all">
                        下一题 →
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── 答题视图 ── */
                  <>
                    {current.mode === "choice" && (
                      <QuizChoice
                        key={current.word + currentIndex}
                        data={current.data}
                        examples={current.examples}
                        distractors={distractors}
                        onResult={handleQuizResult}
                        onNext={advanceWord}
                        onPrev={goPrevWord}
                        localTranslation={cnCache.current.get(current.word)}
                      />
                    )}
                    {current.mode === "spell" && (
                      <QuizSpell
                        key={current.word + currentIndex}
                        data={current.data}
                        examples={current.examples}
                        onResult={handleQuizResult}
                        onNext={advanceWord}
                        onPrev={goPrevWord}
                        localTranslation={cnCache.current.get(current.word)}
                      />
                    )}
                    {current.mode === "flashcard" && (
                      <div key={current.word + currentIndex} style={{ perspective: "1000px" }}>
                        <FlashCard
                          data={current.data}
                          flipped={flipped}
                          onClick={() => setFlipped(!flipped)}
                          examples={current.examples}
                          localTranslation={cnCache.current.get(current.word)}
                        />
                        {flipped && <RatingButtons onRate={handleRate} />}
                      </div>
                    )}
                  </>
                )
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
