interface DailyActivity {
  date: string;
  learnedCount: number;
  reviewedCount: number;
}

function storageKey(userId: string): string {
  return `vocab_daily_${userId}`;
}

function historyKey(userId: string): string {
  return `vocab_daily_history_${userId}`;
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

export function getDailyHistory(userId: string): DailyActivity[] {
  try {
    const raw = localStorage.getItem(historyKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as DailyActivity[];
  } catch {
    return [];
  }
}

export function incrementDailyCount(userId: string, field: "learnedCount" | "reviewedCount"): void {
  const activity = getTodayActivity(userId);
  activity[field] += 1;
  localStorage.setItem(storageKey(userId), JSON.stringify(activity));

  // Update history
  const history = getDailyHistory(userId);
  const todayIdx = history.findIndex((h) => h.date === activity.date);
  if (todayIdx >= 0) {
    history[todayIdx] = activity;
  } else {
    history.push(activity);
  }
  // Keep last 90 days
  if (history.length > 90) history.shift();
  localStorage.setItem(historyKey(userId), JSON.stringify(history));

  // Push to cloud immediately if this is a Supabase user
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    import("../hooks/useSync").then(({ pushDailyHistoryToCloud }) => {
      pushDailyHistoryToCloud(userId, [activity]).catch(() => {});
    });
  }
}
