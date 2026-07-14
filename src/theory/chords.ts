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
export type ChordSize = 3 | 4; // triad | seventh

function triadQualityName(third: number, fifth: number): string {
  if (third === 4 && fifth === 7) return "";   // major — bare letter, e.g. "C"
  if (third === 3 && fifth === 7) return "m";
  if (third === 3 && fifth === 6) return "°";
  if (third === 4 && fifth === 8) return "+";
  return "?";
}


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

export function diatonicChords(
  keyPc: number,
  scale: Scale,
  size: ChordSize = 4
): DiatonicChord[] {
  const iv = scale.intervals;
  const n = iv.length;
  return iv.map((rootIv, d) => {
    const at = (step: number) => (iv[(d + step) % n] + (d + step >= n ? 12 : 0));
    const third = (at(2) - rootIv + 24) % 12;
    const fifth = (at(4) - rootIv + 24) % 12;
    const rootPc = pc(keyPc + rootIv);

    const pcs = new Set([rootPc, pc(rootPc + third), pc(rootPc + fifth)]);
    let quality: string;
    if (size === 4) {
      const seventh = (at(6) - rootIv + 24) % 12;
      pcs.add(pc(rootPc + seventh));
      quality = qualityName(third, fifth, seventh);
    } else {
      quality = triadQualityName(third, fifth);
    }

    const minorish = third === 3;
    let numeral = minorish ? NUMERALS[d].toLowerCase() : NUMERALS[d];
    if (fifth === 6) numeral += "°";
    if (fifth === 8) numeral += "+";

    return {
      degree: d,
      rootPc,
      pcs,
      name: `${NOTE_NAMES[rootPc]}${quality}`,
      numeral,
    };
  });
}

// ---- Sweep shape deduction ----
// A sweep = one chord tone per string inside a compact fret window.
// Deterministic search: slide a 5-fret window up the neck, pick the
// best-scoring placement. Same inputs -> same shape, every time.
//
// Playability rule: a two-string same-fret pair is fine (rolled
// mini-barre — idiomatic sweep technique), but 3+ consecutive strings
// on the same fret is a barre, and barres don't articulate as sweeps.
// We avoid them at pick time and penalize them at score time.

/** Length of the same-fret run ending at the last pick (>=1). */
function tailRun(picks: Placement[]): number {
  let run = 1;
  for (
    let k = picks.length - 1;
    k > 0 && picks[k].fret === picks[k - 1].fret;
    k--
  ) {
    run++;
  }
  return run;
}

/** Penalty for same-fret runs of 3+ adjacent strings: +10 per string beyond a pair. */
function barrePenalty(frets: number[]): number {
  let penalty = 0;
  let run = 1;
  for (let i = 1; i < frets.length; i++) {
    run = frets[i] === frets[i - 1] ? run + 1 : 1;
    if (run >= 3) penalty += 10;
  }
  return penalty;
}

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
        const prev = picks[picks.length - 1].fret;
        // Would picking `f` extend an existing same-fret pair into a 3+ barre?
        const run = tailRun(picks);
        const extendsBarre = (f: number) => f === prev && run >= 2;
        // Prefer barre-free candidates; fall back to all options if none exist.
        const safe = options.filter((f) => !extendsBarre(f));
        const pool = safe.length > 0 ? safe : options;
        // Among the pool, prefer the tone closest to the previous string's fret
        // (compactness). Ties resolve to the lower fret — deterministic.
        fret = pool.reduce((a, b) =>
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
    const score =
      span + rootOnBottom + barrePenalty(frets) + lo * 0.01; // tie-break: lower position wins
    if (score < bestScore) {
      bestScore = score;
      best = picks;
    }
  }

  return best;
}
