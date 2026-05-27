import { useState, useEffect } from "react";
import type { WordData, SynonymData, ExampleSentence } from "../utils/api";
import { fetchSynonyms, fetchExampleSentences, translateToChinese } from "../utils/api";
import { analyzeWordRoots } from "../utils/wordRoots";
import ClickableText from "./ClickableText";

interface Props {
  data: WordData;
  isAdded: boolean;
  onAdd: () => void;
  examples?: ExampleSentence[];
}

export default function WordCard({ data, isAdded, onAdd, examples: propExamples }: Props) {
  const [synonyms, setSynonyms] = useState<SynonymData | null>(null);
  const [cnTranslations, setCnTranslations] = useState<Record<string, string>>({});
  const [examples, setExamples] = useState<ExampleSentence[]>(propExamples || []);
  const wordRoots = analyzeWordRoots(data.word);

  useEffect(() => {
    fetchSynonyms(data.word).then(setSynonyms);
    if (!propExamples || propExamples.length === 0) {
      fetchExampleSentences(data.word).then(setExamples);
    } else {
      setExamples(propExamples);
    }
  }, [data.word]);

  useEffect(() => {
    const defs: string[] = [];
    for (const m of data.meanings) {
      for (const d of m.definitions.slice(0, 2)) {
        if (d.definition) defs.push(d.definition);
      }
    }
    if (defs.length === 0) return;
    Promise.all(defs.map((d) => translateToChinese(d))).then((results) => {
      const map: Record<string, string> = {};
      defs.forEach((d, i) => {
        if (results[i]) map[d] = results[i];
      });
      setCnTranslations(map);
    });
  }, [data]);

  const hasRoots = wordRoots.prefixes.length > 0 || wordRoots.roots.length > 0 || wordRoots.suffixes.length > 0;
  const allSynonyms = synonyms?.synonyms || [];
  const apiSynonyms = data.meanings.flatMap((m) => m.synonyms);
  const combinedSynonyms = [...new Set([...allSynonyms, ...apiSynonyms])];

  return (
    <div className="glass-raised rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-purple-700">{data.word}</h2>
          {data.phonetic && (
            <p className="text-gray-500 mt-1 text-xs sm:text-sm">{data.phonetic}</p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {data.audio && (
            <audio key={data.word} controls className="h-7 sm:h-8 w-28 sm:w-36">
              <source src={data.audio} type="audio/mpeg" />
            </audio>
          )}
          <button
            onClick={onAdd}
            disabled={isAdded}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-medium text-xs sm:text-sm transition-colors ${
              isAdded
                ? "bg-green-100/70 text-green-600 cursor-default"
                : "bg-purple-500/80 backdrop-blur-sm hover:bg-purple-500/90 text-white border border-white/30"
            }`}
          >
            {isAdded ? "已添加" : "加入单词本"}
          </button>
        </div>
      </div>

      {data.meanings.map((m, i) => (
        <div key={i}>
          <span className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
            {m.partOfSpeech}
          </span>
          <ul className="space-y-1.5 sm:space-y-2">
            {m.definitions.slice(0, 4).map((d, j) => (
              <li key={j} className="text-gray-700 text-xs sm:text-sm">
                <span className="font-medium text-purple-600">{j + 1}.</span>{" "}
                <ClickableText text={d.definition} />
                {cnTranslations[d.definition] && (
                  <span className="text-gray-400 ml-1">{cnTranslations[d.definition]}</span>
                )}
                {d.example && (
                  <span className="text-gray-400 block ml-4 mt-0.5 italic text-xs">
                    "<ClickableText text={d.example} />"
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {combinedSynonyms.length > 0 && (
        <div className="bg-purple-50/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-purple-100/50">
          <p className="text-xs sm:text-sm font-medium text-purple-700 mb-1.5 sm:mb-2">近义词 Synonyms</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {combinedSynonyms.slice(0, 15).map((s) => (
              <span
                key={s}
                className="bg-white text-purple-600 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm border border-purple-200"
              >
                <ClickableText text={s} />
              </span>
            ))}
          </div>
        </div>
      )}

      {examples.length > 0 && (
        <div className="bg-blue-50/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-blue-100/50">
          <p className="text-xs sm:text-sm font-medium text-blue-700 mb-2">例句 Examples</p>
          <ul className="space-y-2 sm:space-y-2.5">
            {examples.slice(0, 6).map((ex, i) => (
              <li key={i} className="text-xs sm:text-sm">
                <p className="text-gray-800 italic">"<ClickableText text={ex.english} />"</p>
                {ex.chinese && (
                  <p className="text-blue-600 mt-0.5 ml-2">{ex.chinese}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasRoots && (
        <div className="bg-amber-50/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-amber-100/50">
          <p className="text-xs sm:text-sm font-medium text-amber-700 mb-1.5 sm:mb-2">词根分析 Word Roots</p>
          <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
            {wordRoots.prefixes.map((p) => (
              <div key={p.root} className="flex gap-2">
                <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-mono text-xs whitespace-nowrap">{p.root}</span>
                <span className="text-gray-600">前缀：{p.meaningCn}（{p.meaning}）</span>
              </div>
            ))}
            {wordRoots.roots.map((r) => (
              <div key={r.root} className="flex gap-2">
                <span className="bg-green-200 text-green-800 px-2 py-0.5 rounded font-mono text-xs whitespace-nowrap">{r.root}</span>
                <span className="text-gray-600">词根：{r.meaningCn}（{r.meaning}）</span>
              </div>
            ))}
            {wordRoots.suffixes.map((s) => (
              <div key={s.root} className="flex gap-2">
                <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-mono text-xs whitespace-nowrap">{s.root}</span>
                <span className="text-gray-600">后缀：{s.meaningCn}（{s.meaning}）</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
