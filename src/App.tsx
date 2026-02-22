import { useState, useCallback, useEffect } from "react";
import { playSequence, loadAudio } from "./audio";
import type { Sequence, GameState } from "./types";

const NOTE_TO_DEGREE: Record<string, number> = {
  C: 1, D: 2, E: 3, F: 4, G: 5, A: 6, B: 7,
};

const DEGREE_LABELS = ["1", "2", "3", "4", "5", "6", "7"];


function parseSequences(param: string): Sequence[] {
  return param
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seqStr) => {
      const notes = seqStr.split(",").map((n) => n.trim());
      const degrees = notes.map((n) => {
        const letter = n.replace(/[0-9]/g, "").toUpperCase();
        return NOTE_TO_DEGREE[letter] ?? 0;
      });
      return { notes, degrees };
    })
    .filter((seq) => seq.notes.length > 0 && seq.degrees.every((d) => d > 0));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function App() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [current, setCurrent] = useState<Sequence | null>(null);
  const [userAnswer, setUserAnswer] = useState<number[]>([]);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const seqParam = params.get("sequences") ?? params.get("s") ?? "";
    const parsed = parseSequences(seqParam);
    setSequences(parsed);
    loadAudio().then(() => setIsLoading(false));
  }, []);

  const startRound = useCallback(async () => {
    if (sequences.length === 0) return;
    const seq = pickRandom(sequences);
    setCurrent(seq);
    setUserAnswer([]);
    setIsCorrect(null);
    setShowAnswer(false);
    setGameState("playing");
    setIsPlaying(true);
    await playSequence(seq.notes);
    setIsPlaying(false);
    setGameState("answering");
  }, [sequences]);

  const replay = useCallback(async () => {
    if (!current || isPlaying) return;
    setIsPlaying(true);
    await playSequence(current.notes);
    setIsPlaying(false);
  }, [current, isPlaying]);

  const addDegree = (degree: number) => {
    if (gameState !== "answering") return;
    setUserAnswer((prev) => [...prev, degree]);
  };

  const removeLast = () => {
    if (gameState !== "answering") return;
    setUserAnswer((prev) => prev.slice(0, -1));
  };

  const submit = () => {
    if (!current || userAnswer.length === 0) return;
    const correct =
      userAnswer.length === current.degrees.length &&
      userAnswer.every((d, i) => d === current.degrees[i]);
    setIsCorrect(correct);
    setGameState("result");
  };

  const revealAnswer = () => {
    setShowAnswer(true);
  };

  if (sequences.length === 0) {
    return (
      <div className="container">
        <h1>Gehörsträning</h1>
        <div className="message-box">
          <p>Inga tonföljder angivna.</p>
          <p>Lägg till tonföljder via URL:en, till exempel:</p>
          <code className="example-url">
            ?sequences=C5,F5,G5,C5;C4,E4,G4,C5
          </code>
          <p className="hint">
            Separera toner med komma, tonföljder med semikolon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Gehörsträning</h1>

      {gameState === "idle" && (
        <button className="btn-primary" onClick={startRound} disabled={isLoading}>
          {isLoading ? "Laddar piano..." : "Starta"}
        </button>
      )}

      {gameState !== "idle" && (
        <>
          <div className="answer-display">
            <span className="answer-label">Ditt svar:</span>
            <span className="answer-degrees">
              {userAnswer.length > 0 ? (
                userAnswer.join(", ")
              ) : (
                <span className="placeholder">&mdash;</span>
              )}
            </span>
          </div>

          <div className="degree-buttons">
            {DEGREE_LABELS.map((label, i) => (
              <button
                key={label}
                className="btn-degree"
                disabled={gameState !== "answering"}
                onClick={() => addDegree(i + 1)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="action-row">
            <button
              className="btn-secondary"
              onClick={removeLast}
              disabled={gameState !== "answering" || userAnswer.length === 0}
            >
              Ångra
            </button>
            <button
              className="btn-secondary"
              onClick={replay}
              disabled={isPlaying}
            >
              {isPlaying ? "Spelar..." : "Spela igen"}
            </button>
            {gameState === "answering" && (
              <button
                className="btn-primary"
                onClick={submit}
                disabled={userAnswer.length === 0}
              >
                Kolla
              </button>
            )}
          </div>

          {gameState === "result" && (
            <div className="result-section">
              <p className={`result-text ${isCorrect ? "correct" : "wrong"}`}>
                {isCorrect ? "Rätt!" : "Inte riktigt..."}
              </p>

              {!isCorrect && !showAnswer && (
                <div className="result-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setUserAnswer([]);
                      setGameState("answering");
                      setIsCorrect(null);
                    }}
                  >
                    Försök igen
                  </button>
                  <button className="btn-secondary" onClick={revealAnswer}>
                    Visa svar
                  </button>
                </div>
              )}

              {showAnswer && current && (
                <p className="revealed-answer">
                  Svar: {current.degrees.join(", ")}
                </p>
              )}

              {(isCorrect || showAnswer) && (
                <button className="btn-primary" onClick={startRound}>
                  Nästa
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
