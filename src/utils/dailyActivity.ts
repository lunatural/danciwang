interface DailyActivity {
  date: string;
  learnedCount: number;
  reviewedCount: number;
}

function storageKey(userId: string): string {
  return `vocab_daily_${userId}`;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getTodayActivity(userId: string): DailyActivity {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { date: getToday(), learnedCount: 0, reviewedCount: 0 };
    const data = JSON.parse(raw) as DailyActivity;
    if (data.date !== getToday()) {
      return { date: getToday(), learnedCount: 0, reviewedCount: 0 };
    }
    return data;
  } catch {
    return { date: getToday(), learnedCount: 0, reviewedCount: 0 };
  }
}

export function incrementDailyCount(userId: string, field: "learnedCount" | "reviewedCount"): void {
  const activity = getTodayActivity(userId);
  activity[field] += 1;
  localStorage.setItem(storageKey(userId), JSON.stringify(activity));
}
