import { useState, useCallback, useEffect, useRef } from "react";
import { playSequence, playCadence, loadAudio } from "./audio";
import { hashString, loadProgress, saveProgress, getMedal, getMedalEmoji, createEmptyProgress, BATCH_SIZE, getLibraryMedal, loadVisitedLinks, saveVisitedLink, removeVisitedLink } from "./progress";
import BatchSummary from "./BatchSummary";
import StatsView from "./StatsView";
import type { Sequence, GameState, ProgressData, VisitedLink, Medal } from "./types";

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

/** Build a batch of `size` items from `arr` with good variance:
 *  - No immediate consecutive duplicates
 *  - Each item appears at most ceil(size / arr.length) times
 */
function buildBatchOrder<T>(arr: T[], size: number): T[] {
  if (arr.length === 0) return [];
  if (arr.length === 1) return Array(size).fill(arr[0]);

  // Repeat the pool enough times, shuffle, then fix any consecutive dupes
  const maxPer = Math.ceil(size / arr.length);
  const pool: T[] = [];
  for (let i = 0; i < maxPer; i++) pool.push(...arr);

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const result = pool.slice(0, size);

  // Fix consecutive duplicates by swapping with a later non-duplicate
  for (let i = 1; i < result.length; i++) {
    if (result[i] === result[i - 1]) {
      for (let j = i + 1; j < result.length; j++) {
        if (result[j] !== result[i - 1]) {
          [result[i], result[j]] = [result[j], result[i]];
          break;
        }
      }
    }
  }

  return result;
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
  const [useSolfege, setUseSolfege] = useState(() => localStorage.getItem("useSolfege") === "1");
  const [pressedKey, setPressedKey] = useState<number | null>(null);
  const [view, setView] = useState<"practice" | "stats">("practice");
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [sequenceName, setSequenceName] = useState<string | null>(null);
  const [visitedLinks, setVisitedLinks] = useState<VisitedLink[]>([]);
  const progressHashRef = useRef<string>("");
  const hasRecordedAttempt = useRef(false);
  const batchQueueRef = useRef<Sequence[]>([]);

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
    const name = params.get("name");
    setSequenceName(name);
    if (params.get("view") === "stats") {
      setView("stats");
    }
    // Load or create progress
    if (seqParam) {
      const hash = hashString(seqParam);
      progressHashRef.current = hash;
      const existing = loadProgress(hash);
      if (existing) {
        // Reset in-progress batch — the batch queue is rebuilt on every mount
        // so stale dots from a previous session would be misleading
        existing.currentBatch = [];
        if (existing.name !== name) {
          existing.name = name;
        }
        saveProgress(hash, existing);
        setProgressData(existing);
      } else {
        const fresh = createEmptyProgress(seqParam, name);
        saveProgress(hash, fresh);
        setProgressData(fresh);
      }
      // Save to visited links
      saveVisitedLink(seqParam, name);
    } else {
      // On start page — load visited links
      setVisitedLinks(loadVisitedLinks());
    }
    loadAudio().then(() => setIsLoading(false));
  }, []);

  // View routing
  const goToStats = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "stats");
    history.pushState(null, "", url.toString());
    setView("stats");
  }, []);

  const goToPractice = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    history.pushState(null, "", url.toString());
    setView("practice");
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setView(params.get("view") === "stats" ? "stats" : "practice");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const updateProgress = useCallback((updater: (data: ProgressData) => ProgressData) => {
    setProgressData((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      saveProgress(progressHashRef.current, updated);
      return updated;
    });
  }, []);

  const finalizeBatch = useCallback(() => {
    if (!progressData) return { score: 0, isNewBest: false, previousBestMedal: "none" as Medal };
    const score = progressData.currentBatch.filter(Boolean).length;
    const isNewBest = score > progressData.bestScore;
    const previousBestMedal = progressData.bestMedal;
    const medal = getMedal(score);
    const bestMedal = isNewBest ? medal : progressData.bestMedal;
    updateProgress((prev) => ({
      ...prev,
      batches: [...prev.batches, { score, timestamp: Date.now() }],
      bestScore: isNewBest ? score : prev.bestScore,
      bestMedal,
      currentBatch: [],
    }));
    batchQueueRef.current = [];
    return { score, isNewBest, previousBestMedal };
  }, [progressData, updateProgress]);

  const [lastBatchResult, setLastBatchResult] = useState<{ score: number; isNewBest: boolean; previousBestMedal: Medal }>({ score: 0, isNewBest: false, previousBestMedal: "none" });

  const startRound = useCallback(async () => {
    if (sequences.length === 0) return;
    // Check if batch is complete
    if (progressData && progressData.currentBatch.length >= BATCH_SIZE) {
      setLastBatchResult(finalizeBatch());
      setGameState("batch-summary");
      return;
    }
    // Build a fresh batch queue when starting a new batch
    if (batchQueueRef.current.length === 0) {
      batchQueueRef.current = buildBatchOrder(sequences, BATCH_SIZE);
    }
    hasRecordedAttempt.current = false;
    const seq = batchQueueRef.current.shift()!;
    setCurrent(seq);
    setUserAnswer([]);
    setIsCorrect(null);
    setShowAnswer(false);
    setGameState("playing");
    setIsPlaying(true);
    await playCadence();
    await playSequence(seq.notes);
    setIsPlaying(false);
    setGameState("answering");
  }, [sequences, progressData, finalizeBatch]);

  const replay = useCallback(async () => {
    if (!current || isPlaying) return;
    setIsPlaying(true);
    await playCadence();
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
    // Record first-try result
    if (!hasRecordedAttempt.current) {
      hasRecordedAttempt.current = true;
      updateProgress((prev) => ({
        ...prev,
        currentBatch: [...prev.currentBatch, correct],
      }));
    }
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
    await playCadence();
    await playSequence(current.notes);
    setIsPlaying(false);
    setGameState("answering");
  }, [current, isPlaying]);

  const continuePractice = useCallback(async () => {
    hasRecordedAttempt.current = false;
    if (batchQueueRef.current.length === 0) {
      batchQueueRef.current = buildBatchOrder(sequences, BATCH_SIZE);
    }
    const seq = batchQueueRef.current.shift()!;
    setCurrent(seq);
    setUserAnswer([]);
    setIsCorrect(null);
    setShowAnswer(false);
    setGameState("playing");
    setIsPlaying(true);
    await playCadence();
    await playSequence(seq.notes);
    setIsPlaying(false);
    setGameState("answering");
  }, [sequences]);

  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(undefined);
  useEffect(() => { keyHandlerRef.current = (e: KeyboardEvent) => {
    if (view === "stats") {
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        goToPractice();
      }
      return;
    }
    if (gameState === "batch-summary") {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        continuePractice();
      } else if (e.key === "s" || e.key === "S") {
        goToStats();
      }
      return;
    }
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
  }; });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyHandlerRef.current?.(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const displayName = sequenceName ?? (progressData?.sequenceParam ?? "");

  if (view === "stats" && progressData) {
    return <StatsView progressData={progressData} name={displayName} onBack={goToPractice} />;
  }

  const handleRemoveLink = (sequences: string) => {
    removeVisitedLink(sequences);
    setVisitedLinks(loadVisitedLinks());
  };

  if (sequences.length === 0) {
    const sortedLinks = [...visitedLinks].sort((a, b) => b.visitedAt - a.visitedAt);
    return (
      <div className="container">
        <h1>Gehörsträning</h1>
        {sortedLinks.length > 0 ? (
          <div className="library">
            {sortedLinks.map((item) => {
              const medal = getLibraryMedal(item.sequences);
              const href = item.name
                ? `?s=${encodeURIComponent(item.sequences)}&name=${encodeURIComponent(item.name)}`
                : `?s=${encodeURIComponent(item.sequences)}`;
              return (
                <div key={item.sequences} className="library-card-row">
                  <a className="library-card" href={href}>
                    <span className="library-card-name">
                      {medal !== "none" && <span className="library-card-medal">{getMedalEmoji(medal)}</span>}
                      {item.name ?? item.sequences}
                    </span>
                  </a>
                  <button
                    className="btn-remove"
                    onClick={() => handleRemoveLink(item.sequences)}
                    title="Ta bort"
                    aria-label={`Ta bort ${item.name ?? item.sequences}`}
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="library-empty">Inga övningar ännu. Öppna en länk med sekvenser för att börja.</p>
        )}
      </div>
    );
  }

  const batchCount = progressData?.currentBatch.length ?? 0;
  const isInRound = gameState === "playing" || gameState === "answering" || gameState === "result";

  return (
    <div className="container">
      <div className="header">
        <h1><a href={import.meta.env.BASE_URL} className="title-link">Gehörsträning</a></h1>
        {displayName && <div className="sequence-name">{displayName}</div>}
      </div>

      {gameState === "batch-summary" && progressData && (
        <BatchSummary
          score={lastBatchResult.score}
          isNewBest={lastBatchResult.isNewBest}
          previousBestMedal={lastBatchResult.previousBestMedal}
          bestScore={progressData.bestScore}
          bestMedal={progressData.bestMedal}
          onContinue={continuePractice}
          onStats={goToStats}
          hasKeyboard={hasKeyboard}
        />
      )}

      {gameState === "idle" && (
        <>
          <button className="btn-primary" onClick={startRound} disabled={isLoading}>
            {isLoading ? "Laddar piano..." : <>Starta{hasKeyboard && <kbd>↵</kbd>}</>}
          </button>
          {/* TODO: remove — temporary confetti test */}
          <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => { setLastBatchResult({ score: 10, isNewBest: true, previousBestMedal: "silver" }); setGameState("batch-summary"); }}>
            Test confetti
          </button>
        </>
      )}

      {gameState !== "idle" && gameState !== "batch-summary" && (
        <>
          <div className="answer-display">
            <span className="answer-label">Ditt svar:</span>
            <span className="answer-degrees">
              {userAnswer.length > 0 ? (
                userAnswer.map(d => useSolfege ? SOLFEGE_LABELS[d - 1] : d).join(", ")
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
                {useSolfege ? <>{SOLFEGE_LABELS[i]}{hasKeyboard && <kbd className="degree-kbd">{i + 1}</kbd>}</> : DEGREE_LABELS[i]}
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
                  Svar: {current.degrees.map(d => useSolfege ? SOLFEGE_LABELS[d - 1] : d).join(", ")}
                </p>
              )}

              {(isCorrect || showAnswer) && (
                <button className="btn-primary btn-full" onClick={startRound}>
                  Nästa{hasKeyboard && <kbd>↵</kbd>}
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className="footer-bar">
        {progressData && gameState !== "batch-summary" && (
          <>
            <button className="accordion-header" onClick={() => setStatsExpanded((v) => !v)}>
              <div className="progress-row">
                <div className="progress-dots">
                  {Array.from({ length: BATCH_SIZE }, (_, i) => {
                    const result = progressData.currentBatch[i];
                    const isCurrent = isInRound && i === batchCount;
                    return (
                      <span
                        key={i}
                        className={`dot${result === true ? " dot-correct" : result === false ? " dot-wrong" : ""}${isCurrent ? " dot-current" : ""}`}
                      />
                    );
                  })}
                </div>
                {progressData.bestScore > 0 && (
                  <span className="best-medal">{getMedalEmoji(progressData.bestMedal)} {progressData.bestScore}/{BATCH_SIZE}</span>
                )}
              </div>
              <span className={`accordion-chevron${statsExpanded ? " accordion-chevron--open" : ""}`}>&#x203A;</span>
            </button>

            {statsExpanded && (
              <div className="accordion-content">
                {progressData.bestScore > 0 ? (
                  <>
                    <p>Bästa omgång: {getMedalEmoji(progressData.bestMedal)} {progressData.bestScore}/{BATCH_SIZE} — {progressData.bestMedal === "gold" ? "Guld" : progressData.bestMedal === "silver" ? "Silver" : progressData.bestMedal === "bronze" ? "Brons" : "Ingen medalj ännu"}</p>
                    <p className="accordion-thresholds">Brons: 5+ · Silver: 7+ · Guld: 10/10</p>
                    {progressData.batches.length > 0 && (
                      <button className="btn-stats-link" onClick={goToStats}>
                        Visa statistik
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="accordion-empty">Avsluta din första omgång för att se resultat</p>
                    <p className="accordion-thresholds">Brons: 5+ · Silver: 7+ · Guld: 10/10</p>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {progressData && gameState !== "batch-summary" && <div className="footer-divider" />}

        <div className="settings-row">
          <span className="settings-label">Inställningar</span>
          <label className="switch">
            <span className={!useSolfege ? "switch-active" : ""}>1 2 3</span>
            <input
              type="checkbox"
              checked={useSolfege}
              onChange={() => setUseSolfege((v) => { const next = !v; localStorage.setItem("useSolfege", next ? "1" : "0"); return next; })}
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
            <span className={useSolfege ? "switch-active" : ""}>Do Re Mi</span>
          </label>
        </div>
      </div>
    </div>
  );
}
