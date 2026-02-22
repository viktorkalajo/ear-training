export interface Sequence {
  notes: string[];       // e.g. ["C5", "F5", "G5", "C5"]
  degrees: number[];     // e.g. [1, 4, 5, 1]
}

export type GameState = "idle" | "playing" | "answering" | "result";
