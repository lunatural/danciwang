import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getWords, addWord, addToLearning, removeWord, removeGroup, getReviewSchedule, removeReviewSchedule } from "../hooks/useData";
import { getVocabLists, getVocabList } from "../utils/api";

export default function WordList() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<{ name: string; words: string[] }[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const handleRemoveWord = (word: string) => {
    if (!user) return;
    removeWord(user.id, word);
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
    const existing = new Set(getWords(user.id).map((w) => w.word));
    let added = 0;
    for (const w of listWords) {
      if (!existing.has(w)) {
        addWord(user.id, w, listName);
        addToLearning(user.id, w);
        existing.add(w);
        added++;
      }
    }
    setImportMessage(`从「${listName}」导入了 ${added} 个新单词`);
    loadWords();
    setTimeout(() => setImportMessage(""), 3000);
  };

  const lists = getVocabLists();
  const totalWords = groups.reduce((sum, g) => sum + g.words.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-purple-700">我的单词本</h1>
          <p className="text-sm text-gray-400 mt-1">
            {groups.length} 个分组，共 {totalWords} 个单词
          </p>
        </div>
        <button
          onClick={() => setShowImport(!showImport)}
          className="px-4 py-2 bg-purple-100 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-200 transition-colors"
        >
          导入词汇表
        </button>
      </div>

      {importMessage && (
        <div className="bg-green-50 text-green-600 border border-green-200 rounded-xl px-4 py-3 text-sm">
          {importMessage}
        </div>
      )}

      {showImport && (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <p className="text-sm text-gray-500 mb-2">选择要导入的词汇表：</p>
          <div className="grid grid-cols-2 gap-2">
            {lists.map((list) => (
              <button
                key={list.name}
                onClick={() => handleImport(list.name)}
                className="text-left px-4 py-3 rounded-xl border border-purple-200 hover:bg-purple-50 transition-colors"
              >
                <span className="text-sm font-medium text-purple-700">
                  {list.name}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  {list.count} 词
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center text-gray-400 py-10">
          还没有添加单词，去「查单词」页面搜索并添加吧
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.name);
            return (
              <div
                key={group.name}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 hover:bg-purple-50/50 transition-colors">
                  <button
                    onClick={() => toggleGroup(group.name)}
                    className="flex items-center gap-2 text-left flex-1"
                  >
                    <span className="text-sm text-gray-400">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    <span className="font-medium text-gray-800">
                      {group.name}
                    </span>
                    <span className="bg-purple-100 text-purple-600 text-xs px-2 py-0.5 rounded-full">
                      {group.words.length} 词
                    </span>
                  </button>
                  {confirmDelete === group.name ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-500">确认删除？</span>
                      <button
                        onClick={() => handleRemoveGroup(group.name)}
                        className="text-xs px-2 py-1 bg-red-500 text-white rounded"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(group.name)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1"
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
                        className="flex items-center justify-between px-6 py-2.5 hover:bg-gray-50"
                      >
                        <span className="text-sm text-gray-700">{word}</span>
                        <button
                          onClick={() => handleRemoveWord(word)}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
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
