interface Props {
  onRate: (rating: "forgot" | "hard" | "good") => void;
  disabled?: boolean;
}

export default function RatingButtons({ onRate, disabled }: Props) {
  return (
    <div className="flex gap-3 justify-center flex-wrap">
      <button
        onClick={() => onRate("forgot")}
        disabled={disabled}
        className="px-6 py-3 rounded-xl font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
      >
        生疏
      </button>
      <button
        onClick={() => onRate("hard")}
        disabled={disabled}
        className="px-6 py-3 rounded-xl font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors disabled:opacity-50"
      >
        一般
      </button>
      <button
        onClick={() => onRate("good")}
        disabled={disabled}
        className="px-6 py-3 rounded-xl font-medium bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-50"
      >
        熟练
      </button>
    </div>
  );
}
