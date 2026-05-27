import { useState } from "react";

interface Props {
  onSearch: (word: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export default function SearchBar({ onSearch, placeholder = "输入英文单词...", initialValue = "" }: Props) {
  const [value, setValue] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:bg-white/80 focus:border-transparent text-sm sm:text-base transition-all"
      />
      <button
        type="submit"
        className="px-4 sm:px-6 py-2.5 sm:py-3 bg-purple-500/80 backdrop-blur-sm hover:bg-purple-500/90 text-white rounded-xl font-medium text-sm sm:text-base transition-all shrink-0 border border-white/30"
      >
        搜索
      </button>
    </form>
  );
}
