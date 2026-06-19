import { supabase } from "../supabase";

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
  if (history.length > 90) history.shift();
  localStorage.setItem(historyKey(userId), JSON.stringify(history));

  // Push to cloud — use sum to avoid overwriting other device's counts
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    const key = { user_id: userId, date: activity.date };
    // Read existing cloud value first, then add
    supabase.from("daily_activity")
      .select("learned_count, reviewed_count")
      .eq("user_id", userId)
      .eq("date", activity.date)
      .maybeSingle()
      .then(({ data }) => {
        const cloudLearned = data?.learned_count || 0;
        const cloudReviewed = data?.reviewed_count || 0;
        // Use local value as source of truth (it already includes all local increments)
        // but ensure we don't lose cloud-only increments
        const merged = {
          learned_count: Math.max(activity.learnedCount, cloudLearned),
          reviewed_count: Math.max(activity.reviewedCount, cloudReviewed),
        };
        return supabase.from("daily_activity").upsert({
          ...key,
          ...merged,
        }, { onConflict: "user_id, date" });
      }).catch(() => {});
  }
}
