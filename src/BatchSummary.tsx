import { getMedal, getMedalEmoji, BATCH_SIZE } from "./progress";
import Confetti from "./Confetti";
import type { Medal } from "./types";

const MEDAL_RANK: Record<Medal, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };

interface BatchSummaryProps {
  score: number;
  isNewBest: boolean;
  previousBestMedal: Medal;
  bestScore: number;
  bestMedal: Medal;
  onContinue: () => void;
  onStats: () => void;
  hasKeyboard: boolean;
}

export default function BatchSummary({
  score,
  isNewBest,
  previousBestMedal,
  bestScore,
  bestMedal,
  onContinue,
  onStats,
  hasKeyboard,
}: BatchSummaryProps) {
  const medal = getMedal(score);
  const emoji = getMedalEmoji(medal);

  const isGold = medal === "gold";
  const isNewMedalLevel = medal !== "none" && MEDAL_RANK[medal] > MEDAL_RANK[previousBestMedal];
  const showConfetti = isGold || isNewMedalLevel;

  return (
    <div className="batch-summary">
      {showConfetti && <Confetti />}
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
