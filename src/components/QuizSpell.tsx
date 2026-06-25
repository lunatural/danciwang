import { useState, useEffect, useRef } from "react";
import type { WordData, ExampleSentence } from "../utils/api";
import { translateToChinese } from "../utils/api";
import ClickableText from "./ClickableText";

interface Props {
  data: WordData;
  examples: ExampleSentence[];
  onResult: (correct: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  localTranslation?: string;
}

export default function QuizSpell({ data, examples, onResult, onNext, onPrev, localTranslation }: Props) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [cnDef, setCnDef] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const word = data.word;
  const definition = data.meanings[0]?.definitions[0]?.definition || "";
  const partOfSpeech = data.meanings[0]?.partOfSpeech || "";
  const hint = word.charAt(0).toUpperCase() + "_ ".repeat(word.length - 1).trim();

  useEffect(() => {
    if (localTranslation) {
      setCnDef(localTranslation);
    } else {
      translateToChinese(word).then(setCnDef);
    }
  }, [definition, localTranslation]);

  useEffect(() => {
    if (!submitted) inputRef.current?.focus();
  }, [submitted]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const isCorrect = input.trim().toLowerCase() === word.toLowerCase();
    setCorrect(isCorrect);
    setSubmitted(true);
    onResult(isCorrect);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (submitted) onNext();
      else handleSubmit();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="text-center">
        <p className="text-xs text-blue-400 font-medium mb-1">拼写题 · 根据释义写出单词</p>
      </div>

      {/* Definition prompt */}
      <div className="bg-blue-50/60 rounded-xl p-4 sm:p-5 text-center space-y-2">
        <p className="text-gray-700 text-sm sm:text-base font-medium">{cnDef || definition}</p>
        {partOfSpeech && (
          <span className="inline-block text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
            {partOfSpeech}
          </span>
        )}
        {!submitted && (
          <p className="text-gray-400 text-xs mt-2">
            提示：<span className="font-mono text-purple-500 font-bold tracking-wider">{hint}</span>
            {" · "}{word.length} 个字母
          </p>
        )}
      </div>

      {/* Input area */}
      {!submitted ? (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入英文单词..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 px-4 py-3 rounded-xl bg-white/60 border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white/80 text-sm font-medium tracking-wide"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="px-5 py-3 bg-purple-500/80 text-white rounded-xl font-medium text-sm hover:bg-purple-500/90 disabled:opacity-40 transition-all"
          >
            确认
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Result */}
          <div className={`rounded-xl p-4 text-center ${correct ? "bg-green-50" : "bg-red-50"}`}>
            {correct ? (
              <p className="text-green-600 font-medium">
                ✓ 正确！<span className="font-bold text-lg ml-2">{word}</span>
              </p>
            ) : (
              <div>
                <p className="text-red-500 text-sm">✗ 你的答案：<span className="line-through">{input.trim()}</span></p>
                <p className="text-green-600 font-medium mt-1">
                  正确答案：<span className="font-bold text-lg">{word}</span>
                </p>
              </div>
            )}
          </div>

          {/* Example sentences for context */}
          {examples.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 text-xs sm:text-sm">
              <p className="text-gray-400 mb-1.5">例句帮助记忆：</p>
              {examples.slice(0, 2).map((ex, i) => (
                <div key={i} className="mb-1.5">
                  <p className="text-gray-700 italic">
                    "<ClickableText text={ex.english} />"
                  </p>
                  {ex.chinese && <p className="text-blue-500 mt-0.5">{ex.chinese}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={onPrev}
              className="flex-1 py-2 px-3 bg-gray-200/60 hover:bg-gray-200/80 text-gray-600 rounded-xl text-xs font-medium transition-all">
              ← 上一题
            </button>
            <button onClick={onNext}
              className="flex-1 py-2 px-3 bg-purple-500/80 hover:bg-purple-500/90 text-white rounded-xl text-xs font-medium transition-all">
              下一题 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
