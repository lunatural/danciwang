import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getLearningWords, moveToReview } from "../hooks/useData";
import { fetchWord, type WordData } from "../utils/api";

type SortMode = "default" | "random" | "az" | "za";

function sortWords(words: string[], mode: SortMode): string[] {
  const arr = [...words];
  switch (mode) {
    case "random":
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    case "az":
      return arr.sort((a, b) => a.localeCompare(b));
    case "za":
      return arr.sort((a, b) => b.localeCompare(a));
    default:
      return arr;
  }
}

export default function Learn() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [originalWords, setOriginalWords] = useState<string[]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingWord, setLoadingWord] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  useEffect(() => {
    if (!user) return;
    const raw = getLearningWords(user.id);
    setOriginalWords(raw);
    setWords(raw);
    setLoading(false);
  }, [user]);

  const applySort = useCallback(
    (mode: SortMode) => {
      setSortMode(mode);
      const sorted = sortWords(originalWords, mode);
      setWords(sorted);
      setCurrentIndex(0);
      setWordData(null);
      if (sorted.length > 0) {
        setLoadingWord(true);
        fetchWord(sorted[0]).then((data) => {
          setWordData(data);
          setLoadingWord(false);
        });
      }
    },
    [originalWords]
  );

  useEffect(() => {
    if (words.length === 0) return;
    setLoadingWord(true);
    fetchWord(words[0]).then((data) => {
      setWordData(data);
      setLoadingWord(false);
    });
  }, [words]);

  const loadWord = (index: number) => {
    if (index >= words.length) return;
    setLoadingWord(true);
    fetchWord(words[index]).then((data) => {
      setWordData(data);
      setLoadingWord(false);
    });
  };

  const handleLearned = () => {
    if (!user || words.length === 0) return;
    const word = words[currentIndex];
    moveToReview(user.id, word);
    const remainingOriginal = originalWords.filter((w) => w !== word);
    setOriginalWords(remainingOriginal);
    const remaining = words.filter((_, i) => i !== currentIndex);
    setWords(remaining);
    if (remaining.length === 0) {
      setWordData(null);
      return;
    }
    const nextIndex = currentIndex >= remaining.length ? 0 : currentIndex;
    setCurrentIndex(nextIndex);
    loadWord(nextIndex);
  };

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "default", label: "默认顺序" },
    { value: "az", label: "A-Z" },
    { value: "za", label: "Z-A" },
    { value: "random", label: "随机打乱" },
  ];

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-10">加载中...</div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-purple-700">学习新单词</h1>
        <div className="text-center py-16">
          <p className="text-5xl mb-4">📖</p>
          <p className="text-xl text-gray-600 font-medium">没有待学习的单词</p>
          <p className="text-gray-400 mt-2">去「查单词」页面搜索并添加新单词吧</p>
          <button
            onClick={() => navigate("/search")}
            className="mt-4 px-6 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
          >
            去查单词
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-purple-700 mb-3">学习新单词</h1>
        <div className="flex gap-2 flex-wrap">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => applySort(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortMode === opt.value
                  ? "bg-purple-500 text-white"
                  : "bg-white text-purple-600 border border-purple-200 hover:bg-purple-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-gray-400 text-sm">
        还剩 {words.length} 个单词待学习
      </p>

      {loadingWord || !wordData ? (
        <div className="text-center text-gray-400 py-20">加载单词中...</div>
      ) : (
        <div
          key={wordData.word}
          className="bg-white rounded-2xl shadow-md p-6 space-y-4"
        >
          <div className="text-center">
            <h2 className="text-3xl font-bold text-purple-700 mb-2">{wordData.word}</h2>
            {wordData.phonetic && (
              <p className="text-gray-500 text-lg">{wordData.phonetic}</p>
            )}
          </div>

          {wordData.audio && (
            <div className="flex justify-center">
              <audio key={wordData.word} controls className="h-8">
                <source src={wordData.audio} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {wordData.meanings.map((m, i) => (
            <div key={i}>
              <span className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-sm font-medium mb-2">
                {m.partOfSpeech}
              </span>
              <ul className="space-y-1.5">
                {m.definitions.slice(0, 3).map((d, j) => (
                  <li key={j} className="text-gray-700 text-sm">
                    <span className="font-medium text-purple-600">{j + 1}.</span>{" "}
                    {d.definition}
                    {d.example && (
                      <span className="text-gray-400 block ml-4 mt-0.5 italic">
                        "{d.example}"
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {m.synonyms.length > 0 && (
                <p className="text-sm mt-2">
                  <span className="text-gray-500">近义词：</span>
                  <span className="text-purple-600">
                    {m.synonyms.slice(0, 8).join("、")}
                  </span>
                </p>
              )}
            </div>
          ))}

          <div className="flex justify-center pt-4">
            <button
              onClick={handleLearned}
              className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium text-lg transition-colors"
            >
              我学会了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
