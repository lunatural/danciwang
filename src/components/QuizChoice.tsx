import { useState, useEffect } from "react";
import type { WordData, ExampleSentence } from "../utils/api";
import { translateToChinese } from "../utils/api";
import ClickableText from "./ClickableText";

interface Props {
  data: WordData;
  examples: ExampleSentence[];
  /** Distractor info: { word, translation } */
  distractors: { word: string; translation: string }[];
  onResult: (correct: boolean) => void;
}

export default function QuizChoice({ data, examples, distractors, onResult }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [optionWords, setOptionWords] = useState<string[]>([]); // source word for each option
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [cnMap, setCnMap] = useState<Record<string, string>>({});

  const word = data.word;
  const meanings = data.meanings || [];
  const definition = meanings[0]?.definitions[0]?.definition || "";
  const partOfSpeech = meanings[0]?.partOfSpeech || "";

  // Strip POS abbreviations like "vt.", "n.", "vi." from translation text
  function stripPOS(text: string): string {
    return text.replace(/^(vt\.|vi\.|v\.|n\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|int\.|aux\.|abbr\.)\s*/gi, "").trim();
  }

  useEffect(() => {
    let cancelled = false;

    const build = async () => {
      const correctCN = await translateToChinese(definition);
      if (cancelled) return;

      // Pick 3 distractors
      const valid = distractors
        .filter((d) => d.translation && d.translation !== correctCN && d.word !== word)
        .slice(0, 3);

      // Pad with fallbacks
      while (valid.length < 3) {
        const fallbacks = [
          { word: "", translation: "快速地" },
          { word: "", translation: "重要的" },
          { word: "", translation: "建筑物" },
          { word: "", translation: "创造" },
        ];
        const fb = fallbacks[valid.length % fallbacks.length];
        if (!valid.find((v) => v.translation === fb.translation)) valid.push(fb);
      }

      const allItems = [
        { word: "", translation: stripPOS(correctCN) },
        ...valid.slice(0, 3).map((v) => ({ ...v, translation: stripPOS(v.translation) })),
      ];
      // Shuffle
      for (let i = allItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
      }

      const correct = allItems.findIndex((item) => item.translation === correctCN);
      if (!cancelled) {
        setOptions(allItems.map((item) => item.translation));
        setOptionWords(allItems.map((item) => item.word));
        setCorrectIdx(correct);
        setLoading(false);
      }
    };

    build();
    return () => { cancelled = true; };
  }, [data.word]);

  // Translate all definitions to Chinese when detail is shown
  useEffect(() => {
    if (!showDetail) return;
    const defs: string[] = [];
    for (const m of meanings) {
      for (const d of m.definitions.slice(0, 3)) {
        if (d.definition) defs.push(d.definition);
      }
    }
    if (defs.length === 0) return;
    let cancelled = false;
    Promise.all(defs.map((d) => translateToChinese(d))).then((results) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      defs.forEach((d, i) => { if (results[i]) map[d] = results[i]; });
      setCnMap(map);
    });
    return () => { cancelled = true; };
  }, [showDetail, data.word]);

  const handleSelect = (idx: number) => {
    if (showDetail) return; // already showing detail, wait for "下一题"
    setSelected(idx);
    setShowDetail(true);
  };

  const handleNext = () => {
    onResult(selected === correctIdx);
  };

  const isCorrect = selected === correctIdx;

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">加载题目...</div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="text-center">
        <p className="text-xs text-purple-400 font-medium mb-1">选择题 · 选择正确的中文释义</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-purple-700">{word}</h2>
        {data.phonetic && <p className="text-gray-400 text-sm mt-0.5">{data.phonetic}</p>}
      </div>

      {/* Options */}
      <div className="space-y-2.5 sm:space-y-3">
        {options.map((opt, i) => {
          let cls =
            "w-full px-4 py-3 sm:py-3.5 rounded-xl text-sm font-medium transition-all border text-left";
          if (selected === null) {
            cls += " bg-white/60 border-purple-100 hover:bg-purple-50 hover:border-purple-300 active:scale-[0.98] cursor-pointer";
          } else if (i === correctIdx) {
            cls += " bg-green-100 border-green-400 text-green-700";
          } else if (i === selected && !isCorrect) {
            cls += " bg-red-100 border-red-400 text-red-700";
          } else {
            cls += " bg-white/30 border-gray-100 text-gray-400";
          }

          const sourceWord = optionWords[i];
          // Show source only for wrong selection and only if it's a real distractor word
          const showSource = showDetail && !isCorrect && i === selected && sourceWord && sourceWord !== word;

          return (
            <button key={i} onClick={() => handleSelect(i)} disabled={selected !== null} className={cls}>
              <span className="inline-block w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold text-center leading-6 mr-2">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
              {showDetail && i === correctIdx && <span className="ml-2 text-green-600">✓</span>}
              {showDetail && i === selected && !isCorrect && <span className="ml-2 text-red-500">✗</span>}
              {showSource && (
                <span className="block text-red-400 text-xs mt-0.5 ml-8">
                  这是 "<span className="font-bold text-red-500">{sourceWord}</span>" 的释义
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Word detail panel — shown after selection */}
      {showDetail && (
        <div className="glass rounded-2xl p-4 sm:p-5 space-y-3 animate-fade-in-up">
          {isCorrect ? (
            <p className="text-center text-green-600 font-medium text-sm">✓ 正确！</p>
          ) : (
            <p className="text-center text-red-500 font-medium text-sm">
              正确答案是 <span className="font-bold">{options[correctIdx]}</span>
            </p>
          )}

          <div className="text-center">
            <h3 className="text-xl font-bold text-purple-700">{word}</h3>
            {data.phonetic && <p className="text-gray-400 text-xs mt-0.5">{data.phonetic}</p>}
          </div>

          {/* All meanings & definitions */}
          <div className="bg-purple-50/50 rounded-xl p-3 space-y-2">
            <p className="text-xs text-purple-400 font-medium">详细释义</p>
            {meanings.map((m, mi) => (
              <div key={mi} className="border-b border-purple-100 last:border-0 pb-2 last:pb-0">
                {m.partOfSpeech && (
                  <span className="inline-block text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded mb-1">
                    {m.partOfSpeech}
                  </span>
                )}
                <ul className="space-y-1">
                  {m.definitions.slice(0, 4).map((d, di) => (
                    <li key={di} className="text-xs text-gray-700">
                      <span className="font-medium text-purple-500">{di + 1}.</span>{" "}
                      <ClickableText text={d.definition} />
                      {cnMap[d.definition] && (
                        <span className="text-gray-400 ml-1">{cnMap[d.definition]}</span>
                      )}
                      {d.example && (
                        <span className="text-gray-400 block ml-3 mt-0.5 italic">
                          "<ClickableText text={d.example} />"
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {m.synonyms.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    近义：{m.synonyms.slice(0, 6).join("、")}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Examples */}
          {examples.length > 0 && (
            <div className="bg-blue-50/50 rounded-xl p-3">
              <p className="text-xs text-blue-400 mb-1.5">例句</p>
              {examples.slice(0, 3).map((ex, i) => (
                <div key={i} className="mb-1.5 last:mb-0">
                  <p className="text-xs text-gray-700 italic">
                    "<ClickableText text={ex.english} />"
                  </p>
                  {ex.chinese && <p className="text-xs text-blue-500 mt-0.5">{ex.chinese}</p>}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleNext}
            className="w-full py-3 bg-purple-500/80 text-white rounded-xl font-medium text-sm hover:bg-purple-500/90 transition-all"
          >
            下一题
          </button>
        </div>
      )}
    </div>
  );
}
