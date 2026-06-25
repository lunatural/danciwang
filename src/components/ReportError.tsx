import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

export interface WordCorrection {
  id: string;
  word: string;
  source: 'cambridge' | 'oxford' | 'free-api' | 'anki' | 'unknown';
  errorType: 'definition' | 'phonetic' | 'example' | 'other';
  userCorrection: string;
  createdAt: string;
}

interface ReportErrorProps {
  word: string;
  currentSource: string;
  onClose: () => void;
  onSubmit: (correction: WordCorrection) => void;
}

const ERROR_TYPES = [
  { value: 'definition', label: '释义错误' },
  { value: 'phonetic', label: '音标错误' },
  { value: 'example', label: '例句错误' },
  { value: 'other', label: '其他问题' },
];

export default function ReportError({ word, currentSource, onClose, onSubmit }: ReportErrorProps) {
  const [errorType, setErrorType] = useState<WordCorrection['errorType']>('definition');
  const [userCorrection, setUserCorrection] = useState('');

  const handleSubmit = () => {
    if (!userCorrection.trim()) return;
    const correction: WordCorrection = {
      id: Date.now().toString(),
      word,
      source: currentSource as WordCorrection['source'],
      errorType,
      userCorrection: userCorrection.trim(),
      createdAt: new Date().toISOString(),
    };
    onSubmit(correction);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-800">报告错误</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Word info */}
        <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4">
          <span className="text-sm text-gray-500">单词：</span>
          <span className="font-medium text-gray-800">{word}</span>
          <span className="text-xs text-gray-400 ml-2">来源：{currentSource}</span>
        </div>

        {/* Error type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">错误类型</label>
          <div className="grid grid-cols-2 gap-2">
            {ERROR_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setErrorType(t.value as WordCorrection['errorType'])}
                className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                  errorType === t.value
                    ? 'border-purple-400 bg-purple-50 text-purple-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* User correction */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">正确内容或说明</label>
          <textarea
            value={userCorrection}
            onChange={(e) => setUserCorrection(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent resize-none transition-all"
            rows={3}
            placeholder="请输入正确的内容或详细说明问题..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!userCorrection.trim()}
            className="flex-1 px-4 py-2.5 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            提交反馈
          </button>
        </div>
      </div>
    </div>
  );
}
