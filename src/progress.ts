import type { Medal, ProgressData } from "./types";

export const BATCH_SIZE = 10;

const STORAGE_PREFIX = "ear-training:progress:";

export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

export function loadProgress(hash: string): ProgressData | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + hash);
    if (!raw) return null;
    return JSON.parse(raw) as ProgressData;
  } catch {
    return null;
  }
}

export function saveProgress(hash: string, data: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + hash, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function getMedal(score: number): Medal {
  if (score >= 10) return "gold";
  if (score >= 7) return "silver";
  if (score >= 5) return "bronze";
  return "none";
}

export function getMedalEmoji(medal: Medal): string {
  switch (medal) {
    case "gold": return "\u{1F947}";
    case "silver": return "\u{1F948}";
    case "bronze": return "\u{1F949}";
    default: return "";
  }
}

export function getLibraryMedal(sequences: string): Medal {
  const hash = hashString(sequences);
  const data = loadProgress(hash);
  return data?.bestMedal ?? "none";
}

export function createEmptyProgress(sequenceParam: string, name: string | null): ProgressData {
  return {
    sequenceParam,
    name,
    batches: [],
    bestScore: 0,
    bestMedal: "none",
    currentBatch: [],
  };
}
