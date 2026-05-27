import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getWords, addWord, addToLearning, removeWord, removeGroup, getReviewSchedule, removeReviewSchedule, batchImportWords } from "../hooks/useData";
import { getVocabLists, getVocabList } from "../utils/api";
import { ChevronDown, ChevronRight, Upload, Database } from "lucide-react";
import { importAnkiData, parseAnkiFile, getAnkiDecks, removeAllAnkiData, type AnkiNote } from "../utils/ankiParser";

export default function WordList() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<{ name: string; words: string[] }[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [ankiDecks, setAnkiDecks] = useState<{ name: string; count: number }[]>(getAnkiDecks);
  const [ankiLoading, setAnkiLoading] = useState(false);

  const handleAnkiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setAnkiLoading(true);
    try {
      const { deckName, notes } = await parseAnkiFile(file);
      // Import words into the word list
      if (user) {
        const words = notes
          .map((n) => n.fields["Word"] || n.fields[Object.keys(n.fields)[0]] || "")
          .filter((w) => w.length > 0 && /^[a-zA-Z]/.test(w));
        const uniqueWords = [...new Set(words)];
        batchImportWords(user.id, uniqueWords, deckName);
        loadWords();
        // Cache Anki data for search
        const ankiNotes: AnkiNote[] = notes.map((n) => ({
          fields: n.fields,
          tags: n.tags,
          guid: n.guid,
        }));
        importAnkiData(deckName, ankiNotes);
        setAnkiDecks(getAnkiDecks());
      }
      setImportMessage(`从 Anki 词库「${deckName}」导入了 ${new Set(notes.map((n) => n.fields["Word"] || n.fields[Object.keys(n.fields)[0]] || "").filter((w) => w.length > 0)).size} 个单词`);
      setTimeout(() => setImportMessage(""), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "文件解析失败";
      setImportMessage(`Anki 导入失败：${msg}`);
      setTimeout(() => setImportMessage(""), 4000);
    } finally {
      setAnkiLoading(false);
    }
  };

  const handleRemoveAnki = () => {
    removeAllAnkiData();
    setAnkiDecks([]);
    setImportMessage("已清除所有 Anki 词库数据");
    setTimeout(() => setImportMessage(""), 3000);
  };

  const loadWords = () => {
    if (!user) return;
    const map = new Map<string, string[]>();
    for (const w of getWords(user.id)) {
      const list = map.get(w.group) || [];
      list.push(w.word);
      map.set(w.group, list);
    }
    setGroups(
      Array.from(map.entries()).map(([name, wordList]) => ({
        name,
        words: wordList,
      }))
    );
  };

  useEffect(() => {
    loadWords();
  }, [user]);

  const handleRemoveWord = (word: string, group: string) => {
    if (!user) return;
    removeWord(user.id, word, group);
    const schedule = getReviewSchedule(user.id);
    const item = schedule.find((s) => s.word === word);
    if (item) removeReviewSchedule(user.id, item.id);
    loadWords();
  };

  const handleRemoveGroup = (group: string) => {
    if (!user) return;
    removeGroup(user.id, group);
    setConfirmDelete(null);
    loadWords();
  };

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleImport = (listName: string) => {
    if (!user) return;
    const listWords = getVocabList(listName);
    const added = batchImportWords(user.id, listWords, listName);
    setImportMessage(`从「${listName}」导入了 ${added} 个新单词`);
    loadWords();
    setTimeout(() => setImportMessage(""), 3000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const groupName = file.name.replace(/\.[^/.]+$/, "");

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      let words: string[] = [];

      if (file.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            words = parsed.map((w) => (typeof w === "string" ? w : w.word || ""));
          }
        } catch {
          setImportMessage("JSON 文件格式错误");
          setTimeout(() => setImportMessage(""), 3000);
          return;
        }
      } else {
        words = text
          .split(/[\r\n]+/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && /^[a-zA-Z]/.test(line));
      }

      const added = batchImportWords(user!.id, words, groupName);
      setImportMessage(`从「${groupName}」导入了 ${added} 个新单词`);
      loadWords();
      setTimeout(() => setImportMessage(""), 3000);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const lists = getVocabLists();
  const totalWords = groups.reduce((sum, g) => sum + g.words.length, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-purple-700">我的单词本</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
            {groups.length} 个分组，共 {totalWords} 个单词
          </p>
        </div>
        <button
          onClick={() => setShowImport(!showImport)}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-100/60 backdrop-blur-sm text-purple-600 rounded-xl text-xs sm:text-sm font-medium hover:bg-purple-200/70 transition-all border border-purple-100/50"
        >
          导入词汇表
        </button>
      </div>

      {importMessage && (
        <div className="bg-green-50 text-green-600 border border-green-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm">
          {importMessage}
        </div>
      )}

      {showImport && (
        <div className="glass rounded-2xl p-3 sm:p-4 space-y-2">
          <p className="text-xs sm:text-sm text-gray-500 mb-2">选择要导入的词汇表：</p>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {lists.map((list) => (
              <button
                key={list.name}
                onClick={() => handleImport(list.name)}
                className="text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-purple-200/50 hover:bg-purple-50/50 transition-all bg-white/40 backdrop-blur-sm"
              >
                <span className="text-xs sm:text-sm font-medium text-purple-700">
                  {list.name}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-400 ml-1 sm:ml-2">
                  {list.count} 词
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-2.5 sm:pt-3 mt-1">
            <label className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-500/80 backdrop-blur-sm hover:bg-purple-500/90 text-white rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer border border-white/30">
              <Upload size={14} strokeWidth={1.8} />
              <span>从本地文件导入</span>
              <input
                type="file"
                accept=".txt,.json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-1.5">
              支持 .txt（每行一个单词）或 .json（单词数组）
            </p>
          </div>
          <div className="border-t border-gray-100 pt-2.5 sm:pt-3 mt-1">
            <label className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-orange-400/80 backdrop-blur-sm hover:bg-orange-400/90 text-white rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer border border-white/30">
              <Database size={14} strokeWidth={1.8} />
              <span>{ankiLoading ? "解析中..." : "导入 Anki 词库 (.apkg)"}</span>
              <input
                type="file"
                accept=".apkg"
                onChange={handleAnkiImport}
                disabled={ankiLoading}
                className="hidden"
              />
            </label>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-1.5">
              支持 Anki .apkg 格式，单词会自动加入单词本并在搜索时作为数据源
            </p>
            {ankiDecks.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium">已导入的 Anki 词库：</p>
                {ankiDecks.map((deck) => (
                  <span key={deck.name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px] sm:text-xs mr-1 mb-1">
                    {deck.name} ({deck.count}词)
                  </span>
                ))}
                <button
                  onClick={handleRemoveAnki}
                  className="block text-[10px] sm:text-xs text-red-400 hover:text-red-600 transition-colors mt-1"
                >
                  清除所有 Anki 数据
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center text-gray-400 py-10 text-sm">
          还没有添加单词，去「查单词」页面搜索并添加吧
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.name);
            return (
              <div
                key={group.name}
                className="glass rounded-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-purple-50/30 transition-colors">
                  <button
                    onClick={() => toggleGroup(group.name)}
                    className="flex items-center gap-1.5 sm:gap-2 text-left flex-1 min-w-0"
                  >
                    <span className="text-gray-400 shrink-0 transition-transform duration-200">
                      {isExpanded ? <ChevronDown size={16} strokeWidth={1.8} /> : <ChevronRight size={16} strokeWidth={1.8} />}
                    </span>
                    <span className="font-medium text-gray-800 text-xs sm:text-sm truncate">
                      {group.name}
                    </span>
                    <span className="bg-purple-100 text-purple-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                      {group.words.length} 词
                    </span>
                  </button>
                  {confirmDelete === group.name ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                      <span className="text-[10px] sm:text-xs text-red-500">确认删除？</span>
                      <button
                        onClick={() => handleRemoveGroup(group.name)}
                        className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-500 text-white rounded"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-200 text-gray-600 rounded"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(group.name)}
                      className="text-[10px] sm:text-xs text-red-400 hover:text-red-600 transition-colors px-1.5 sm:px-2 py-0.5 sm:py-1 shrink-0"
                    >
                      删除整组
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {group.words.map((word) => (
                      <div
                        key={word}
                        className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-2.5 hover:bg-gray-50"
                      >
                        <span className="text-xs sm:text-sm text-gray-700">{word}</span>
                        <button
                          onClick={() => handleRemoveWord(word, group.name)}
                          className="text-[10px] sm:text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
