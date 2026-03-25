import Soundfont, { type Player } from "soundfont-player";

let audioCtx: AudioContext | null = null;
let piano: Player | null = null;
let pianoLoading: Promise<Player> | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    // Use "playback" category on iOS so audio plays even when the mute switch is on
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = new AudioCtx({
      // @ts-expect-error — webkit-only option, not in the TS typings
      audioCategory: "playback",
    });
  }
  return audioCtx;
}

async function getPiano(): Promise<Player> {
  const ctx = getAudioContext();
  if (piano) return piano;
  if (pianoLoading) return pianoLoading;
  pianoLoading = Soundfont.instrument(ctx, "acoustic_grand_piano").then(
    (p) => {
      piano = p;
      return p;
    }
  );
  return pianoLoading;
}

export async function loadAudio(): Promise<void> {
  await getPiano();
}

// I – V – I cadence: C major, G major, C major (block chords)
const CADENCE_CHORDS = [
  ["C4", "E4", "G4"],       // I  (C major)
  ["B3", "D4", "G4"],       // V  (G major)
  ["C4", "E4", "G4"],       // I  (C major)
];
const CADENCE_CHORD_DURATION = 0.4;
const CADENCE_CHORD_GAP = 0.05;
const CADENCE_PAUSE = 0.5;

export async function playCadence(): Promise<void> {
  const p = await getPiano();
  const ctx = getAudioContext();
  const startTime = ctx.currentTime + 0.05;

  for (let i = 0; i < CADENCE_CHORDS.length; i++) {
    const time = startTime + i * (CADENCE_CHORD_DURATION + CADENCE_CHORD_GAP);
    for (const note of CADENCE_CHORDS[i]) {
      p.play(note, time, { duration: CADENCE_CHORD_DURATION, gain: 1.5 });
    }
  }

  const totalDuration =
    CADENCE_CHORDS.length * (CADENCE_CHORD_DURATION + CADENCE_CHORD_GAP) +
    CADENCE_PAUSE;
  return new Promise((resolve) => setTimeout(resolve, totalDuration * 1000));
}

export async function playSequence(notes: string[]): Promise<void> {
  const p = await getPiano();
  const noteDuration = 0.5;
  const gap = 0.1;
  const ctx = getAudioContext();
  const startTime = ctx.currentTime + 0.05;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i].trim();
    p.play(note, startTime + i * (noteDuration + gap), {
      duration: noteDuration,
      gain: 3,
    });
  }

  const totalDuration = notes.length * (noteDuration + gap);
  return new Promise((resolve) => setTimeout(resolve, totalDuration * 1000));
}
