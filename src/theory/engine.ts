import type { Tuning, Scale, Shape, Placement } from "./types";

/** Pitch class: any MIDI number -> 0..11 */
export const pc = (midi: number): number => ((midi % 12) + 12) % 12;

/** The set of pitch classes belonging to a key + scale. */
export function scaleSet(keyPc: number, scale: Scale): Set<number> {
  return new Set(scale.intervals.map((iv) => pc(keyPc + iv)));
}

/** All places a given pitch is playable on this neck. */
export function candidates(
  midi: number,
  tuning: Tuning,
  maxFret = 24
): { string: number; fret: number }[] {
  return tuning.flatMap((open, s) => {
    const fret = midi - open;
    return fret >= 0 && fret <= maxFret ? [{ string: s, fret }] : [];
  });
}

/** Drop a shape at a root fret; classify every note against the active scale. */
export function placeShape(
  shape: Shape,
  rootFret: number,
  keyPc: number,
  scale: Scale,
  tuning: Tuning
): Placement[] {
  const legal = scaleSet(keyPc, scale);
  return shape.notes.map((n) => {
    const fret = rootFret + n.fretOffset;
    const midi = tuning[n.string] + fret;
    const isRoot = pc(midi) === keyPc;
    return {
      string: n.string,
      fret,
      role: isRoot ? "root" : legal.has(pc(midi)) ? "chord" : "illegal",
    };
  });
}
