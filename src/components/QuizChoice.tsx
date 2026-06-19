import { useState, useEffect } from "react";
import type { WordData } from "../utils/api";
import { translateToChinese } from "../utils/api";

interface Props {
  data: WordData;
  /** Other words' Chinese translations to use as distractors */
  distractors: string[];
  onResult: (correct: boolean) => void;
}

export default function QuizChoice({ data, distractors, onResult }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const definition = data.meanings[0]?.definitions[0]?.definition || "";

  useEffect(() => {
    let cancelled = false;

    const build = async () => {
      // Translate correct definition
      const correctCN = await translateToChinese(definition);
      if (cancelled) return;

      // Pick 3 distractors (filter out empty)
      const valid = distractors.filter((d) => d && d !== correctCN).slice(0, 3);
      // Pad with generic distractors if needed
      while (valid.length < 3) {
        const fallbacks = ["快速地", "重要的", "建筑物", "创造", "减少", "环境", "经历", "传统的"];
        const fb = fallbacks[valid.length % fallbacks.length];
        if (!valid.includes(fb)) valid.push(fb);
      }

      const all = [correctCN, ...valid.slice(0, 3)];
      // Shuffle
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }

      const correct = all.indexOf(correctCN);
      if (!cancelled) {
        setOptions(all);
        setCorrectIdx(correct);
        setLoading(false);
      }
    };

    build();
    return () => { cancelled = true; };
  }, [data.word]);

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const correct = idx === correctIdx;
    setTimeout(() => onResult(correct), correct ? 600 : 1000);
  };

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">加载题目...</div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="text-center">
        <p className="text-xs text-purple-400 font-medium mb-1">选择题 · 选择正确的中文释义</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-purple-700">{data.word}</h2>
        {data.phonetic && <p className="text-gray-400 text-sm mt-0.5">{data.phonetic}</p>}
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        {options.map((opt, i) => {
          let cls =
            "w-full px-4 py-3 sm:py-3.5 rounded-xl text-sm font-medium transition-all border text-left";
          if (selected === null) {
            cls += " bg-white/60 border-purple-100 hover:bg-purple-50 hover:border-purple-300 active:scale-[0.98] cursor-pointer";
          } else if (i === correctIdx) {
            cls += " bg-green-100 border-green-400 text-green-700";
          } else if (i === selected) {
            cls += " bg-red-100 border-red-400 text-red-700";
          } else {
            cls += " bg-white/30 border-gray-100 text-gray-400";
          }
          return (
            <button key={i} onClick={() => handleSelect(i)} disabled={selected !== null} className={cls}>
              <span className="inline-block w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold text-center leading-6 mr-2">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
              {selected !== null && i === correctIdx && <span className="ml-2 text-green-600">✓</span>}
              {selected === i && i !== correctIdx && <span className="ml-2 text-red-500">✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
