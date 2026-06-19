import { PartyPopper, RotateCcw } from "lucide-react";

interface Props {
  total: number;
  correct: number;
  duration: number; // seconds
  onRestart: () => void;
}

export default function ReviewResult({ total, correct, duration, onRestart }: Props) {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const getMessage = () => {
    if (accuracy >= 90) return "太棒了！你已经掌握了这些单词 🎉";
    if (accuracy >= 70) return "做得不错！继续加油 💪";
    if (accuracy >= 50) return "还需努力，明天再复习一遍 📖";
    return "别灰心，多复习几次就会了 🌱";
  };

  return (
    <div className="space-y-6 sm:space-y-8 text-center py-8 sm:py-12">
      <PartyPopper size={56} strokeWidth={1.2} className="mx-auto text-purple-400" />

      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-purple-700 mb-2">复习完成！</h2>
        <p className="text-gray-500 text-sm">{getMessage()}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-sm mx-auto">
        <div className="glass rounded-2xl p-3 sm:p-4">
          <p className="text-2xl sm:text-3xl font-bold text-purple-600">{total}</p>
          <p className="text-xs text-gray-400 mt-1">总题数</p>
        </div>
        <div className="glass rounded-2xl p-3 sm:p-4">
          <p className="text-2xl sm:text-3xl font-bold text-green-500">{correct}</p>
          <p className="text-xs text-gray-400 mt-1">正确</p>
        </div>
        <div className="glass rounded-2xl p-3 sm:p-4">
          <p className="text-2xl sm:text-3xl font-bold text-purple-500">{accuracy}%</p>
          <p className="text-xs text-gray-400 mt-1">正确率</p>
        </div>
      </div>

      <div className="text-sm text-gray-400">
        用时 {minutes > 0 ? `${minutes} 分 ` : ""}{seconds} 秒
      </div>

      <button
        onClick={onRestart}
        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500/80 text-white rounded-xl font-medium hover:bg-purple-500/90 transition-all text-sm border border-white/30"
      >
        <RotateCcw size={16} strokeWidth={1.8} />
        返回复习列表
      </button>
    </div>
  );
}
