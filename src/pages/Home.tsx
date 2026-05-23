import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getWords, getLearningWords, getReviewSchedule } from "../hooks/useData";

export default function Home() {
  const { user } = useAuth();
  const [wordCount, setWordCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    setWordCount(getWords(user.id).length);
    setLearningCount(getLearningWords(user.id).length);
    const schedule = getReviewSchedule(user.id);
    const now = new Date().toISOString();
    setDueCount(schedule.filter((s) => s.nextReviewAt <= now).length);
  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-700">
        你好，{user?.email || ""}
      </h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-md p-4">
          <p className="text-gray-500 text-sm">单词本</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">{wordCount}</p>
          <p className="text-gray-400 text-xs mt-1">个单词</p>
        </div>
        <Link to="/learn" className="block">
          <div className="bg-white rounded-2xl shadow-md p-4 hover:shadow-lg transition-shadow">
            <p className="text-gray-500 text-sm">待学习</p>
            <p className="text-3xl font-bold text-blue-500 mt-1">{learningCount}</p>
            <p className="text-gray-400 text-xs mt-1">个新单词</p>
          </div>
        </Link>
        <Link to="/review" className="block">
          <div className="bg-white rounded-2xl shadow-md p-4 hover:shadow-lg transition-shadow">
            <p className="text-gray-500 text-sm">待复习</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{dueCount}</p>
            <p className="text-gray-400 text-xs mt-1">个单词</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/search"
          className="bg-purple-500 hover:bg-purple-600 text-white rounded-2xl p-5 text-center font-medium transition-colors"
        >
          查单词
        </Link>
        <Link
          to="/learn"
          className="bg-blue-400 hover:bg-blue-500 text-white rounded-2xl p-5 text-center font-medium transition-colors"
        >
          学习新词
        </Link>
        <Link
          to="/review"
          className="bg-purple-400 hover:bg-purple-500 text-white rounded-2xl p-5 text-center font-medium transition-colors"
        >
          开始复习
        </Link>
      </div>
    </div>
  );
}
