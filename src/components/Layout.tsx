import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { House, Search, BookOpen, ClipboardList, RefreshCw, Image, X } from "lucide-react";
import gsap from "gsap";
import { saveBackground, loadBackground, removeBackground, createBgUrl, type StoredBg } from "../utils/backgroundStore";

const navItems = [
  { to: "/", label: "首页", Icon: House },
  { to: "/search", label: "查单词", Icon: Search },
  { to: "/learn", label: "学习", Icon: BookOpen },
  { to: "/review", label: "复习", Icon: RefreshCw },
  { to: "/words", label: "单词本", Icon: ClipboardList },
];

function MobileNav({ items }: { items: typeof navItems }) {
  const location = useLocation();
  const pillRef = useRef<HTMLDivElement>(null);
  const prevIndex = useRef(0);
  const initialized = useRef(false);

  const activeIndex = items.findIndex((item) => item.to === location.pathname);
  const activeIdx = activeIndex === -1 ? 0 : activeIndex;
  const n = items.length;

  const left = `${(activeIdx * 100) / n}%`;
  const width = `${100 / n}%`;

  useLayoutEffect(() => {
    if (!pillRef.current) return;
    const pill = pillRef.current;

    if (!initialized.current) {
      gsap.set(pill, { left, width });
      initialized.current = true;
    } else {
      gsap.to(pill, {
        left,
        width,
        duration: 0.4,
        ease: "power2.out",
      });

      if (prevIndex.current !== activeIdx) {
        gsap.fromTo(
          pill,
          { scale: 0.9 },
          { scale: 1, duration: 0.35, ease: "back.out(1.7)" }
        );
      }
    }

    prevIndex.current = activeIdx;
  }, [activeIdx, left, width]);

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/30 z-50 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="relative flex h-16 px-1">
        {/* Floating active pill — positioned entirely by GSAP, no inline left */}
        <div
          ref={pillRef}
          className="absolute top-2 bottom-2 rounded-2xl pointer-events-none"
          style={{ width }}
        >
          <div className="bg-purple-100/60 rounded-2xl mx-1 h-full" />
        </div>

        {items.map((item, i) => {
          const active = i === activeIdx;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative z-10 flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors duration-200 ${
                active ? "text-purple-700 font-semibold" : "text-gray-400"
              }`}
            >
              <item.Icon size={22} strokeWidth={1.8} className="mb-0.5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const customVideoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [customBg, setCustomBg] = useState<{ url: string; type: "image" | "video"; name: string } | null>(null);
  const bgCleanup = useRef<string | null>(null);

  // Load custom background on mount
  useEffect(() => {
    loadBackground().then((stored) => {
      if (stored) {
        const url = createBgUrl(stored);
        bgCleanup.current = url;
        setCustomBg({ url, type: stored.type, name: stored.name });
      }
    });
    return () => {
      if (bgCleanup.current) URL.revokeObjectURL(bgCleanup.current);
    };
  }, []);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await saveBackground(file);
    if (bgCleanup.current) URL.revokeObjectURL(bgCleanup.current);
    const bg: StoredBg = {
      blob: file,
      type: file.type.startsWith("video/") ? "video" : "image",
      name: file.name,
    };
    const url = createBgUrl(bg);
    bgCleanup.current = url;
    setCustomBg({ url, type: bg.type, name: bg.name });
  };

  const handleBgRemove = async () => {
    await removeBackground();
    if (bgCleanup.current) {
      URL.revokeObjectURL(bgCleanup.current);
      bgCleanup.current = null;
    }
    setCustomBg(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleExport = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("vocab_")) {
        data[key] = localStorage.getItem(key) || "";
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `单词大师备份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        let count = 0;
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith("vocab_")) {
            localStorage.setItem(key, value as string);
            count++;
          }
        }
        alert(`导入完成！共恢复 ${count} 条数据。\n\n请刷新页面以生效。`);
        window.location.reload();
      } catch {
        alert("文件格式错误，请选择正确的备份文件");
      }
    };
    input.click();
  };

  // Force video playback helper
  const forcePlayVideo = (video: HTMLVideoElement) => {
    const tryPlay = async () => {
      try {
        await video.play();
        setVideoReady(true);
      } catch {
        const play = async () => {
          try { await video.play(); setVideoReady(true); } catch { /* give up */ }
        };
        const events = ["touchstart", "click", "scroll"];
        events.forEach((e) => document.addEventListener(e, play, { once: true }));
        return () => events.forEach((e) => document.removeEventListener(e, play));
      }
    };
    tryPlay();
  };

  // Force video playback on mobile — default background
  useEffect(() => {
    if (videoRef.current && !customBg) forcePlayVideo(videoRef.current);
  }, [customBg]);

  // Force video playback on mobile — custom background
  useEffect(() => {
    if (customVideoRef.current && customBg?.type === "video") {
      customVideoRef.current.load();
      forcePlayVideo(customVideoRef.current);
    }
  }, [customBg]);

  // Page transition animation
  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
      );
    }
  }, [location.pathname]);

  // Active indicator slide animation (desktop)
  const activeIndex = navItems.findIndex((item) => item.to === location.pathname);

  useEffect(() => {
    if (indicatorRef.current) {
      gsap.to(indicatorRef.current, {
        x: activeIndex * 100 + "%",
        duration: 0.3,
        ease: "power2.out",
      });
    }
  }, [activeIndex]);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Custom or default background */}
      {customBg ? (
        customBg.type === "video" ? (
          <video
            ref={customVideoRef}
            autoPlay
            muted
            loop
            playsInline
            webkit-playsinline="true"
            preload="auto"
            className="video-bg"
            src={customBg.url}
          />
        ) : (
          <div
            className="video-bg"
            style={{
              backgroundImage: `url(${customBg.url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            webkit-playsinline="true"
            preload="auto"
            className="video-bg"
            src="/bg-sky.mp4"
          />
          {!videoReady && (
            <div className="video-bg bg-gradient-to-b from-blue-200/60 via-purple-100/40 to-indigo-100/60" />
          )}
        </>
      )}
      <div className="video-overlay" />

      {/* Top nav - desktop: frosted glass */}
      <nav className="hidden sm:block sticky top-0 z-40 glass-strong border-b border-white/50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="text-lg font-bold tracking-wide text-purple-600 shrink-0"
          >
            单词大师
          </Link>

          {/* Desktop nav links with sliding indicator */}
          <div className="flex items-center gap-1 text-sm relative">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`relative px-3 py-1.5 rounded-lg transition-colors z-10 ${
                  location.pathname === item.to
                    ? "text-purple-600 font-medium"
                    : "text-gray-500 hover:text-purple-500"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {/* Sliding active indicator */}
            <div
              className="absolute top-0 left-0 h-full pointer-events-none transition-none"
              style={{ width: `${100 / navItems.length}%` }}
            >
              <div
                ref={indicatorRef}
                className="h-full bg-purple-100/60 rounded-lg"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
            <label className="cursor-pointer text-gray-400 hover:text-purple-500 transition-colors" title="更换背景">
              <Image size={15} strokeWidth={1.5} />
              <input type="file" accept="image/*,video/*" onChange={handleBgUpload} className="hidden" />
            </label>
            {customBg && (
              <button
                onClick={handleBgRemove}
                className="text-gray-400 hover:text-red-400 transition-colors"
                title="恢复默认背景"
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            )}
            <button
              onClick={handleExport}
              className="text-xs text-gray-400 hover:text-purple-500 transition-colors"
              title="导出数据备份"
            >
              导出
            </button>
            <button
              onClick={handleImport}
              className="text-xs text-gray-400 hover:text-purple-500 transition-colors"
              title="从备份恢复数据"
            >
              导入
            </button>
            <span className="text-xs text-gray-400 hidden lg:inline">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="bg-purple-100/70 hover:bg-purple-200/70 text-purple-600 px-3 py-1 rounded-lg transition-colors text-xs"
            >
              退出
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile top bar: just branding */}
      <div className="sm:hidden flex items-center justify-between px-4 h-12 glass border-b border-white/30 sticky top-0 z-40">
        <Link to="/" className="text-base font-bold text-purple-600">
          单词大师
        </Link>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-gray-400 active:text-purple-500 transition-colors" title="更换背景">
            <Image size={18} strokeWidth={1.5} />
            <input type="file" accept="image/*,video/*" onChange={handleBgUpload} className="hidden" />
          </label>
          {customBg && (
            <button
              onClick={handleBgRemove}
              className="text-gray-400 active:text-red-400 transition-colors"
              title="恢复默认背景"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-purple-500 transition-colors"
          >
            退出
          </button>
        </div>
      </div>

      <main
        ref={contentRef}
        className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6 relative z-10"
      >
        <Outlet />
      </main>

      {/* Bottom tab bar - mobile: frosted glass with animated indicator */}
      <MobileNav items={navItems} />
    </div>
  );
}
