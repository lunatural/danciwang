import { useState } from "react";
import { generateShareImage, type ShareStats } from "../utils/shareCard";
import { Share2 } from "lucide-react";

interface Props {
  stats: ShareStats;
}

export default function ShareButton({ stats }: Props) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const blob = await generateShareImage(stats);
      const file = new File([blob], `单词大师打卡_${new Date().toISOString().slice(0, 10)}.png`, {
        type: "image/png",
      });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "单词大师 · 今日学习打卡",
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // User cancelled share, ignore
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className="w-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white rounded-xl sm:rounded-2xl py-3 sm:py-4 text-sm sm:text-base font-medium transition-all disabled:opacity-60"
    >
      {loading ? "生成中..." : <><Share2 size={18} strokeWidth={1.8} className="inline -mt-0.5" /> 分享今日打卡</>}
    </button>
  );
}
