import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showTip, setShowTip] = useState(false);
  const [installed, setInstalled] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);

    // Already running as standalone PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Close tip when clicking outside
  useEffect(() => {
    if (!showTip) return;
    const handler = (e: MouseEvent) => {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) {
        setShowTip(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTip]);

  if (installed) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } else {
      setShowTip(true);
    }
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="relative" ref={tipRef}>
      <button
        onClick={handleInstall}
        className="flex items-center gap-1 text-purple-500 hover:text-purple-600 transition-colors"
        title="安装到桌面"
      >
        <Download size={15} strokeWidth={1.5} />
        <span className="text-xs hidden sm:inline">安装</span>
      </button>

      {showTip && (
        <div className="absolute right-0 top-full mt-2 w-64 glass-strong rounded-xl border border-white/40 shadow-lg p-4 z-50">
          <button
            onClick={() => setShowTip(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
          <p className="text-sm font-medium text-purple-600 mb-3">安装「单词大师」到桌面</p>
          {isIOS ? (
            <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
              <li>点击底部工具栏的 <span className="font-semibold">分享按钮</span> <span className="text-blue-500">⬆️</span></li>
              <li>向下滑动找到 <span className="font-semibold">「添加到主屏幕」</span></li>
              <li>点击右上角 <span className="font-semibold">「添加」</span> 即可</li>
            </ol>
          ) : (
            <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
              <li>点击浏览器地址栏右侧的 <span className="font-semibold">安装图标</span></li>
              <li>或者打开浏览器菜单 → <span className="font-semibold">「安装应用」</span></li>
              <li>确认安装即可在桌面找到</li>
            </ol>
          )}
        </div>
      )}
    </div>
  );
}