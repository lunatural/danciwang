import { useState, useEffect, useRef } from "react";
import type { WordData, ExampleSentence } from "../utils/api";
import { translateToChinese } from "../utils/api";
import ClickableText from "./ClickableText";
import gsap from "gsap";

interface Props {
  data: WordData;
  examples: ExampleSentence[];
  /** Distractor info: { word, translation } */
  distractors: { word: string; translation: string }[];
  onResult: (correct: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  localTranslation?: string;
}

export default function QuizChoice({ data, examples, distractors, onResult, onNext, onPrev, localTranslation }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [optionWords, setOptionWords] = useState<string[]>([]); // source word for each option
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [cnMap, setCnMap] = useState<Record<string, string>>({});
  const [sentenceCNFailed, setSentenceCNFailed] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const resultCalled = useRef(false);

  const word = data.word;
  const meanings = data.meanings || [];
  const definition = meanings[0]?.definitions[0]?.definition || "";
  const partOfSpeech = meanings[0]?.partOfSpeech || "";

  // Strip POS abbreviations like "vt.", "n.", "vt.& vi.", "v. & n." from translation text
  function stripPOS(text: string): string {
    return text.replace(/^((vt|vi|v|n|adj|adv|prep|conj|pron|art|int|aux|abbr)\.\s*([&,]\s*(vt|vi|v|n|adj|adv|prep|conj|pron|art|int|aux|abbr)\.)?)\s*/gi, "").trim();
  }

  useEffect(() => {
    let cancelled = false;

    const build = async () => {
      // Try local cache first, then translate the word itself (not the long definition)
      // Word-level translation works with Baidu sug API which is a dictionary API
      const correctCN = localTranslation || await translateToChinese(word);
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

      const strippedCN = stripPOS(correctCN);
      const correct = allItems.findIndex((item) => item.translation === strippedCN);
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
      for (const d of (m.definitions || []).slice(0, 3)) {
        if (d.definition) defs.push(d.definition);
      }
    }
    if (defs.length === 0) return;
    let cancelled = false;
    // Try sentence-level translation for each definition. If MyMemory is rate-limited,
    // show word-level translation at top rather than repeating it for every definition.
    Promise.all(defs.map((d) => translateToChinese(d))).then((results) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      const allFailed = results.every((r) => !r);
      if (allFailed) {
        setSentenceCNFailed(true);
      } else {
        setSentenceCNFailed(false);
        defs.forEach((d, i) => { if (results[i]) map[d] = results[i]; });
      }
      setCnMap(map);
    });
    return () => { cancelled = true; };
  }, [showDetail, data.word]);

  const handleSelect = (idx: number) => {
    if (showDetail) return;
    setSelected(idx);
    setShowDetail(true);
    // 立即记录结果（不再等"下一题"按钮）
    resultCalled.current = true;
    onResult(idx === correctIdx);
  };

  // 重置状态（切换单词时）
  useEffect(() => {
    resultCalled.current = false;
  }, [data.word]);

  const isCorrect = selected === correctIdx;

  const animating = useRef(false);
  const DRAG_THRESHOLD = 60;

  const handleDragStart = (clientX: number, clientY: number) => {
    if (animating.current) return;
    const el = detailRef.current;
    // 移除 CSS 动画类，释放 transform 控制权给 GSAP
    if (el) {
      el.classList.remove("animate-fade-in-up");
      el.style.animation = "none";
      el.offsetHeight; // 强制重排，确保 animation 已移除
      gsap.set(el, { transformOrigin: "center center" });
    }
    dragStartRef.current = { x: clientX, y: clientY };
    gsap.set(el, { boxShadow: "0 15px 40px rgba(0,0,0,0.15)" });
    setIsDragging(true);
  };

  const handleDragMove = (clientX: number) => {
    if (!dragStartRef.current || animating.current) return;
    const delta = clientX - dragStartRef.current.x;
    const deltaY = dragStartRef.current ? 0 : 0;
    // 加一点阻力，越拖越慢
    const damped = delta * (1 - Math.min(Math.abs(delta) / 600, 0.4));
    // 加旋转倾斜效果，让拖拽更有"物理感"
    const rotate = delta / 18;
    gsap.set(detailRef.current, { x: damped, rotation: rotate });
    setDragOffset(damped);
  };

  const handleDragEnd = (clientX: number, clientY: number) => {
    if (!dragStartRef.current || animating.current) return;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    const el = detailRef.current;
    dragStartRef.current = null;
    // 不在动画前调用 setIsDragging(false)，避免 React 重渲染覆盖 GSAP 动画

    if (Math.abs(deltaX) > DRAG_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      animating.current = true;
      const goNext = deltaX < 0;
      const flyX = goNext ? -el!.offsetWidth : el!.offsetWidth;
      gsap.to(el, {
        x: flyX,
        rotation: goNext ? -30 : 30,
        opacity: 0,
        scale: 0.6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        duration: 0.5,
        ease: "power3.in",
        onComplete: () => {
          setIsDragging(false);
          setDragOffset(0);
          gsap.set(el, { clearProps: "all" });
          animating.current = false;
          goNext ? onNext() : onPrev();
        },
      });
    } else {
      gsap.to(el, {
        x: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        duration: 0.35,
        ease: "elastic.out(1, 0.4)",
        onComplete: () => {
          setIsDragging(false);
          setDragOffset(0);
          gsap.set(el, { clearProps: "all" });
        },
      });
    }
  };

  const touchHandlers = {
    onTouchStart: (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY),
  };

  const mouseHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      handleDragStart(e.clientX, e.clientY);
      const handleMouseMove = (ev: MouseEvent) => handleDragMove(ev.clientX);
      const handleMouseUp = (ev: MouseEvent) => {
        handleDragEnd(ev.clientX, ev.clientY);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
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
        <div
          ref={detailRef}
          className="glass rounded-2xl p-4 sm:p-5 space-y-3 animate-fade-in-up select-none cursor-grab active:cursor-grabbing"
          style={{
            opacity: isDragging ? 0.7 : 1,
          }}
          {...touchHandlers}
          {...mouseHandlers}
        >
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
            {sentenceCNFailed && localTranslation && (
              <p className="text-sm text-purple-600 font-medium text-center py-1">
                {localTranslation}
              </p>
            )}
            {meanings.map((m, mi) => (
              <div key={mi} className="border-b border-purple-100 last:border-0 pb-2 last:pb-0">
                {m.partOfSpeech && (
                  <span className="inline-block text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded mb-1">
                    {m.partOfSpeech}
                  </span>
                )}
                <ul className="space-y-1">
                  {(m.definitions || []).slice(0, 4).map((d, di) => (
                    <li key={di} className="text-xs text-gray-700">
                      <span className="font-medium text-purple-500">{di + 1}.</span>{" "}
                      <ClickableText text={d.definition || ""} />
                      {cnMap[d.definition] && (
                        <span className="text-gray-800 ml-1">{cnMap[d.definition]}</span>
                      )}
                      {d.example && (
                        <span className="text-gray-400 block ml-3 mt-0.5 italic">
                          "<ClickableText text={d.example} />"
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {(m.synonyms || []).length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    近义：{(m.synonyms || []).slice(0, 6).join("、")}
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

          {/* 滑动提示 + 按钮 */}
          <div className="pt-1">
            <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
              <span>← 右滑上一题</span>
              <span>左滑下一题 →</span>
            </div>
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
        </div>
      )}
    </div>
  );
}
