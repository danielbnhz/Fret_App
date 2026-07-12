import type { Tuning, Scale, Placement } from "./types";
import { pc } from "./engine";
import { NOTE_NAMES } from "./data";

// ---- Diatonic chord construction: stack every-other scale degree ----

export type DiatonicChord = {
  degree: number;        // 0-based scale degree of the chord root
  rootPc: number;        // pitch class of the chord root
  pcs: Set<number>;      // all chord-tone pitch classes (7th chords: 4 tones)
  name: string;          // e.g. "Fm(maj7)"
  numeral: string;       // e.g. "i", "V", "vii°"
};

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

function qualityName(third: number, fifth: number, seventh: number): string {
  if (third === 4 && fifth === 7 && seventh === 11) return "maj7";
  if (third === 4 && fifth === 7 && seventh === 10) return "7";
  if (third === 3 && fifth === 7 && seventh === 10) return "m7";
  if (third === 3 && fifth === 7 && seventh === 11) return "m(maj7)";
  if (third === 3 && fifth === 6 && seventh === 10) return "m7b5";
  if (third === 3 && fifth === 6 && seventh === 9) return "dim7";
  if (third === 4 && fifth === 8 && seventh === 11) return "maj7#5";
  return "?"; // exotic scale produced something unnamed — still playable
}

export function diatonicChords(keyPc: number, scale: Scale): DiatonicChord[] {
  const iv = scale.intervals;
  const n = iv.length;
  return iv.map((rootIv, d) => {
    const at = (step: number) => (iv[(d + step) % n] + (d + step >= n ? 12 : 0));
    const third = (at(2) - rootIv + 24) % 12;
    const fifth = (at(4) - rootIv + 24) % 12;
    const seventh = (at(6) - rootIv + 24) % 12;
    const rootPc = pc(keyPc + rootIv);
    const quality = qualityName(third, fifth, seventh);
    const minorish = third === 3;
    let numeral = minorish ? NUMERALS[d].toLowerCase() : NUMERALS[d];
    if (fifth === 6) numeral += "°";
    if (fifth === 8) numeral += "+";
    return {
      degree: d,
      rootPc,
      pcs: new Set([rootPc, pc(rootPc + third), pc(rootPc + fifth), pc(rootPc + seventh)]),
      name: `${NOTE_NAMES[rootPc]}${quality}`,
      numeral,
    };
  });
}

// ---- Sweep shape deduction ----
// A sweep = one chord tone per string inside a compact fret window.
// Deterministic search: slide a 5-fret window up the neck, pick the
// best-scoring placement. Same inputs -> same shape, every time.

export function deduceSweepShape(
  chord: DiatonicChord,
  tuning: Tuning,
  maxFret = 15,
  windowSize = 5
): Placement[] | null {
  let best: Placement[] | null = null;
  let bestScore = Infinity;

  for (let lo = 0; lo <= maxFret - (windowSize - 1); lo++) {
    const hi = lo + (windowSize - 1);
    const picks: Placement[] = [];
    let ok = true;

    for (let s = 0; s < tuning.length; s++) {
      const options: number[] = [];
      for (let f = lo; f <= hi; f++) {
        if (chord.pcs.has(pc(tuning[s] + f))) options.push(f);
      }
      if (options.length === 0) {
        ok = false;
        break;
      }
      let fret: number;
      if (s === 0) {
        // prefer the root under the lowest string
        fret = options.find((f) => pc(tuning[s] + f) === chord.rootPc) ?? options[0];
      } else {
        // prefer the tone closest to the previous string's fret (compactness)
        const prev = picks[picks.length - 1].fret;
        fret = options.reduce((a, b) =>
          Math.abs(b - prev) < Math.abs(a - prev) ? b : a
        );
      }
      picks.push({
        string: s,
        fret,
        role: pc(tuning[s] + fret) === chord.rootPc ? "root" : "chord",
      });
    }

    if (!ok) continue;

    const frets = picks.map((p) => p.fret);
    const span = Math.max(...frets) - Math.min(...frets);
    const rootOnBottom = picks[0].role === "root" ? 0 : 4; // strong preference
    const score = span + rootOnBottom + lo * 0.01; // tie-break: lower position wins
    if (score < bestScore) {
      bestScore = score;
      best = picks;
    }
  }

  return best;
}
