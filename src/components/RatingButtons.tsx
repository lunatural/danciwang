import { Frown, Meh, Smile } from "lucide-react";

interface Props {
  onRate: (rating: "forgot" | "hard" | "good") => void;
  disabled?: boolean;
}

const btnBase =
  "flex-1 min-w-[80px] max-w-[120px] py-4 sm:py-5 rounded-2xl font-semibold text-sm sm:text-base border border-white/50 backdrop-blur-md transition-all duration-200 disabled:opacity-40 active:scale-95";

const iconClass = "mx-auto mb-1";

export default function RatingButtons({ onRate, disabled }: Props) {
  return (
    <div className="mt-4 sm:mt-6 animate-fade-in-up">
      <p className="text-center text-gray-400 text-xs mb-2 sm:mb-3">你对这个单词的掌握程度？</p>
      <div className="flex gap-3 sm:gap-4 justify-center">
        <button
          onClick={() => onRate("forgot")}
          disabled={disabled}
          className={`${btnBase} bg-red-100/50 text-red-600 hover:bg-red-200/70 active:bg-red-200/90`}
        >
          <Frown size={24} strokeWidth={1.8} className={iconClass} />
          生疏
        </button>
        <button
          onClick={() => onRate("hard")}
          disabled={disabled}
          className={`${btnBase} bg-yellow-100/50 text-yellow-700 hover:bg-yellow-200/70 active:bg-yellow-200/90`}
        >
          <Meh size={24} strokeWidth={1.8} className={iconClass} />
          一般
        </button>
        <button
          onClick={() => onRate("good")}
          disabled={disabled}
          className={`${btnBase} bg-green-100/50 text-green-600 hover:bg-green-200/70 active:bg-green-200/90`}
        >
          <Smile size={24} strokeWidth={1.8} className={iconClass} />
          熟练
        </button>
      </div>
    </div>
  );
}
