import { useState } from "react";
import { createPortal } from "react-dom";
import { generateShareImage, type ShareStats } from "../utils/shareCard";
import { Share2, Download, X } from "lucide-react";

interface Props {
  stats: ShareStats;
}

export default function ShareButton({ stats }: Props) {
  const [loading, setLoading] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  const handleShare = async () => {
    setLoading(true);
    try {
      const blob = await generateShareImage(stats);
      setImgUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      alert("生成图片失败：" + (err?.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `单词大师打卡_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <>
      <button
        onClick={handleShare}
        disabled={loading}
        className="w-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white rounded-xl sm:rounded-2xl py-3 sm:py-4 text-sm sm:text-base font-medium transition-all disabled:opacity-60"
      >
        {loading ? "生成中..." : <><Share2 size={18} strokeWidth={1.8} className="inline -mt-0.5" /> 分享今日打卡</>}
      </button>

      {/* 预览弹窗 - Portal 到 body 避免 perspective 锁定 */}
      {imgUrl && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col" onClick={() => setImgUrl(null)}>
          {/* 顶部关闭按钮——避开手机状态栏 */}
          <div className="flex justify-end px-4 pb-1 flex-shrink-0" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setImgUrl(null)} className="bg-white/90 rounded-full p-2.5 shadow-lg">
              <X size={22} className="text-gray-600" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-2" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-xs mx-auto">
              <img src={imgUrl} alt="打卡图片" className="w-full rounded-2xl shadow-2xl" />
            </div>
          </div>
          <div className="px-4 pb-6 pt-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-xs mx-auto">
              <button onClick={handleDownload}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:from-purple-600 hover:to-purple-800 transition-all">
                <Download size={18} /> 保存到本地
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
