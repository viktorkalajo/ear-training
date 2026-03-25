export interface Sequence {
  notes: string[];       // e.g. ["C5", "F5", "G5", "C5"]
  degrees: number[];     // e.g. [1, 4, 5, 1]
}

export type GameState = "idle" | "playing" | "answering" | "result" | "batch-summary";

export type Medal = "none" | "bronze" | "silver" | "gold";

export interface BatchResult {
  score: number;
  timestamp: number;
}

export interface ProgressData {
  sequenceParam: string;
  name: string | null;
  batches: BatchResult[];
  bestScore: number;
  bestMedal: Medal;
  currentBatch: boolean[];
}

export interface VisitedLink {
  sequences: string;
  name: string | null;
  visitedAt: number;
}
