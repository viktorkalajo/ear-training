import { useEffect, useRef } from "react";
import { getMedal, getMedalEmoji, BATCH_SIZE } from "./progress";
import type { ProgressData } from "./types";

interface StatsViewProps {
  progressData: ProgressData;
  name: string;
  onBack: () => void;
}

export default function StatsView({ progressData, name, onBack }: StatsViewProps) {
  const barsRef = useRef<HTMLDivElement>(null);
  const { batches, bestScore, bestMedal } = progressData;

  const average = batches.length > 0
    ? (batches.reduce((sum, b) => sum + b.score, 0) / batches.length).toFixed(1)
    : "–";

  // Auto-scroll to most recent (rightmost) on mount
  useEffect(() => {
    if (barsRef.current) {
      barsRef.current.scrollLeft = barsRef.current.scrollWidth;
    }
  }, []);

  return (
    <div className="container">
      <button className="btn-secondary stats-back" onClick={onBack}>
        Tillbaka
      </button>

      <h1>Statistik</h1>
      <div className="sequence-name">{name}</div>

      <div className="stats-summary">
        <div className="stats-row">
          <span>Omgångar</span>
          <span>{batches.length}</span>
        </div>
        <div className="stats-row">
          <span>Bäst</span>
          <span>{getMedalEmoji(bestMedal)} {bestScore}/{BATCH_SIZE}</span>
        </div>
        <div className="stats-row">
          <span>Genomsnitt</span>
          <span>{average}/{BATCH_SIZE}</span>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="stats-empty">Inga avslutade omgångar ännu.</div>
      ) : (
        <div className="chart">
          <div className="chart-y-axis">
            {[10, 8, 6, 4, 2, 0].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <div className="chart-bars" ref={barsRef}>
            {batches.map((batch, i) => (
              <div
                key={i}
                className="chart-bar"
                data-medal={getMedal(batch.score)}
              >
                <div
                  className="chart-bar-fill"
                  style={{ height: `${(batch.score / BATCH_SIZE) * 100}%` }}
                />
                <span className="chart-bar-score">{batch.score}</span>
                <span className="chart-bar-label">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
