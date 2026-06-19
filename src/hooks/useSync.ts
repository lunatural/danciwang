import { supabase } from "../supabase";
import type { WordEntry, ReviewSchedule } from "./useData";

// ── Types ──────────────────────────────────────────────────────────

export interface SyncOperation {
  op: "insert_word" | "delete_word" | "delete_group"
    | "insert_learning" | "remove_learning"
    | "upsert_schedule" | "remove_schedule";
  payload: Record<string, unknown>;
  timestamp: string;
}

// ── Sync Queue ─────────────────────────────────────────────────────

function syncQueueKey(userId: string): string {
  return `vocab_sync_queue_${userId}`;
}

function getSyncQueue(userId: string): SyncOperation[] {
  try {
    const raw = localStorage.getItem(syncQueueKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(userId: string, queue: SyncOperation[]): void {
  localStorage.setItem(syncQueueKey(userId), JSON.stringify(queue));
}

function opKey(op: SyncOperation): string {
  // Deduplicate by op type + word (or group name for delete_group)
  const w = op.payload.word || op.payload.group || op.payload.id || "";
  return `${op.op}:${w}`;
}

export function enqueueSyncOp(userId: string, op: SyncOperation): void {
  const queue = getSyncQueue(userId);
  const key = opKey(op);

  // Deduplicate: remove existing entry for same op+word
  const filtered = queue.filter((o) => opKey(o) !== key);
  filtered.push({ ...op, timestamp: new Date().toISOString() });

  // Limit queue to 200 entries, drop oldest
  if (filtered.length > 200) {
    filtered.splice(0, filtered.length - 200);
  }

  saveSyncQueue(userId, filtered);
}

/** Maximum time (ms) to spend flushing the queue */
const MAX_FLUSH_TIME = 30000; // 30 seconds

export async function flushSyncQueue(userId: string): Promise<number> {
  const queue = getSyncQueue(userId);
  if (queue.length === 0) return 0;

  // Drop stale entries older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const fresh = queue.filter((op) => new Date(op.timestamp).getTime() > cutoff);
  if (fresh.length !== queue.length) {
    saveSyncQueue(userId, fresh);
  }

  let flushed = 0;
  const failed: SyncOperation[] = [];
  const start = Date.now();

  for (const op of fresh) {
    if (Date.now() - start > MAX_FLUSH_TIME) {
      // Time's up, keep remaining in queue
      failed.push(op);
      continue;
    }
    try {
      await executeSyncOp(userId, op);
      flushed++;
    } catch {
      failed.push(op);
    }
  }

  saveSyncQueue(userId, failed);
  return flushed;
}

async function executeSyncOp(userId: string, op: SyncOperation): Promise<void> {
  switch (op.op) {
    case "insert_word":
      await supabase.from("words").upsert({
        user_id: userId,
        word: op.payload.word as string,
        group: op.payload.group as string,
        added_at: op.payload.addedAt as string,
      }, { onConflict: "user_id, word" });
      break;
    case "delete_word": {
      // Delete word; if group is specified, only from that group; otherwise all groups
      const w = op.payload.word as string;
      const g = op.payload.group as string || "";
      let q = supabase.from("words").delete()
        .eq("user_id", userId)
        .eq("word", w);
      if (g) q = q.eq("group", g);
      await q;
      break;
    }
    case "delete_group":
      await supabase.from("words").delete()
        .eq("user_id", userId)
        .eq("group", op.payload.group as string);
      break;
    case "insert_learning":
      await supabase.from("learning").upsert({
        user_id: userId,
        word: op.payload.word as string,
        added_at: op.payload.addedAt as string,
      }, { onConflict: "user_id, word" });
      break;
    case "remove_learning":
      await supabase.from("learning").delete()
        .eq("user_id", userId)
        .eq("word", op.payload.word as string);
      break;
    case "upsert_schedule":
      await supabase.from("review_schedule").upsert({
        id: op.payload.id as string,
        user_id: userId,
        word: op.payload.word as string,
        ease_factor: op.payload.easeFactor as number,
        interval_days: op.payload.intervalDays as number,
        repetitions: op.payload.repetitions as number,
        next_review_at: op.payload.nextReviewAt as string,
        last_review_at: op.payload.lastReviewAt as string,
      }, { onConflict: "user_id, word" });
      break;
    case "remove_schedule":
      await supabase.from("review_schedule").delete()
        .eq("id", op.payload.id as string)
        .eq("user_id", userId);
      break;
  }
}

// ── Cloud CRUD ─────────────────────────────────────────────────────

// ── Words ──

export async function pullWordsFromCloud(userId: string): Promise<WordEntry[]> {
  const all: WordEntry[] = [];
  const limit = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("words")
      .select("word, group, added_at")
      .eq("user_id", userId)
      .order("added_at", { ascending: false })
      .range(from, from + limit - 1);

    if (error) {
      console.warn("pullWordsFromCloud error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const r of data as { word: string; group: string; added_at: string }[]) {
      all.push({ word: r.word, group: r.group, addedAt: r.added_at });
    }
    if (data.length < limit) break;
    from += limit;
  }

  return all;
}

export async function upsertWordToCloud(userId: string, entry: WordEntry): Promise<void> {
  const { error } = await supabase.from("words").upsert({
    user_id: userId,
    word: entry.word,
    group: entry.group,
    added_at: entry.addedAt,
  }, { onConflict: "user_id, word" });

  if (error) console.warn("upsertWordToCloud error:", error.message);
}

export async function deleteWordFromCloud(userId: string, word: string, group?: string): Promise<void> {
  let q = supabase.from("words").delete().eq("user_id", userId).eq("word", word);
  if (group) q = q.eq("group", group);
  const { error } = await q;
  if (error) console.warn("deleteWordFromCloud error:", error.message);
}

export async function deleteGroupFromCloud(userId: string, group: string): Promise<void> {
  const { error } = await supabase.from("words").delete()
    .eq("user_id", userId).eq("group", group);
  if (error) console.warn("deleteGroupFromCloud error:", error.message);
}

// ── Learning ──

export async function pullLearningFromCloud(userId: string): Promise<string[]> {
  const all: string[] = [];
  const limit = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("learning")
      .select("word")
      .eq("user_id", userId)
      .range(from, from + limit - 1);

    if (error) {
      console.warn("pullLearningFromCloud error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const r of data as { word: string }[]) {
      all.push(r.word);
    }
    if (data.length < limit) break;
    from += limit;
  }

  return all;
}

export async function upsertLearningToCloud(userId: string, word: string): Promise<void> {
  const { error } = await supabase.from("learning").upsert({
    user_id: userId,
    word,
    added_at: new Date().toISOString(),
  }, { onConflict: "user_id, word" });
  if (error) console.warn("upsertLearningToCloud error:", error.message);
}

export async function removeLearningFromCloud(userId: string, word: string): Promise<void> {
  const { error } = await supabase.from("learning").delete()
    .eq("user_id", userId).eq("word", word);
  if (error) console.warn("removeLearningFromCloud error:", error.message);
}

// ── Review Schedule ──

export async function pullScheduleFromCloud(userId: string): Promise<ReviewSchedule[]> {
  const all: ReviewSchedule[] = [];
  const limit = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("review_schedule")
      .select("id, word, ease_factor, interval_days, repetitions, next_review_at, last_review_at")
      .eq("user_id", userId)
      .range(from, from + limit - 1);

    if (error) {
      console.warn("pullScheduleFromCloud error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const r of data as {
      id: string; word: string; ease_factor: number;
      interval_days: number; repetitions: number;
      next_review_at: string; last_review_at: string;
    }[]) {
      all.push({
        id: r.id,
        userId,
        word: r.word,
        easeFactor: r.ease_factor,
        intervalDays: r.interval_days,
        repetitions: r.repetitions,
        nextReviewAt: r.next_review_at,
        lastReviewAt: r.last_review_at,
      });
    }
    if (data.length < limit) break;
    from += limit;
  }

  return all;
}

export async function upsertScheduleToCloud(userId: string, item: ReviewSchedule): Promise<void> {
  const { error } = await supabase.from("review_schedule").upsert({
    id: item.id,
    user_id: userId,
    word: item.word,
    ease_factor: item.easeFactor,
    interval_days: item.intervalDays,
    repetitions: item.repetitions,
    next_review_at: item.nextReviewAt,
    last_review_at: item.lastReviewAt,
  }, { onConflict: "user_id, word" });
  if (error) console.warn("upsertScheduleToCloud error:", error.message);
}

export async function removeScheduleFromCloud(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("review_schedule").delete()
    .eq("id", id).eq("user_id", userId);
  if (error) console.warn("removeScheduleFromCloud error:", error.message);
}

// ── Batch Pull / Push ──────────────────────────────────────────────

export interface DailyActivityEntry {
  date: string;
  learnedCount: number;
  reviewedCount: number;
}

export interface CloudData {
  words: WordEntry[];
  learning: string[];
  schedule: ReviewSchedule[];
  dailyHistory: DailyActivityEntry[];
}

// ── Daily Activity ─────────────────────────────────────────────────

export async function pullDailyHistoryFromCloud(userId: string): Promise<DailyActivityEntry[]> {
  const all: DailyActivityEntry[] = [];
  const limit = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("daily_activity")
      .select("date, learned_count, reviewed_count")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .range(from, from + limit - 1);

    if (error) {
      console.warn("pullDailyHistory error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const r of data as { date: string; learned_count: number; reviewed_count: number }[]) {
      all.push({ date: r.date, learnedCount: r.learned_count, reviewedCount: r.reviewed_count });
    }
    if (data.length < limit) break;
    from += limit;
  }

  return all;
}

export async function pushDailyHistoryToCloud(
  userId: string,
  history: DailyActivityEntry[]
): Promise<void> {
  const rows = history.map((h) => ({
    user_id: userId,
    date: h.date,
    learned_count: h.learnedCount,
    reviewed_count: h.reviewedCount,
  }));

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("daily_activity").upsert(chunk, {
      onConflict: "user_id, date",
    });
    if (error) console.warn("pushDailyHistory error:", error.message);
  }
}

export async function pullAllFromCloud(userId: string): Promise<CloudData | null> {
  try {
    const [words, learning, schedule, dailyHistory] = await Promise.all([
      pullWordsFromCloud(userId),
      pullLearningFromCloud(userId),
      pullScheduleFromCloud(userId),
      pullDailyHistoryFromCloud(userId),
    ]);
    return { words, learning, schedule, dailyHistory };
  } catch (err) {
    console.warn("pullAllFromCloud failed:", err);
    return null;
  }
}

/**
 * Merge cloud data into localStorage. Cloud wins on conflict.
 * Local entries not in cloud are preserved (no data loss).
 */
export function mergeCloudIntoLocal(userId: string, cloud: CloudData): void {
  // ── Words ──
  const localWordsRaw = localStorage.getItem(`vocab_words_${userId}`);
  const localWords: WordEntry[] = localWordsRaw ? JSON.parse(localWordsRaw) : [];
  const cloudWordSet = new Set<string>();
  for (const cw of cloud.words) {
    cloudWordSet.add(`${cw.word}|${cw.group}`);
  }
  // Remove local entries that are also in cloud (will be replaced)
  const localOnly = localWords.filter((lw) => !cloudWordSet.has(`${lw.word}|${lw.group}`));
  // Merge: local-only entries + all cloud entries
  const merged = [...localOnly, ...cloud.words];
  localStorage.setItem(`vocab_words_${userId}`, JSON.stringify(merged));

  // Push local-only words to cloud (fire-and-forget)
  if (localOnly.length > 0) {
    pushWordsToCloud(userId, localOnly).catch(() => {});
  }

  // ── Learning ──
  const localLearningRaw = localStorage.getItem(`vocab_learning_${userId}`);
  const localLearning: string[] = localLearningRaw ? JSON.parse(localLearningRaw) : [];
  const cloudLearningSet = new Set(cloud.learning);
  const learningMerged = [...new Set([...localLearning, ...cloudLearningSet])];
  localStorage.setItem(`vocab_learning_${userId}`, JSON.stringify(learningMerged));

  // ── Review Schedule ── (merge by word, not id)
  const localScheduleRaw = localStorage.getItem(`vocab_schedule_${userId}`);
  const localSchedule: ReviewSchedule[] = localScheduleRaw ? JSON.parse(localScheduleRaw) : [];
  const cloudScheduleWords = new Set(cloud.schedule.map((s) => s.word));
  const localOnlySchedule = localSchedule.filter((ls) => !cloudScheduleWords.has(ls.word));
  const scheduleMerged = [...localOnlySchedule, ...cloud.schedule];
  localStorage.setItem(`vocab_schedule_${userId}`, JSON.stringify(scheduleMerged));

  // ── Daily History ── (merge: sum counts for same date)
  const localHistoryRaw = localStorage.getItem(`vocab_daily_history_${userId}`);
  const localHistory: DailyActivityEntry[] = localHistoryRaw ? JSON.parse(localHistoryRaw) : [];

  // Create a date-indexed map, summing counts from both local and cloud
  const historyMap = new Map<string, DailyActivityEntry>();
  for (const h of localHistory) {
    historyMap.set(h.date, { ...h });
  }
  for (const h of cloud.dailyHistory) {
    const existing = historyMap.get(h.date);
    if (existing) {
      existing.learnedCount = Math.max(existing.learnedCount, h.learnedCount);
      existing.reviewedCount = Math.max(existing.reviewedCount, h.reviewedCount);
    } else {
      historyMap.set(h.date, { ...h });
    }
  }
  const historyMerged = Array.from(historyMap.values()).sort(
    (a, b) => b.date.localeCompare(a.date)
  );
  localStorage.setItem(`vocab_daily_history_${userId}`, JSON.stringify(historyMerged));

  // Also update today's activity from merged history
  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = historyMap.get(today);
  if (todayEntry) {
    localStorage.setItem(`vocab_daily_${userId}`, JSON.stringify(todayEntry));
  }

  // Push merged history back to cloud (fire-and-forget)
  if (historyMerged.length > 0) {
    pushDailyHistoryToCloud(userId, historyMerged).catch(() => {});
  }

  // Push local-only schedules to cloud (fire-and-forget)
  if (localOnlySchedule.length > 0) {
    pushScheduleToCloud(userId, localOnlySchedule).catch(() => {});
  }

  // Also push local-only learning to cloud
  const localOnlyLearning = localLearning.filter((lw) => !cloudLearningSet.has(lw));
  if (localOnlyLearning.length > 0) {
    pushLearningToCloud(userId, localOnlyLearning).catch(() => {});
  }
}

export async function pushWordsToCloud(
  userId: string,
  words: WordEntry[]
): Promise<void> {
  // Batch insert in chunks of 100
  const chunkSize = 100;
  const rows = words.map((w) => ({
    user_id: userId,
    word: w.word,
    group: w.group,
    added_at: w.addedAt,
  }));

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("words").upsert(chunk, {
      onConflict: "user_id, word",
    });
    if (error) {
      console.warn("pushWordsToCloud batch error:", error.message);
      throw error;
    }
  }
}

export async function pushLearningToCloud(
  userId: string,
  words: string[]
): Promise<void> {
  const chunkSize = 100;
  const rows = words.map((w) => ({
    user_id: userId,
    word: w,
    added_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("learning").upsert(chunk, {
      onConflict: "user_id, word",
    });
    if (error) {
      console.warn("pushLearningToCloud batch error:", error.message);
      throw error;
    }
  }
}

export async function pushScheduleToCloud(
  userId: string,
  schedule: ReviewSchedule[]
): Promise<void> {
  const chunkSize = 100;
  const rows = schedule.map((s) => ({
    id: s.id,
    user_id: userId,
    word: s.word,
    ease_factor: s.easeFactor,
    interval_days: s.intervalDays,
    repetitions: s.repetitions,
    next_review_at: s.nextReviewAt,
    last_review_at: s.lastReviewAt,
  }));

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("review_schedule").upsert(chunk, {
      onConflict: "user_id, word",
    });
    if (error) {
      console.warn("pushScheduleToCloud batch error:", error.message);
      throw error;
    }
  }
}

// ── Migration ──────────────────────────────────────────────────────

/**
 * Migrate localStorage data from an old userId (email-based or guest)
 * to a new Supabase UUID. Returns true on success.
 */
export async function migrateLocalToCloud(
  oldUserId: string,
  newUuid: string
): Promise<boolean> {
  try {
    // Read old data
    const rawWords = localStorage.getItem(`vocab_words_${oldUserId}`);
    const rawLearning = localStorage.getItem(`vocab_learning_${oldUserId}`);
    const rawSchedule = localStorage.getItem(`vocab_schedule_${oldUserId}`);

    const words: WordEntry[] = rawWords ? JSON.parse(rawWords) : [];
    const learning: string[] = rawLearning ? JSON.parse(rawLearning) : [];
    const schedule: ReviewSchedule[] = rawSchedule ? JSON.parse(rawSchedule) : [];

    // Rewrite schedule IDs to avoid UUID conflicts
    const migratedSchedule: ReviewSchedule[] = schedule.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      userId: newUuid,
    }));

    // Push to cloud
    if (words.length > 0) await pushWordsToCloud(newUuid, words);
    if (learning.length > 0) await pushLearningToCloud(newUuid, learning);
    if (migratedSchedule.length > 0) await pushScheduleToCloud(newUuid, migratedSchedule);

    // Copy to new localStorage keys
    if (words.length > 0) {
      localStorage.setItem(
        `vocab_words_${newUuid}`,
        JSON.stringify(words.map((w) => ({ ...w })))
      );
    }
    if (learning.length > 0) {
      localStorage.setItem(`vocab_learning_${newUuid}`, JSON.stringify([...learning]));
    }
    if (migratedSchedule.length > 0) {
      localStorage.setItem(
        `vocab_schedule_${newUuid}`,
        JSON.stringify(migratedSchedule)
      );
    }

    // Mark migration done
    localStorage.setItem(`vocab_migrated_${newUuid}`, "true");

    return true;
  } catch (err) {
    console.error("migrateLocalToCloud failed:", err);
    return false;
  }
}
