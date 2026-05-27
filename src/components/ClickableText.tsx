import { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { detectPhrase, getPhraseMeaning } from "../utils/api";
import { WordTooltip } from "./WordTooltip";

interface ClickableTextProps {
  text: string;
  className?: string;
}

export default function ClickableText({ text, className = "" }: ClickableTextProps) {
  const [tooltip, setTooltip] = useState<{
    word: string;
    isPhrase?: boolean;
    phraseMeaning?: string;
    anchor: DOMRect;
  } | null>(null);
  const location = useLocation();
  const navigateFrom = location.pathname + location.search;

  const handleWordClick = useCallback(
    (word: string, anchor: DOMRect, allWords: string[], wordIdx: number) => {
      const phrase = detectPhrase(allWords, wordIdx);
      if (phrase) {
        const meaning = getPhraseMeaning(phrase);
        setTooltip({ word: phrase, isPhrase: true, phraseMeaning: meaning, anchor });
      } else {
        setTooltip({ word, anchor });
      }
    },
    []
  );

  const closeTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const segments = text.split(/([a-zA-Z]+)/g);

  const wordSegments: { word: string; segIdx: number }[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (/^[a-zA-Z]+$/.test(segments[i])) {
      wordSegments.push({ word: segments[i], segIdx: i });
    }
  }

  return (
    <>
      <span className={className}>
        {segments.map((seg, i) =>
          /^[a-zA-Z]+$/.test(seg) ? (
            <span
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                const wsIdx = wordSegments.findIndex((ws) => ws.segIdx === i);
                handleWordClick(
                  seg,
                  rect,
                  wordSegments.map((ws) => ws.word),
                  wsIdx
                );
              }}
              className="cursor-pointer text-purple-600 hover:text-purple-800 hover:underline underline-offset-2 transition-colors"
              title={`点击查看 "${seg}" 的释义`}
            >
              {seg}
            </span>
          ) : (
            <span key={i}>{seg}</span>
          )
        )}
      </span>
      {tooltip && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeTooltip} />
          <WordTooltip
            word={tooltip.word}
            isPhrase={tooltip.isPhrase}
            phraseMeaning={tooltip.phraseMeaning}
            anchor={tooltip.anchor}
            onClose={closeTooltip}
            navigateFrom={navigateFrom}
          />
        </>
      )}
    </>
  );
}
