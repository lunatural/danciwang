import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import SearchBar from "../components/SearchBar";
import WordCard from "../components/WordCard";
import { fetchWord, translateLongText, translateToEnglish, fetchExampleSentences, type WordData, type ExampleSentence } from "../utils/api";
import { addWord, isWordAdded, addToLearning } from "../hooks/useData";
import { Search as SearchIcon, Languages, Database } from "lucide-react";
import { searchAnki } from "../utils/ankiParser";
import { searchLocalDict, preloadDict } from "../utils/localDict";

type Tab = "search" | "translate";

export default function Search() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("search");
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [examples, setExamples] = useState<ExampleSentence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [ankiSource, setAnkiSource] = useState(false);

  // Translation state
  const [transInput, setTransInput] = useState("");
  const [transResult, setTransResult] = useState("");
  const [transLoading, setTransLoading] = useState(false);

  // Pre-filled query from navigation state
  const fromPage = (location.state as { from?: string; query?: string } | null)?.from;
  const prefilledQuery = (location.state as { query?: string } | null)?.query;
  const hasAutoSearched = useRef(false);

  useEffect(() => {
    preloadDict();
  }, []);

  useEffect(() => {
    if (prefilledQuery && !hasAutoSearched.current) {
      hasAutoSearched.current = true;
      setSearchValue(prefilledQuery);
      handleSearch(prefilledQuery);
    }
  }, [prefilledQuery]);

  const handleBack = () => {
    if (fromPage) {
      navigate(fromPage, { replace: true });
    } else {
      navigate(-1);
    }
  };

  const detectIsChinese = (text: string): boolean => {
    return /[一-鿿]/.test(text);
  };

  const handleSearch = async (word: string) => {
    setLoading(true);
    setError("");
    setWordData(null);
    setExamples([]);

    let lookupWord = word.trim();

    // If input contains Chinese, translate to English first
    if (detectIsChinese(lookupWord)) {
      const translated = await translateToEnglish(lookupWord);
      if (!translated) {
        setError(`未找到 "${lookupWord}" 的英文翻译`);
        setLoading(false);
        return;
      }
      lookupWord = translated;
    }

    const [data, exs] = await Promise.all([
      fetchWord(lookupWord),
      fetchExampleSentences(lookupWord),
    ]);
    if (!data) {
      // Fallback 1: Local ECDICT dictionary
      const localResult = await searchLocalDict(lookupWord);
      if (localResult) {
        const localWordData: WordData = {
          word: localResult.word,
          phonetic: localResult.phonetic,
          meanings: [{
            partOfSpeech: localResult.partOfSpeech,
            definitions: [{
              definition: localResult.definition || localResult.translation || "",
              example: "",
              synonyms: [],
              antonyms: [],
            }],
            synonyms: [],
            antonyms: [],
          }],
          audio: "",
          sourceUrl: "",
        };
        setWordData(localWordData);
        setExamples([]);
        setAnkiSource(true);
        setAdded(!!user && isWordAdded(user.id, localResult.word));
      } else {
        // Fallback 2: Anki imported decks
        const ankiResults = searchAnki(lookupWord);
        if (ankiResults.length > 0) {
          const r = ankiResults[0];
          const ankiWordData: WordData = {
            word: r.word,
            phonetic: r.phonetic || "",
            meanings: [{
              partOfSpeech: r.partOfSpeech || "",
              definitions: [{ definition: r.definition || "", example: r.example || "", synonyms: [], antonyms: [] }],
              synonyms: [],
              antonyms: [],
            }],
            audio: "",
            sourceUrl: "",
          };
          setWordData(ankiWordData);
          setExamples([]);
          setAnkiSource(true);
          setAdded(!!user && isWordAdded(user.id, r.word));
        } else {
          setError(`未找到 "${lookupWord}" 的相关信息`);
        }
      }
    } else {
      setWordData(data);
      setExamples(exs);
      setAnkiSource(false);
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

  const handleTranslate = async () => {
    const text = transInput.trim();
    if (!text) return;
    setTransLoading(true);
    setTransResult("");

    const isChinese = detectIsChinese(text);
    const result = await translateLongText(text, isChinese ? "zh2en" : "en2zh");

    if (!result) {
      setTransResult("翻译失败，请稍后重试");
    } else {
      setTransResult(result);
    }
    setTransLoading(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        {fromPage && (
          <button
            onClick={handleBack}
            className="shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
          >
            ← 返回
          </button>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-purple-700">
          {tab === "search" ? "查单词" : "翻译"}
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white/40 backdrop-blur-sm rounded-xl p-1 border border-white/50">
        <button
          onClick={() => setTab("search")}
          className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all inline-flex items-center justify-center gap-1.5 ${
            tab === "search"
              ? "bg-white/70 text-purple-600 shadow-sm"
              : "text-purple-400 hover:text-purple-600"
          }`}
        >
          <SearchIcon size={16} strokeWidth={1.8} />
          查单词
        </button>
        <button
          onClick={() => setTab("translate")}
          className={`flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all inline-flex items-center justify-center gap-1.5 ${
            tab === "translate"
              ? "bg-white/70 text-purple-600 shadow-sm"
              : "text-purple-400 hover:text-purple-600"
          }`}
        >
          <Languages size={16} strokeWidth={1.8} />
          翻译
        </button>
      </div>

      {tab === "search" ? (
        <>
          <SearchBar
            onSearch={handleSearch}
            placeholder="输入英文或中文单词..."
            initialValue={searchValue}
          />

          {loading && (
            <div className="text-center text-gray-400 py-10 text-sm">搜索中...</div>
          )}
          {error && (
            <div className="text-center text-gray-500 py-10 text-sm">{error}</div>
          )}
          {wordData && (
            <>
              {ankiSource && (
                <div className="flex items-center gap-1.5 text-orange-500 text-xs">
                  <Database size={12} strokeWidth={1.8} />
                  数据来源：Anki 词库
                </div>
              )}
              <WordCard data={wordData} isAdded={added} onAdd={handleAdd} examples={examples} />
            </>
          )}
        </>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* Input */}
          <textarea
            value={transInput}
            onChange={(e) => setTransInput(e.target.value)}
            placeholder="输入中文或英文，自动识别并翻译..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:bg-white/80 focus:border-transparent text-sm resize-none transition-all"
          />

          {/* Translate button */}
          <button
            onClick={handleTranslate}
            disabled={transLoading || !transInput.trim()}
            className="w-full py-2.5 sm:py-3 bg-purple-500/80 backdrop-blur-sm hover:bg-purple-500/90 disabled:bg-purple-300/50 text-white rounded-xl font-medium text-sm transition-all border border-white/30"
          >
            {transLoading ? "翻译中..." : "翻译"}
          </button>

          {/* Result */}
          {transResult && (
            <div className="glass rounded-2xl p-4 sm:p-6">
              <p className="text-gray-400 text-xs mb-2">翻译结果：</p>
              <p className="text-gray-800 text-sm sm:text-base whitespace-pre-wrap leading-relaxed">
                {transResult}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
