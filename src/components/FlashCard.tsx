import { useState, useEffect, useRef } from "react";
import type { WordData, ExampleSentence } from "../utils/api";
import { translateToChinese } from "../utils/api";
import ClickableText from "./ClickableText";
import gsap from "gsap";

interface Props {
  data: WordData;
  flipped: boolean;
  onClick: () => void;
  examples?: ExampleSentence[];
}

function FlipArrow({ position }: { position: "left" | "right" }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: position === "left" ? "scaleX(-1)" : "none" }}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 9 9" />
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9" />
      <polyline points="15 8 21 12 15 16" />
    </svg>
  );
}

const faceGlass = {
  background: "rgba(255, 255, 255, 0.65)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255, 255, 255, 0.55)",
  boxShadow:
    "0 8px 30px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.85)",
};

export default function FlashCard({ data, flipped, onClick, examples = [] }: Props) {
  const [cnDef, setCnDef] = useState("");
  const hintRef = useRef<HTMLParagraphElement>(null);
  const transitioningRef = useRef(false);
  const innerRef = useRef<HTMLDivElement>(null);

  const definition = data.meanings[0]?.definitions[0]?.definition || "暂无释义";
  const partOfSpeech = data.meanings[0]?.partOfSpeech || "";
  const synonyms = data.meanings[0]?.synonyms?.slice(0, 5) || [];
  const example = data.meanings[0]?.definitions[0]?.example || "";

  useEffect(() => {
    translateToChinese(definition).then(setCnDef);
  }, [definition]);

  useEffect(() => {
    if (!hintRef.current) return;
    gsap.to(hintRef.current, {
      opacity: 0.4,
      duration: 1.2,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
    });
    return () => {
      if (hintRef.current) gsap.killTweensOf(hintRef.current);
    };
  }, []);

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target === innerRef.current) {
      transitioningRef.current = false;
    }
  };

  const handleFlip = () => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    onClick();
  };

  return (
    <div
      className="flip-card relative w-full max-w-md mx-auto min-h-[200px] h-[50vh] max-h-[360px] sm:h-[55vh] sm:max-h-[400px]"
      style={{ touchAction: "manipulation" }}
    >
      {/* Corner flip buttons */}
      <div
        onClick={handleFlip}
        className="absolute top-0 left-0 z-30 w-12 h-12 flex items-start justify-start p-2 text-gray-300 active:text-purple-400 transition-colors cursor-pointer select-none"
        style={{ touchAction: "manipulation" }}
      >
        <FlipArrow position="left" />
      </div>
      <div
        onClick={handleFlip}
        className="absolute top-0 right-0 z-30 w-12 h-12 flex items-start justify-end p-2 text-gray-300 active:text-purple-400 transition-colors cursor-pointer select-none"
        style={{ touchAction: "manipulation" }}
      >
        <FlipArrow position="right" />
      </div>

      <div
        ref={innerRef}
        className={`flip-card-inner relative w-full h-full ${flipped ? "flipped" : ""}`}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Front face — pointer-events-none, no hover transform */}
        <div
          className="flip-card-front absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-4 sm:p-6 pointer-events-none"
          style={faceGlass}
        >
          <p className="text-3xl sm:text-4xl font-bold text-purple-700 mb-3 sm:mb-4">{data.word}</p>
          {data.phonetic && (
            <p className="text-gray-400 text-base sm:text-lg">{data.phonetic}</p>
          )}
          <p ref={hintRef} className="text-gray-300 text-xs mt-6">
            点击角落翻转
          </p>
        </div>

        {/* Back face — no hover transform */}
        <div
          className="flip-card-back absolute inset-0 rounded-2xl flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto"
          style={faceGlass}
        >
          <p className="text-lg sm:text-xl font-bold text-purple-700 mb-1 mt-1">{data.word}</p>
          {partOfSpeech && (
            <span className="text-xs bg-purple-200/70 text-purple-700 px-2 py-0.5 rounded mb-1.5 sm:mb-2">
              {partOfSpeech}
            </span>
          )}
          <p className="text-gray-800 text-sm sm:text-base text-center leading-relaxed mb-1">
            <ClickableText text={definition} />
          </p>
          {cnDef && (
            <p className="text-gray-400 text-xs sm:text-sm text-center mb-1.5 sm:mb-2">{cnDef}</p>
          )}
          {example && (
            <p className="text-gray-400 text-xs text-center italic mb-1.5 sm:mb-2">
              "<ClickableText text={example} />"
            </p>
          )}
          {examples.length > 0 && (
            <div className="border-t border-purple-200/50 pt-1.5 sm:pt-2 mt-1 w-full px-2">
              {examples.map((ex, i) => (
                <div key={i} className="mb-1.5 sm:mb-2">
                  <p className="text-gray-700 text-xs text-center italic">
                    "<ClickableText text={ex.english} />"
                  </p>
                  {ex.chinese && (
                    <p className="text-blue-500 text-xs text-center mt-0.5">{ex.chinese}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {synonyms.length > 0 && (
            <p className="text-gray-500 text-xs text-center">
              近义：
              {synonyms.map((s, i) => (
                <span key={s}>
                  {i > 0 && "、"}
                  <ClickableText text={s} />
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
