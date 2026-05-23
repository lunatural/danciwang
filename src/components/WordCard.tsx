import { useState, useEffect } from "react";
import type { WordData, SynonymData } from "../utils/api";
import { fetchSynonyms, translateToChinese } from "../utils/api";
import { analyzeWordRoots } from "../utils/wordRoots";

interface Props {
  data: WordData;
  isAdded: boolean;
  onAdd: () => void;
}

export default function WordCard({ data, isAdded, onAdd }: Props) {
  const [synonyms, setSynonyms] = useState<SynonymData | null>(null);
  const [cnTranslations, setCnTranslations] = useState<Record<string, string>>({});
  const wordRoots = analyzeWordRoots(data.word);

  useEffect(() => {
    fetchSynonyms(data.word).then(setSynonyms);
  }, [data.word]);

  useEffect(() => {
    async function translateDefs() {
      const map: Record<string, string> = {};
      for (const m of data.meanings) {
        for (const d of m.definitions.slice(0, 2)) {
          const cn = await translateToChinese(d.definition);
          if (cn) map[d.definition] = cn;
        }
      }
      setCnTranslations(map);
    }
    translateDefs();
  }, [data]);

  const hasRoots = wordRoots.prefixes.length > 0 || wordRoots.roots.length > 0 || wordRoots.suffixes.length > 0;
  const allSynonyms = synonyms?.synonyms || [];
  const apiSynonyms = data.meanings.flatMap((m) => m.synonyms);
  const combinedSynonyms = [...new Set([...allSynonyms, ...apiSynonyms])];

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-purple-700">{data.word}</h2>
          {data.phonetic && (
            <p className="text-gray-500 mt-1">{data.phonetic}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data.audio && (
            <audio key={data.word} controls className="h-8 w-36">
              <source src={data.audio} type="audio/mpeg" />
            </audio>
          )}
          <button
            onClick={onAdd}
            disabled={isAdded}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              isAdded
                ? "bg-green-100 text-green-600 cursor-default"
                : "bg-purple-500 hover:bg-purple-600 text-white"
            }`}
          >
            {isAdded ? "已添加" : "加入单词本"}
          </button>
        </div>
      </div>

      {data.meanings.map((m, i) => (
        <div key={i}>
          <span className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-sm font-medium mb-2">
            {m.partOfSpeech}
          </span>
          <ul className="space-y-2">
            {m.definitions.slice(0, 4).map((d, j) => (
              <li key={j} className="text-gray-700 text-sm">
                <span className="font-medium text-purple-600">{j + 1}.</span>{" "}
                {d.definition}
                {cnTranslations[d.definition] && (
                  <span className="text-purple-500 ml-1">{cnTranslations[d.definition]}</span>
                )}
                {d.example && (
                  <span className="text-gray-400 block ml-4 mt-0.5 italic">
                    "{d.example}"
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {combinedSynonyms.length > 0 && (
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-sm font-medium text-purple-700 mb-2">近义词 Synonyms</p>
          <div className="flex flex-wrap gap-2">
            {combinedSynonyms.slice(0, 15).map((s) => (
              <span
                key={s}
                className="bg-white text-purple-600 px-3 py-1 rounded-full text-sm border border-purple-200"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasRoots && (
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-700 mb-2">词根分析 Word Roots</p>
          <div className="space-y-2 text-sm">
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
