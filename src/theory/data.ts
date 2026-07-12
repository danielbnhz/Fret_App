import type { Tuning, Scale } from "./types";

// E A D G B E — the B string's 4-semitone gap is IN THE DATA.
export const E_STANDARD: Tuning = [40, 45, 50, 55, 59, 64];

export const SCALES: Scale[] = [
  { name: "major",         label: "Major",             intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: "naturalMinor",  label: "Natural minor",     intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: "harmonicMinor", label: "Harmonic minor",    intervals: [0, 2, 3, 5, 7, 8, 11] },
  { name: "phrygianDom",   label: "Phrygian dominant", intervals: [0, 1, 4, 5, 7, 8, 10] },
  // append forever
];

export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

export const MAX_FRET = 15;

export const INLAY_FRETS = [3, 5, 7, 9, 12, 15];
