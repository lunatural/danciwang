import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { MessageSquare, Trash2, ChevronDown, ChevronUp, CheckCircle2, Circle, Shield } from "lucide-react";

// 管理员邮箱列表
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map((s: string) => s.trim()).filter(Boolean);

// 扩展类型（兼容旧的没有 resolved 字段的记录）
interface FeedbackEntry {
  id: string;
  word: string;
  source: string;
  errorType: string;
  userCorrection: string;
  createdAt: string;
  resolved?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  cambridge: "剑桥词典",
  "free-api": "Free Dictionary",
  oxford: "牛津词典",
  anki: "Anki 词库",
  unknown: "未知",
};

const ERROR_LABELS: Record<string, string> = {
  definition: "释义错误",
  phonetic: "音标错误",
  example: "例句错误",
  other: "其他问题",
};

export default function Feedback() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [corrections, setCorrections] = useState<FeedbackEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"pending" | "resolved">("pending");

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  // 非管理员跳回首页
  useEffect(() => {
    if (user && !isAdmin) {
      navigate("/", { replace: true });
    }
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = () => {
    const data = JSON.parse(localStorage.getItem("word_corrections") || "[]") as FeedbackEntry[];
    // 按已解决状态和时间排序（未解决的排前面）
    data.sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    setCorrections(data);
  };

  const saveAndReload = (updated: FeedbackEntry[]) => {
    localStorage.setItem("word_corrections", JSON.stringify(updated));
    loadFeedback();
  };

  const handleToggleResolved = (id: string) => {
    const updated = corrections.map((c) =>
      c.id === id ? { ...c, resolved: !c.resolved } : c
    );
    saveAndReload(updated);
  };

  const handleDelete = (id: string) => {
    const filtered = corrections.filter((c) => c.id !== id);
    saveAndReload(filtered);
  };

  const handleClearResolved = () => {
    const toRemove = corrections.filter((c) => c.resolved);
    if (toRemove.length === 0) return;
    if (!confirm(`确定要清除所有 ${toRemove.length} 条已解决的反馈吗？`)) return;
    const filtered = corrections.filter((c) => !c.resolved);
    saveAndReload(filtered);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleExport = () => {
    const json = JSON.stringify(corrections, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `word_feedback_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredItems = useMemo(
    () => corrections.filter((c) => (filter === "pending" ? !c.resolved : c.resolved)),
    [corrections, filter]
  );

  const pendingCount = corrections.filter((c) => !c.resolved).length;
  const resolvedCount = corrections.filter((c) => c.resolved).length;

  if (!isAdmin) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-purple-700 flex items-center gap-2">
          <Shield size={22} strokeWidth={1.8} />
          反馈管理
          <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">管理员</span>
        </h1>
        {corrections.length > 0 && (
          <div className="flex gap-1.5">
            <button onClick={handleExport}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors">
              导出
            </button>
            {resolvedCount > 0 && (
              <button onClick={handleClearResolved}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
                清除已解决({resolvedCount})
              </button>
            )}
          </div>
        )}
      </div>

      {/* 筛选 tab */}
      {corrections.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === "pending"
                ? "bg-orange-500/80 text-white"
                : "bg-white/50 text-gray-500 border border-white/40 hover:bg-white/70"
            }`}
          >
            待处理 ({pendingCount})
          </button>
          <button
            onClick={() => setFilter("resolved")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === "resolved"
                ? "bg-green-500/80 text-white"
                : "bg-white/50 text-gray-500 border border-white/40 hover:bg-white/70"
            }`}
          >
            已解决 ({resolvedCount})
          </button>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={48} strokeWidth={1.2} className="mx-auto mb-3 text-purple-200" />
          <p className="text-gray-500 text-sm">
            {filter === "pending" ? "没有待处理的反馈" : "没有已解决的反馈"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              {/* Header */}
              <button
                onClick={() => toggleExpand(c.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {c.resolved ? (
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                  ) : (
                    <Circle size={16} className="text-orange-400 shrink-0" />
                  )}
                  <span className="text-sm font-bold text-purple-600 truncate">{c.word}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                    {SOURCE_LABELS[c.source] || c.source}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 shrink-0">
                    {ERROR_LABELS[c.errorType] || c.errorType}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-400">
                    {new Date(c.createdAt).toLocaleString("zh-CN", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                  {expanded.has(c.id) ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* Detail */}
              {expanded.has(c.id) && (
                <div className="px-4 pb-3 border-t border-gray-50">
                  <p className="text-xs text-gray-500 mt-2 mb-1">用户反馈：</p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                    {c.userCorrection}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => handleToggleResolved(c.id)}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        c.resolved ? "text-gray-400 hover:text-orange-500" : "text-green-600 hover:text-green-800"
                      }`}
                    >
                      {c.resolved ? (
                        <><Circle size={12} /> 标记未解决</>
                      ) : (
                        <><CheckCircle2 size={12} /> 标记已解决</>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={12} />
                      删除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
