import { useState } from "react";

interface Props {
  onSearch: (word: string) => void;
  placeholder?: string;
}

export default function SearchBar({ onSearch, placeholder = "输入英文单词..." }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-3 rounded-xl border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent text-base"
      />
      <button
        type="submit"
        className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-colors"
      >
        搜索
      </button>
    </form>
  );
}
