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

export function enqueueSyncOp(userId: string, op: SyncOperation): void {
  const queue = getSyncQueue(userId);
  queue.push({ ...op, timestamp: new Date().toISOString() });
  saveSyncQueue(userId, queue);
}

export async function flushSyncQueue(userId: string): Promise<number> {
  const queue = getSyncQueue(userId);
  if (queue.length === 0) return 0;

  let flushed = 0;
  const failed: SyncOperation[] = [];

  for (const op of queue) {
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
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id, word" });
      break;
    case "delete_word": {
      // Delete specific word in a specific group
      const w = op.payload.word as string;
      await supabase.from("words").delete()
        .eq("user_id", userId)
        .eq("word", w)
        .eq("group", op.payload.group as string);
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
        updated_at: new Date().toISOString(),
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
      }, { onConflict: "id" });
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
  const { data, error } = await supabase
    .from("words")
    .select("word, group, added_at")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  if (error) {
    console.warn("pullWordsFromCloud error:", error.message);
    return [];
  }
  return (data || []).map((r: { word: string; group: string; added_at: string }) => ({
    word: r.word,
    group: r.group,
    addedAt: r.added_at,
  }));
}

export async function upsertWordToCloud(userId: string, entry: WordEntry): Promise<void> {
  const { error } = await supabase.from("words").upsert({
    user_id: userId,
    word: entry.word,
    group: entry.group,
    added_at: entry.addedAt,
    updated_at: new Date().toISOString(),
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
  const { data, error } = await supabase
    .from("learning")
    .select("word")
    .eq("user_id", userId);

  if (error) {
    console.warn("pullLearningFromCloud error:", error.message);
    return [];
  }
  return (data || []).map((r: { word: string }) => r.word);
}

export async function upsertLearningToCloud(userId: string, word: string): Promise<void> {
  const { error } = await supabase.from("learning").upsert({
    user_id: userId,
    word,
    added_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
  const { data, error } = await supabase
    .from("review_schedule")
    .select("id, word, ease_factor, interval_days, repetitions, next_review_at, last_review_at")
    .eq("user_id", userId);

  if (error) {
    console.warn("pullScheduleFromCloud error:", error.message);
    return [];
  }
  return (data || []).map((r: {
    id: string; word: string; ease_factor: number;
    interval_days: number; repetitions: number;
    next_review_at: string; last_review_at: string;
  }) => ({
    id: r.id,
    userId,
    word: r.word,
    easeFactor: r.ease_factor,
    intervalDays: r.interval_days,
    repetitions: r.repetitions,
    nextReviewAt: r.next_review_at,
    lastReviewAt: r.last_review_at,
  }));
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
  }, { onConflict: "id" });
  if (error) console.warn("upsertScheduleToCloud error:", error.message);
}

export async function removeScheduleFromCloud(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("review_schedule").delete()
    .eq("id", id).eq("user_id", userId);
  if (error) console.warn("removeScheduleFromCloud error:", error.message);
}

// ── Batch Pull / Push ──────────────────────────────────────────────

export interface CloudData {
  words: WordEntry[];
  learning: string[];
  schedule: ReviewSchedule[];
}

export async function pullAllFromCloud(userId: string): Promise<CloudData | null> {
  try {
    const [words, learning, schedule] = await Promise.all([
      pullWordsFromCloud(userId),
      pullLearningFromCloud(userId),
      pullScheduleFromCloud(userId),
    ]);
    return { words, learning, schedule };
  } catch (err) {
    console.warn("pullAllFromCloud failed:", err);
    return null;
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
    updated_at: new Date().toISOString(),
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
    updated_at: new Date().toISOString(),
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
      onConflict: "id",
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
