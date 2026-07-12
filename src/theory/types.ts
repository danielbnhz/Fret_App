// ---- Everything is semitones. Names come last. ----

export type Tuning = number[]; // MIDI numbers, low to high

export type Scale = {
  name: string;
  label: string;
  intervals: number[];
};

// A shape is DATA, not code. (Used starting Phase 2.)
export type ShapeNote = {
  string: number;
  fretOffset: number;
  finger?: 1 | 2 | 3 | 4;
  order?: number;
};

export type Shape = {
  id: string;
  label: string;
  category: "sweep" | "powerchord" | "arp" | "box" | "interval";
  notes: ShapeNote[];
  rootString: number;
  validDegrees?: number[];
  pickPath?: ("D" | "U")[];
};

export type Placement = {
  string: number;
  fret: number;
  role: "root" | "chord" | "scale" | "illegal";
};
