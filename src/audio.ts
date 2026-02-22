import Soundfont, { type Player } from "soundfont-player";

let audioCtx: AudioContext | null = null;
let piano: Player | null = null;
let loadingPromise: Promise<Player> | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

async function getPiano(): Promise<Player> {
  const ctx = getAudioContext();
  if (piano) return piano;
  if (loadingPromise) return loadingPromise;
  loadingPromise = Soundfont.instrument(ctx, "acoustic_grand_piano").then(
    (p) => {
      piano = p;
      return p;
    }
  );
  return loadingPromise;
}

export async function loadAudio(): Promise<void> {
  await getPiano();
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
