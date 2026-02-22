import { useState, useCallback, useEffect, useRef } from "react";
import { playSequence, loadAudio } from "./audio";
import type { Sequence, GameState } from "./types";

const NOTE_TO_DEGREE: Record<string, number> = {
  C: 1, D: 2, E: 3, F: 4, G: 5, A: 6, B: 7,
};

const DEGREE_LABELS = ["1", "2", "3", "4", "5", "6", "7"];
const SOLFEGE_LABELS = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"];

// Tokenize a sequence string into individual notes.
// ABC style:  C=C4, c=C5, C,=C3, c'=C6  (no separators needed)
// Explicit:   C5 F5 G5 (spaces/commas between explicit octaves are ignored)
// Each note starts with a letter, followed by either a digit or ABC modifiers (,' )
function tokenizeNotes(input: string): string[] {
  const stripped = input.replace(/\s/g, "");
  const matches = stripped.match(/[A-Ga-g](?:\d|[,']*)/g);
  return matches ?? [];
}

function normalizeNote(token: string): string | null {
  // Explicit octave: e.g. C5, f4
  const explicitMatch = token.match(/^([A-Ga-g])(\d)$/);
  if (explicitMatch) {
    return explicitMatch[1].toUpperCase() + explicitMatch[2];
  }

  // ABC notation
  const abcMatch = token.match(/^([A-Ga-g])([,']*)?$/);
  if (!abcMatch) return null;

  const letter = abcMatch[1];
  const modifiers = abcMatch[2] ?? "";
  const isLower = letter === letter.toLowerCase();

  let octave = isLower ? 5 : 4;
  for (const ch of modifiers) {
    if (ch === ",") octave--;
    if (ch === "'") octave++;
  }

  octave = Math.max(0, Math.min(7, octave));
  return letter.toUpperCase() + octave;
}

function parseSequences(param: string): Sequence[] {
  return param
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seqStr) => {
      const tokens = tokenizeNotes(seqStr);
      const notes: string[] = [];
      const degrees: number[] = [];
      for (const tok of tokens) {
        const normalized = normalizeNote(tok);
        if (!normalized) return { notes: [], degrees: [] };
        notes.push(normalized);
        degrees.push(NOTE_TO_DEGREE[normalized[0]] ?? 0);
      }
      return { notes, degrees };
    })
    .filter((seq) => seq.notes.length > 0 && seq.degrees.every((d) => d > 0));
}

function pickRandom<T>(arr: T[], exclude?: T): T {
  if (arr.length <= 1) return arr[0];
  const filtered = arr.filter((item) => item !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
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
  const [hasKeyboard, setHasKeyboard] = useState(false);
  const [useSolfege, setUseSolfege] = useState(false);
  const [pressedKey, setPressedKey] = useState<number | null>(null);

  useEffect(() => {
    const onKeyDown = () => { setHasKeyboard(true); window.removeEventListener("keydown", onKeyDown); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const seqParam = params.get("sequences") ?? params.get("s") ?? "";
    const parsed = parseSequences(seqParam);
    setSequences(parsed);
    const solfegeParam = params.get("solfege");
    if (solfegeParam === "1" || solfegeParam === "true") {
      setUseSolfege(true);
    }
    loadAudio().then(() => setIsLoading(false));
  }, []);

  const startRound = useCallback(async () => {
    if (sequences.length === 0) return;
    const seq = pickRandom(sequences, current);
    setCurrent(seq);
    setUserAnswer([]);
    setIsCorrect(null);
    setShowAnswer(false);
    setGameState("playing");
    setIsPlaying(true);
    await playSequence(seq!.notes);
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

  const tryAgain = useCallback(async () => {
    if (!current || isPlaying) return;
    setUserAnswer([]);
    setIsCorrect(null);
    setGameState("playing");
    setIsPlaying(true);
    await playSequence(current.notes);
    setIsPlaying(false);
    setGameState("answering");
  }, [current, isPlaying]);

  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(undefined);
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (gameState === "idle" && !isLoading && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      startRound();
    } else if (gameState === "answering") {
      const digit = parseInt(e.key);
      if (digit >= 1 && digit <= 7) {
        addDegree(digit);
        setPressedKey(digit);
        setTimeout(() => setPressedKey(null), 120);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        submit();
      } else if (e.key === "Backspace") {
        removeLast();
      } else if (e.key === "r" || e.key === "R") {
        replay();
      }
    } else if (gameState === "result") {
      if ((e.key === "Enter" || e.key === " ") && (isCorrect || showAnswer)) {
        e.preventDefault();
        startRound();
      } else if ((e.key === "Enter" || e.key === " ") && !isCorrect && !showAnswer) {
        e.preventDefault();
        tryAgain();
      } else if ((e.key === "s" || e.key === "S") && !isCorrect && !showAnswer) {
        revealAnswer();
      } else if (e.key === "r" || e.key === "R") {
        replay();
      }
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyHandlerRef.current?.(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (sequences.length === 0) {
    return (
      <div className="container">
        <h1>Gehörsträning</h1>
        <div className="message-box">
          <p>Inga tonföljder angivna.</p>
          <p>Lägg till tonföljder via URL:en, till exempel:</p>
          <code className="example-url">
            ?s=CFGc;C,EGc
          </code>
          <p className="hint">
            ABC-notation: C=C4, c=C5, C,=C3, c'=C6. Explicit oktav (C5) fungerar också.
            Separera tonföljder med semikolon.
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
          {isLoading ? "Laddar piano..." : <>Starta{hasKeyboard && <kbd>↵</kbd>}</>}
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
            {DEGREE_LABELS.map((_, i) => (
              <button
                key={i}
                className={`btn-degree${pressedKey === i + 1 ? " btn-degree--pressed" : ""}`}
                disabled={gameState !== "answering"}
                onClick={() => addDegree(i + 1)}
              >
                {useSolfege ? SOLFEGE_LABELS[i] : DEGREE_LABELS[i]}
              </button>
            ))}
          </div>

          {gameState === "answering" && (
            <div className="action-row">
              <button
                className="btn-secondary"
                onClick={removeLast}
                disabled={userAnswer.length === 0}
              >
                Ångra{hasKeyboard && <kbd>⌫</kbd>}
              </button>
              <button
                className="btn-secondary"
                onClick={replay}
                disabled={isPlaying}
              >
                {isPlaying ? "Spelar..." : <>Spela igen{hasKeyboard && <kbd>R</kbd>}</>}
              </button>
              <button
                className="btn-primary"
                onClick={submit}
                disabled={userAnswer.length === 0}
              >
                Kolla{hasKeyboard && <kbd>↵</kbd>}
              </button>
            </div>
          )}

          {gameState === "result" && (
            <div className="result-section">
              <p className={`result-text ${isCorrect ? "correct" : "wrong"}`}>
                {isCorrect ? "Rätt!" : "Inte riktigt..."}
              </p>

              {!isCorrect && !showAnswer && (
                <div className="action-row">
                  <button className="btn-primary" onClick={tryAgain} disabled={isPlaying}>
                    {isPlaying ? "Spelar..." : <>Försök igen{hasKeyboard && <><kbd>↵</kbd><kbd>R</kbd></>}</>}
                  </button>
                  <button className="btn-secondary" onClick={revealAnswer}>
                    Visa svar{hasKeyboard && <kbd>S</kbd>}
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
                  Nästa{hasKeyboard && <kbd>↵</kbd>}
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className="settings-bar">
        <span className="settings-label">Inställningar</span>
        <label className="switch">
          <span className={!useSolfege ? "switch-active" : ""}>1 2 3</span>
          <input
            type="checkbox"
            checked={useSolfege}
            onChange={() => setUseSolfege((v) => !v)}
          />
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
          <span className={useSolfege ? "switch-active" : ""}>Do Re Mi</span>
        </label>
      </div>
    </div>
  );
}
