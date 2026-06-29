import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSyncVersion } from "../App";
import { getWords, getLearningWords, getReviewSchedule } from "../hooks/useData";
import { getTodayActivity, getDailyHistory } from "../utils/dailyActivity";
import ShareButton from "../components/ShareButton";
import { BookOpen, Search, RefreshCw, BarChart3, TrendingUp, ChevronDown } from "lucide-react";
import gsap from "gsap";

function AnimatedNumber({ target, duration = 1.2 }: { target: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = Math.floor(obj.val).toString();
        }
      },
    });
  }, [target, duration]);

  return <span ref={ref}>0</span>;
}

export default function Home() {
  const { user } = useAuth();
  const syncVersion = useSyncVersion();
  const [wordCount, setWordCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [todayStats, setTodayStats] = useState({ learnedCount: 0, reviewedCount: 0 });
  const [history, setHistory] = useState<{ date: string; learnedCount: number; reviewedCount: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAnimated, setShowAnimated] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 640);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const tz = (v: number) => isDesktop ? `${v}px` : "0px";

  useEffect(() => {
    if (!user) return;
    setWordCount(getWords(user.id).length);
    setLearningCount(getLearningWords(user.id).length);
    const schedule = getReviewSchedule(user.id);
    const now = new Date().toISOString();
    setDueCount(schedule.filter((s) => s.nextReviewAt <= now).length);
    const activity = getTodayActivity(user.id);
    setTodayStats({ learnedCount: activity.learnedCount, reviewedCount: activity.reviewedCount });
    setHistory(getDailyHistory(user.id).reverse());
    setShowAnimated(true);
  }, [user, syncVersion]);

  useEffect(() => {
    if (!containerRef.current || !showAnimated) return;
    const cards = containerRef.current.querySelectorAll(".home-card");
    gsap.from(cards, {
      opacity: 0,
      y: 30,
      stagger: 0.08,
      duration: 0.5,
      ease: "power3.out",
    });
  }, [showAnimated]);

  const tiltCard = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 20;
    const y = (e.clientY - top - height / 2) / 20;
    el.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  };

  const tiltReset = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.transform = "rotateY(0deg) rotateX(0deg)";
  };

  const statCards = [
    { path: "/words", icon: BookOpen, iconClass: "text-indigo-300", label: "单词本", count: wordCount, sub: "个单词", from: "#818cf8", end: "#4F46E5" },
    { path: "/learn", icon: BarChart3, iconClass: "text-blue-300", label: "待学习", count: learningCount, sub: "个新单词", from: "#60a5fa", end: "#2563eb" },
    { path: "/review", icon: RefreshCw, iconClass: "text-amber-300", label: "待复习", count: dueCount, sub: "个单词", from: "#fb923c", end: "#ea580c" },
  ];

  const actionBtns = [
    { path: "/search", icon: Search, label: "查单词", from: "#a78bfa", end: "#7c3aed" },
    { path: "/learn", icon: BookOpen, label: "学习新词", from: "#60a5fa", end: "#2563eb" },
    { path: "/review", icon: RefreshCw, label: "开始复习", from: "#c084fc", end: "#9333ea" },
  ];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === today.toISOString().slice(0, 10)) return "今天";
    if (dateStr === yesterday.toISOString().slice(0, 10)) return "昨天";
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const getWeekday = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
  };

  const todayTotal = todayStats.learnedCount + todayStats.reviewedCount;

  return (
    <div ref={containerRef} className="space-y-3 sm:space-y-8 relative z-10" style={{ paddingBottom: "max(80px, calc(60px + env(safe-area-inset-bottom)))" }}>
      <h1 className="text-sm sm:text-2xl font-bold text-purple-700">
        你好，{user?.email || ""}
      </h1>

      {/* Stats cards */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-5">
        {statCards.map((card, i) => (
          <div key={i} className="flex-1" style={{ perspective: isDesktop ? "1000px" : "none" }}>
            <Link
              to={card.path}
              onMouseMove={tiltCard}
              onMouseLeave={tiltReset}
              className="home-card group relative block h-24 sm:h-72 rounded-2xl overflow-hidden transition-[transform,box-shadow] duration-200 ease-linear"
              style={{ transformStyle: isDesktop ? "preserve-3d" : "flat" }}
            >
              <span
                className="absolute top-0 left-[25px] sm:left-[45px] w-[60%] h-full rounded-2xl transition-all duration-500 ease-out group-hover:opacity-0"
                style={{
                  background: `linear-gradient(315deg, ${card.from}, ${card.end})`,
                  transform: "skewX(8deg)",
                }}
              />
              <span
                className="absolute top-0 left-[15px] w-[calc(100%-60px)] h-full rounded-2xl opacity-0 transition-all duration-500 ease-out group-hover:opacity-100"
                style={{
                  background: `linear-gradient(315deg, ${card.from}, ${card.end})`,
                  transform: "skewX(0deg)",
                }}
              />
              <span
                className="absolute top-0 left-[25px] sm:left-[45px] w-[60%] h-full rounded-2xl opacity-30 blur-[26px] sm:blur-[32px] transition-all duration-500 ease-out pointer-events-none group-hover:opacity-0"
                style={{
                  background: `linear-gradient(315deg, ${card.from}, ${card.end})`,
                  transform: "skewX(8deg)",
                }}
              />
              <span
                className="absolute top-0 left-[15px] w-[calc(100%-60px)] h-full rounded-2xl opacity-0 blur-[26px] sm:blur-[32px] transition-all duration-500 ease-out pointer-events-none group-hover:opacity-30"
                style={{
                  background: `linear-gradient(315deg, ${card.from}, ${card.end})`,
                  transform: "skewX(0deg)",
                }}
              />
              <span className="pointer-events-none absolute inset-0 z-10 overflow-visible">
                <span className="absolute top-0 left-0 w-0 h-0 rounded-2xl opacity-0 bg-white/10 backdrop-blur-sm transition-all duration-500 ease-out animate-blob group-hover:top-[-30px] group-hover:left-[30px] group-hover:w-[60px] group-hover:h-[60px] group-hover:opacity-100" />
                <span className="absolute bottom-0 right-0 w-0 h-0 rounded-2xl opacity-0 bg-white/10 backdrop-blur-sm transition-all duration-700 ease-out animate-blob-alt group-hover:bottom-[-30px] group-hover:right-[30px] group-hover:w-[60px] group-hover:h-[60px] group-hover:opacity-100" />
              </span>
              <div
                className="relative z-20 bg-white/25 backdrop-blur-md border border-white/30 rounded-2xl h-full flex flex-row sm:flex-col items-center sm:items-start gap-1.5 sm:gap-0 p-2 sm:p-6 transition-all duration-500 group-hover:bg-white/30 group-hover:shadow-lg"
                style={{ transform: `translateZ(${tz(30)})`, transformStyle: "preserve-3d" }}
              >
                <card.icon size={15} strokeWidth={1.5} className={`${card.iconClass} shrink-0 sm:mb-2 sm:w-5 sm:h-5`} style={{ transform: `translateZ(${tz(10)})` }} />
                <div className="flex-1 min-w-0" style={{ transform: `translateZ(${tz(15)})` }}>
                  <p className="text-white/80 text-[11px] sm:text-sm">{card.label}</p>
                  <p className="text-xl sm:text-4xl font-bold text-white mt-0.5 sm:mt-2">
                    {showAnimated ? <AnimatedNumber target={card.count} /> : "0"}
                  </p>
                </div>
                <p className="text-white/50 text-[10px] sm:text-xs sm:mt-auto" style={{ transform: `translateZ(${tz(5)})` }}>{card.sub}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="card-grid flex gap-2 sm:gap-4" style={{ marginTop: "28px" }}>
        {actionBtns.map((btn, i) => (
          <Link
            key={i}
            to={btn.path}
            className="home-card group relative block flex-1 h-12 sm:h-24 rounded-2xl overflow-hidden"
          >
            <span
              className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${btn.from}, ${btn.end})` }}
            />
            <span className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />
            <span className="relative z-10 flex flex-row sm:flex-col items-center justify-center h-full text-white font-medium gap-1.5 sm:gap-1.5">
              <btn.icon size={14} strokeWidth={1.8} className="sm:w-5 sm:h-5" />
              <span className="text-[11px] sm:text-base">{btn.label}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Compact daily summary + expandable history */}
      <div className="home-card glass rounded-2xl p-1.5 sm:p-4 space-y-1">
        <button
          onClick={() => setHistoryExpanded(!historyExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp size={16} strokeWidth={1.8} className="text-purple-500 shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-purple-700 truncate">
              今日
              {todayStats.learnedCount > 0 && <span className="text-green-600 ml-1">+{todayStats.learnedCount} 新学</span>}
              {todayStats.reviewedCount > 0 && <span className="text-purple-600 ml-1">{todayStats.reviewedCount} 复习</span>}
              {todayTotal === 0 && "暂无学习记录"}
            </span>
          </div>
          <ChevronDown
            size={16}
            strokeWidth={1.8}
            className={`text-gray-400 shrink-0 transition-transform ${historyExpanded ? "rotate-180" : ""}`}
          />
        </button>

        {historyExpanded && history.length > 0 && (
          <div className="border-t border-gray-100 pt-2 space-y-1">
            {history.slice(0, 14).map((day) => (
              <div key={day.date} className="flex items-center gap-2 py-1 text-xs">
                <span className="text-gray-400 w-16 shrink-0">
                  {formatDate(day.date)} {getWeekday(day.date)}
                </span>
                <div className="flex-1 flex items-center gap-1.5">
                  {day.learnedCount > 0 && (
                    <span className="bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full text-[10px]">+{day.learnedCount}</span>
                  )}
                  {day.reviewedCount > 0 && (
                    <span className="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full text-[10px]">{day.reviewedCount}复</span>
                  )}
                </div>
                <span className="text-gray-300 text-[10px]">{day.learnedCount + day.reviewedCount}次</span>
              </div>
            ))}
          </div>
        )}
        {historyExpanded && history.length === 0 && (
          <p className="text-xs text-gray-300 text-center py-2">还没有学习记录</p>
        )}
      </div>

      <div className="home-card">
        <ShareButton
          stats={{
            learnedCount: todayStats.learnedCount,
            reviewedCount: todayStats.reviewedCount,
            totalCount: wordCount,
          }}
        />
      </div>
    </div>
  );
}
