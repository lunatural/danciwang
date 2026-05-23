import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getReviewSchedule, updateReviewSchedule } from "../hooks/useData";
import { fetchWord, type WordData } from "../utils/api";
import { calculateNextReview } from "../utils/sm2";
import FlashCard from "../components/FlashCard";
import RatingButtons from "../components/RatingButtons";

interface ReviewWord {
  scheduleId: string;
  word: string;
  data: WordData | null;
}

export default function Review() {
  const { user } = useAuth();
  const [dueWords, setDueWords] = useState<ReviewWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingWord, setLoadingWord] = useState(false);

  useEffect(() => {
    if (!user) return;
    const schedule = getReviewSchedule(user.id);
    const now = new Date().toISOString();
    const due = schedule.filter((s) => s.nextReviewAt <= now);
    setDueWords(due.map((s) => ({ scheduleId: s.id, word: s.word, data: null })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (dueWords.length === 0 || currentIndex >= dueWords.length) return;
    const word = dueWords[currentIndex];
    if (word.data) return;

    setLoadingWord(true);
    fetchWord(word.word).then((data) => {
      setDueWords((prev) => {
        const updated = [...prev];
        updated[currentIndex] = { ...updated[currentIndex], data };
        return updated;
      });
      setLoadingWord(false);
    });
  }, [currentIndex, dueWords.length]);

  const handleRate = (rating: "forgot" | "hard" | "good") => {
    if (!user) return;
    const current = dueWords[currentIndex];
    const schedule = getReviewSchedule(user.id);
    const item = schedule.find((s) => s.id === current.scheduleId);
    if (!item) return;

    const updated = calculateNextReview(item, rating);
    updateReviewSchedule(user.id, current.scheduleId, updated);

    setFlipped(false);
    if (currentIndex < dueWords.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setDueWords([]);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-10">加载中...</div>
    );
  }

  if (dueWords.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-purple-700">复习</h1>
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-xl text-gray-600 font-medium">今天没有需要复习的单词</p>
          <p className="text-gray-400 mt-2">去「查单词」页面添加新单词吧</p>
        </div>
      </div>
    );
  }

  const current = dueWords[currentIndex];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-700">复习</h1>
      <p className="text-center text-gray-400 text-sm">
        今日剩余 {dueWords.length - currentIndex} 个单词待复习
      </p>

      {loadingWord || !current.data ? (
        <div className="text-center text-gray-400 py-20">加载单词中...</div>
      ) : (
        <div key={current.word}>
          <FlashCard
            data={current.data}
            flipped={flipped}
            onClick={() => setFlipped(!flipped)}
          />
          {flipped && (
            <RatingButtons onRate={handleRate} />
          )}
        </div>
      )}
    </div>
  );
}
