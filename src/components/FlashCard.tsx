import { useState, useEffect } from "react";
import type { WordData } from "../utils/api";
import { translateToChinese } from "../utils/api";

interface Props {
  data: WordData;
  flipped: boolean;
  onClick: () => void;
}

export default function FlashCard({ data, flipped, onClick }: Props) {
  const [cnDef, setCnDef] = useState("");
  const definition = data.meanings[0]?.definitions[0]?.definition || "暂无释义";
  const partOfSpeech = data.meanings[0]?.partOfSpeech || "";
  const synonyms = data.meanings[0]?.synonyms?.slice(0, 5) || [];
  const example = data.meanings[0]?.definitions[0]?.example || "";

  useEffect(() => {
    translateToChinese(definition).then(setCnDef);
  }, [definition]);

  return (
    <div className="flip-card w-full max-w-md mx-auto h-72 cursor-pointer" onClick={onClick}>
      <div className={`flip-card-inner relative w-full h-full ${flipped ? "flipped" : ""}`}>
        <div className="flip-card-front absolute inset-0 bg-white rounded-2xl shadow-lg flex flex-col items-center justify-center p-6 border-2 border-purple-200">
          <p className="text-4xl font-bold text-purple-700 mb-4">{data.word}</p>
          {data.phonetic && (
            <p className="text-gray-400 text-lg">{data.phonetic}</p>
          )}
          <p className="text-gray-300 text-xs mt-6">点击翻转查看释义</p>
        </div>
        <div className="flip-card-back absolute inset-0 bg-purple-50 rounded-2xl shadow-lg flex flex-col items-center justify-center p-6 border-2 border-purple-200 overflow-y-auto">
          <p className="text-xl font-bold text-purple-700 mb-1">{data.word}</p>
          {partOfSpeech && (
            <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded mb-2">
              {partOfSpeech}
            </span>
          )}
          <p className="text-gray-800 text-base text-center leading-relaxed mb-1">
            {definition}
          </p>
          {cnDef && (
            <p className="text-purple-500 text-sm text-center mb-2">{cnDef}</p>
          )}
          {example && (
            <p className="text-gray-400 text-xs text-center italic mb-2">"{example}"</p>
          )}
          {synonyms.length > 0 && (
            <p className="text-gray-500 text-xs text-center">
              近义：{synonyms.join("、")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
