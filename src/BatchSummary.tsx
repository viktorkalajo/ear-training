import { getMedal, getMedalEmoji, BATCH_SIZE } from "./progress";
import type { Medal } from "./types";

interface BatchSummaryProps {
  score: number;
  isNewBest: boolean;
  bestScore: number;
  bestMedal: Medal;
  onContinue: () => void;
  onStats: () => void;
  hasKeyboard: boolean;
}

export default function BatchSummary({
  score,
  isNewBest,
  bestScore,
  bestMedal,
  onContinue,
  onStats,
  hasKeyboard,
}: BatchSummaryProps) {
  const medal = getMedal(score);
  const emoji = getMedalEmoji(medal);

  return (
    <div className="batch-summary">
      <div className="batch-summary-score">
        {score}/{BATCH_SIZE}
      </div>
      {medal !== "none" && (
        <div className="batch-summary-medal">
          {emoji} {medal === "gold" ? "Guld" : medal === "silver" ? "Silver" : "Brons"}!
        </div>
      )}
      {isNewBest && (
        <div className="batch-summary-record">Nytt rekord!</div>
      )}
      <div className="batch-summary-best">
        Bäst: {getMedalEmoji(bestMedal)} {bestScore}/{BATCH_SIZE}
      </div>
      <div className="action-row">
        <button className="btn-primary" onClick={onContinue}>
          Fortsätt{hasKeyboard && <kbd>↵</kbd>}
        </button>
        <button className="btn-secondary" onClick={onStats}>
          Statistik{hasKeyboard && <kbd>S</kbd>}
        </button>
      </div>
    </div>
  );
}
