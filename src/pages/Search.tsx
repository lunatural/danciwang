import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import SearchBar from "../components/SearchBar";
import WordCard from "../components/WordCard";
import { fetchWord, type WordData } from "../utils/api";
import { addWord, isWordAdded, addToLearning } from "../hooks/useData";

export default function Search() {
  const { user } = useAuth();
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  const handleSearch = async (word: string) => {
    setLoading(true);
    setError("");
    setWordData(null);
    const data = await fetchWord(word);
    if (!data) {
      setError(`未找到 "${word}" 的相关信息`);
    } else {
      setWordData(data);
      setAdded(!!user && isWordAdded(user.id, data.word));
    }
    setLoading(false);
  };

  const handleAdd = () => {
    if (!wordData || !user) return;
    addWord(user.id, wordData.word);
    addToLearning(user.id, wordData.word);
    setAdded(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-700">查单词</h1>
      <SearchBar onSearch={handleSearch} />

      {loading && (
        <div className="text-center text-gray-400 py-10">搜索中...</div>
      )}
      {error && (
        <div className="text-center text-gray-500 py-10">{error}</div>
      )}
      {wordData && (
        <WordCard data={wordData} isAdded={added} onAdd={handleAdd} />
      )}
    </div>
  );
}
