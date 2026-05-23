export interface ReviewItem {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewAt: string;
}

export function calculateNextReview(
  item: ReviewItem,
  rating: "forgot" | "hard" | "good"
): ReviewItem {
  let { easeFactor, intervalDays, repetitions } = item;

  if (rating === "forgot") {
    repetitions = 0;
    intervalDays = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    repetitions += 1;
    if (rating === "hard") {
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      intervalDays = Math.max(1, Math.round(intervalDays * 1.3));
    } else {
      easeFactor = Math.max(1.3, easeFactor + 0.1);
      if (repetitions === 1) {
        intervalDays = 1;
      } else if (repetitions === 2) {
        intervalDays = 3;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
    }
  }

  const now = new Date();
  const nextReviewAt = new Date(
    now.getTime() + intervalDays * 24 * 60 * 60 * 1000
  ).toISOString();

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewAt,
    lastReviewAt: new Date().toISOString(),
  };
}
