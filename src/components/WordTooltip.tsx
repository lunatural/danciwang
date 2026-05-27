import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { fetchWord, translateToChinese, type WordData } from "../utils/api";

export interface WordTooltipAnchor {
  word: string;
  isPhrase?: boolean;
  phraseMeaning?: string;
  anchor: DOMRect;
  onClose: () => void;
  navigateFrom: string;
}

export function WordTooltip({ word, isPhrase, phraseMeaning, anchor, onClose, navigateFrom }: WordTooltipAnchor) {
  const [data, setData] = useState<WordData | null>(null);
  const [cnWord, setCnWord] = useState("");
  const [cnDef, setCnDef] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, elemX: 0, elemY: 0 });

  useEffect(() => {
    setCnWord("");
    setCnDef("");
    setLoading(true);
    setData(null);
    setPos(null);

    if (isPhrase && phraseMeaning) {
      setLoading(false);
      return;
    }
    fetchWord(word).then((d) => {
      setData(d);
      if (d) {
        const def = d.meanings[0]?.definitions[0]?.definition || "";
        translateToChinese(word).then((cn) => { if (cn) setCnWord(cn); });
        if (def && def !== word) {
          translateToChinese(def).then((cn) => { if (cn) setCnDef(cn); });
        }
      }
      setLoading(false);
    });
  }, [word, isPhrase, phraseMeaning]);

  const definition = data?.meanings[0]?.definitions[0]?.definition || "";
  const partOfSpeech = data?.meanings[0]?.partOfSpeech || "";
  const phonetic = data?.phonetic || "";

  const padding = 12;
  const maxWidth = 280;
  const initialLeft = (() => {
    let left = anchor.right + 8;
    if (left + maxWidth > window.innerWidth - padding) {
      left = anchor.left - maxWidth - 8;
    }
    if (left < padding) {
      left = Math.max(padding, anchor.left);
    }
    return left;
  })();
  const initialTop = (() => {
    let top = anchor.top;
    if (initialLeft === Math.max(padding, anchor.left) && initialLeft + maxWidth > window.innerWidth - padding) {
      top = anchor.bottom + 8;
    }
    if (top + 200 > window.innerHeight - padding) {
      top = anchor.top - 200 - 8;
    }
    if (top < padding) top = padding;
    return top;
  })();

  const left = pos ? pos.x : initialLeft;
  const top = pos ? pos.y : initialTop;

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elemX: pos?.x ?? initialLeft,
      elemY: pos?.y ?? initialTop,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.mouseX;
    const dy = e.clientY - dragStart.current.mouseY;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - maxWidth, dragStart.current.elemX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 60, dragStart.current.elemY + dy)),
    });
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  const handleLookup = () => {
    navigate("/search", { state: { query: word, from: navigateFrom } });
    onClose();
  };

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-50 glass-strong rounded-2xl p-3 w-64 sm:w-72 select-none"
      style={{ left, top, maxWidth, touchAction: "none" }}
      onClick={(e) => e.stopPropagation()}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="flex items-center justify-between cursor-grab active:cursor-grabbing pb-1.5 mb-1.5 border-b border-gray-100/50"
        onPointerDown={handlePointerDown}
      >
        <span className="text-[10px] text-gray-300">拖拽移动</span>
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-gray-500 shrink-0 ml-1 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-xs text-center py-2">加载中...</p>
      ) : isPhrase ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold text-purple-700 truncate">{word}</span>
          </div>
          <span className="inline-block bg-green-100 text-green-600 px-1.5 py-0.5 rounded text-xs">
            词组
          </span>
          {phraseMeaning && (
            <p className="text-gray-700 text-xs leading-relaxed">{phraseMeaning}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleLookup}
              className="flex-1 text-xs bg-purple-500 hover:bg-purple-600 text-white py-1.5 rounded-lg font-medium transition-colors"
            >
              查看详情
            </button>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold text-purple-700 truncate">{word}</span>
            {cnWord && (
              <span className="text-gray-400 text-xs truncate">{cnWord}</span>
            )}
            {phonetic && (
              <span className="text-gray-400 text-xs truncate">{phonetic}</span>
            )}
          </div>
          {partOfSpeech && (
            <span className="inline-block bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded text-xs">
              {partOfSpeech}
            </span>
          )}
          {definition && (
            <>
              <p className="text-gray-700 text-xs leading-relaxed">{definition}</p>
              {cnDef && (
                <p className="text-gray-400 text-xs leading-relaxed">{cnDef}</p>
              )}
            </>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleLookup}
              className="flex-1 text-xs bg-purple-500 hover:bg-purple-600 text-white py-1.5 rounded-lg font-medium transition-colors"
            >
              查看详情
            </button>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-xs text-center py-2">未找到释义</p>
      )}
    </div>,
    document.body
  );
}
