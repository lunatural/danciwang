export interface WordEntry {
  word: string;
  group: string;
  addedAt: string;
}

export interface ReviewSchedule {
  id: string;
  userId: string;
  word: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewAt: string;
}

function storageKey(type: string, userId: string) {
  return `vocab_${type}_${userId}`;
}

// Words with group info
export function getWords(userId: string): WordEntry[] {
  const data = localStorage.getItem(storageKey("words", userId));
  if (!data) return [];
  const parsed = JSON.parse(data);
  if (parsed.length > 0 && typeof parsed[0] === "string") {
    const migrated: WordEntry[] = parsed.map((w: string) => ({
      word: w,
      group: "未分组",
      addedAt: new Date().toISOString(),
    }));
    localStorage.setItem(storageKey("words", userId), JSON.stringify(migrated));
    return migrated;
  }
  return parsed;
}

export function addWord(userId: string, word: string, group = "手动添加") {
  const words = getWords(userId);
  if (!words.find((w) => w.word === word && w.group === group)) {
    words.push({ word, group, addedAt: new Date().toISOString() });
    localStorage.setItem(storageKey("words", userId), JSON.stringify(words));
  }
}

export function removeWord(userId: string, word: string, group?: string) {
  const words = getWords(userId).filter((w) => {
    if (group) return !(w.word === word && w.group === group);
    return w.word !== word;
  });
  localStorage.setItem(storageKey("words", userId), JSON.stringify(words));
  // Only remove from learning if the word is no longer in any group
  if (group === undefined || !words.some((w) => w.word === word)) {
    removeFromLearning(userId, word);
  }
}

export function removeGroup(userId: string, group: string) {
  const toRemove = getWords(userId).filter((w) => w.group === group);
  const words = getWords(userId).filter((w) => w.group !== group);
  localStorage.setItem(storageKey("words", userId), JSON.stringify(words));
  for (const w of toRemove) {
    removeFromLearning(userId, w.word);
    const schedule = getReviewSchedule(userId);
    const item = schedule.find((s) => s.word === w.word);
    if (item) removeReviewSchedule(userId, item.id);
  }
}

export function getWordGroups(userId: string): { name: string; words: string[] }[] {
  const words = getWords(userId);
  const map = new Map<string, string[]>();
  for (const w of words) {
    const list = map.get(w.group) || [];
    list.push(w.word);
    map.set(w.group, list);
  }
  return Array.from(map.entries()).map(([name, wordList]) => ({
    name,
    words: wordList,
  }));
}

export function isWordAdded(userId: string, word: string): boolean {
  return getWords(userId).some((w) => w.word === word);
}

// Learning status
export function getLearningWords(userId: string): string[] {
  const data = localStorage.getItem(storageKey("learning", userId));
  return data ? JSON.parse(data) : [];
}

export function addToLearning(userId: string, word: string) {
  const learning = getLearningWords(userId);
  if (!learning.includes(word)) {
    learning.push(word);
    localStorage.setItem(storageKey("learning", userId), JSON.stringify(learning));
  }
}

export function batchImportWords(
  userId: string,
  wordList: string[],
  group: string
): number {
  const words = getWords(userId);
  const learning = getLearningWords(userId);
  const existingPairs = new Set(words.map((w) => `${w.word}|${w.group}`));
  const now = new Date().toISOString();
  let added = 0;

  for (const word of wordList) {
    if (!existingPairs.has(`${word}|${group}`)) {
      words.push({ word, group, addedAt: now });
      existingPairs.add(`${word}|${group}`);
      added++;
    }
    if (!learning.includes(word)) {
      learning.push(word);
    }
  }

  localStorage.setItem(storageKey("words", userId), JSON.stringify(words));
  localStorage.setItem(storageKey("learning", userId), JSON.stringify(learning));
  return added;
}

export function removeFromLearning(userId: string, word: string) {
  const learning = getLearningWords(userId).filter((w) => w !== word);
  localStorage.setItem(storageKey("learning", userId), JSON.stringify(learning));
}

export function moveToReview(userId: string, word: string) {
  removeFromLearning(userId, word);
  const schedule = getReviewSchedule(userId);
  const existing = schedule.find((s) => s.word === word);
  if (existing) {
    existing.easeFactor = 2.5;
    existing.intervalDays = 0;
    existing.repetitions = 0;
    existing.nextReviewAt = new Date().toISOString();
    existing.lastReviewAt = new Date().toISOString();
  } else {
    schedule.push({
      id: crypto.randomUUID(),
      userId,
      word,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: new Date().toISOString(),
      lastReviewAt: new Date().toISOString(),
    });
  }
  localStorage.setItem(storageKey("schedule", userId), JSON.stringify(schedule));
}

// Review schedule
export function getReviewSchedule(userId: string): ReviewSchedule[] {
  const data = localStorage.getItem(storageKey("schedule", userId));
  return data ? JSON.parse(data) : [];
}

export function updateReviewSchedule(
  userId: string,
  id: string,
  updated: Partial<ReviewSchedule>
) {
  const schedule = getReviewSchedule(userId);
  const idx = schedule.findIndex((s) => s.id === id);
  if (idx !== -1) {
    schedule[idx] = { ...schedule[idx], ...updated };
    localStorage.setItem(storageKey("schedule", userId), JSON.stringify(schedule));
  }
}

export function removeReviewSchedule(userId: string, id: string) {
  const schedule = getReviewSchedule(userId).filter((s) => s.id !== id);
  localStorage.setItem(storageKey("schedule", userId), JSON.stringify(schedule));
}
