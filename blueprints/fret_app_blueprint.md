# fret_app_blueprint

**Working title:** The Grimoire (fretboard shape engine + lead machine)
**Owner/user:** one (1) — and that's the point
**Cost target:** $0 hosting, $0 dependencies, no ads, private login
**Status:** blueprint

---

## 1. What this is

A client-only web app that:

1. Renders any **scale in any key** on a configurable-tuning fretboard.
2. Overlays **shape libraries** (sweeps, power chords, inversions, arps, boxes) that
   auto-place themselves correctly against the active key/scale — including flagging
   where a shape is *illegal* for the scale.
3. Generates **lead lines**: pitch sequences from scalar grammars (runs in 2–4s,
   sequences, skips, pedals), then assigns fingerings via a cost-optimized
   pathfinder — so string-change behavior (incl. the G→B offset) **emerges from the
   tuning data**, never from hardcoded rules.
4. Exports: SVG diagrams (for tutorials/site) and MIDI (into the DAW).

Everything is arithmetic on integers mod 12. There is no server-side problem here.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **React + TypeScript + Vite** | Fast dev loop, typed domain model, static build |
| Rendering | **SVG** (plain JSX, no chart lib) | Every note is a clickable DOM node; exports clean; animates free |
| State | **Zustand** (or useState to start) | Tiny, no boilerplate |
| Audio (stretch) | **Tone.js** | Hear shapes/leads in-browser |
| MIDI export (stretch) | **midi-writer-js** | Pure JS, no backend needed |
| Auth | **Cloudflare Access** (Zero Trust) in front of the site | Free tier, no auth code to write at all |
| Hosting | **Cloudflare Pages** | Same account as nthpulse.com; static; free; built-in analytics for "keeping eyes on traffic" |
| Tests | **Vitest** | The theory engine is pure functions — cheap to test, worth testing |

**No backend. No database. No Python.** The "login" is Cloudflare Access gating the
deployment (email allowlist of one) — zero auth code, actual security, free.

---

## 3. Core data model

```typescript
// ---- Everything is semitones. Names come last. ----

type Tuning = number[];          // MIDI numbers, low to high
const E_STANDARD: Tuning = [40, 45, 50, 55, 59, 64];  // E A D G B E
// note: B string's 4-semitone gap is IN THE DATA. This is why nothing
// about string-crossing ever needs to be hardcoded.

type Scale = { name: string; intervals: number[] };
const SCALES: Scale[] = [
  { name: "major",          intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: "naturalMinor",   intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: "harmonicMinor",  intervals: [0, 2, 3, 5, 7, 8, 11] },
  { name: "phrygianDom",    intervals: [0, 1, 4, 5, 7, 8, 10] },
  // append forever
];

// A shape is DATA, not code. The library grows by JSON, not by features.
type ShapeNote = { string: number; fretOffset: number; finger?: 1|2|3|4; order?: number };
type Shape = {
  id: string;                 // "sweep-min-type1"
  label: string;              // "Sweep (minor) — Type 1"
  category: "sweep" | "powerchord" | "arp" | "box" | "interval";
  notes: ShapeNote[];         // offsets relative to root position
  rootString: number;         // which string carries the root
  validDegrees?: number[];    // scale degrees this shape may sit on (else: validate by notes)
  pickPath?: ("D"|"U")[];     // pick strokes in `order` order (sweeps care)
};

type Placement = { string: number; fret: number; role: "root"|"chord"|"scale"|"illegal" };
```

---

## 4. Theory engine (pure functions, ~100 lines total)

```typescript
const pc = (midi: number) => ((midi % 12) + 12) % 12;   // pitch class

function scaleSet(keyPc: number, scale: Scale): Set<number> {
  return new Set(scale.intervals.map(iv => pc(keyPc + iv)));
}

// All places a pitch is playable on this neck
function candidates(midi: number, tuning: Tuning, maxFret = 24) {
  return tuning.flatMap((open, s) => {
    const fret = midi - open;
    return fret >= 0 && fret <= maxFret ? [{ string: s, fret }] : [];
  });
}

// Drop a shape at a root fret; classify every note against the active scale
function placeShape(shape: Shape, rootFret: number, keyPc: number,
                    scale: Scale, tuning: Tuning): Placement[] {
  const legal = scaleSet(keyPc, scale);
  return shape.notes.map(n => {
    const fret = rootFret + n.fretOffset;
    const midi = tuning[n.string] + fret;
    const isRoot = pc(midi) === keyPc;
    return {
      string: n.string, fret,
      role: isRoot ? "root" : legal.has(pc(midi)) ? "chord" : "illegal",
    };
  });
}
// "illegal" rendering is a FEATURE: it teaches where sweep type 1
// does and doesn't live in F harmonic minor.
```

---

## 5. Lead machine

### 5a. Pitch grammar (fretboard-blind)

```typescript
type Grammar =
  | { kind: "run",      group: 2|3|4, dir: "up"|"down"|"updown" }
  | { kind: "sequence", pattern: number[] }        // e.g. [0,1,2,-1] = up-3-back-1
  | { kind: "skip",     interval: number }          // scalar 3rds, 4ths...
  | { kind: "pedal",    pedalDegree: number };      // return-to-pedal figures

function generatePitches(keyPc: number, scale: Scale, g: Grammar,
                         startDegree: number, length: number): number[] {
  // walk scale degrees per grammar; map degrees -> MIDI in a chosen octave band
  // pure function: degrees in, MIDI list out. Test the hell out of it.
}
```

### 5b. Fingering assignment = shortest path (the soul of the machine)

Build a lattice: column *i* = all `candidates()` for note *i*. Edge cost between
consecutive positions:

```typescript
type Weights = {
  fretDistance: number;      // hand travel
  stringCross: number;       // per string crossed
  positionShift: number;     // leaving the current 4–5 fret box
  npsViolation: number;      // deviation from target notes-per-string
  insidePicking: number;     // string change against pick direction
};

function cost(a: Pos, b: Pos, w: Weights, pickDir: "D"|"U"): number {
  return w.fretDistance  * Math.abs(a.fret - b.fret)
       + w.stringCross   * Math.abs(a.string - b.string)
       + w.positionShift * (outsideBox(a, b) ? 1 : 0)
       + w.npsViolation  * npsDeviation(/* running count */)
       + w.insidePicking * (isInsideCross(a, b, pickDir) ? 1 : 0);
}

// Viterbi / DP over the lattice: O(notes × candidates²). Instant at lead scale.
function assignFingering(pitches: number[], tuning: Tuning, w: Weights): Pos[] {
  // dp[i][c] = min cost to reach candidate c of note i (+ backpointer)
  // return argmin path
}
```

**Weights are playing styles.** Expose as sliders/presets:

| Preset | Tweak | Result |
|---|---|---|
| Shredder | high `npsViolation` (target 3nps) | Gilbert-style laddered runs |
| Boxy | high `positionShift` | pentatonic-box phrasing |
| Sweeper | cheap `stringCross` | diagonal, sweep-adjacent paths |
| Economy | high `insidePicking` | fingerings that respect pick mechanics |

The G→B funkiness needs **zero special handling**: candidate arithmetic on the
tuning array already shifts everything one fret across that boundary, and the
optimizer routes through or around it purely by cost.

### 5c. Output

- SVG overlay: ordered path + pick-stroke annotations → a *practicable exercise*
- MIDI export → DAW synth lead (the app feeds the catalog, not just the hands)

---

## 6. UI sketch

```
[Key: F ▾] [Scale: Harmonic Minor ▾] [Tuning: E Std ▾]

┌─ Shapes ────────────────────────────────┐
│ Sweeps:      [Type 1] [Type 2]          │
│ Power:       [Root] [Inv 1] [Inv 2]     │
│ Arps:        [Maj] [Min] [Dim7]         │
└─────────────────────────────────────────┘

┌─ Lead Machine ──────────────────────────┐
│ Grammar: [Run 4s ▾]  Start: [deg 1 ▾]   │
│ Style:  travel ──○───  3nps ────○─      │
│         boxy  ─○────   economy ──○──    │
│ [Generate] [Play] [Export MIDI] [SVG]   │
└─────────────────────────────────────────┘

┌─ Fretboard (SVG) ───────────────────────┐
│  ● root  ○ scale  ◉ shape  ✕ illegal    │
│  (click any note → tone; hover → name)  │
└─────────────────────────────────────────┘
```

---

## 7. Build order

| Phase | Deliverable | Size |
|---|---|---|
| 1 | Fretboard SVG renders key+scale | one evening |
| 2 | Shape JSON + `placeShape` + legality coloring | one evening |
| 3 | Category button rows filtering shape library | one evening |
| 4 | Pitch grammars (`run`, `sequence`) + tests | one evening |
| 5 | DP fingering engine + weight sliders | a weekend |
| 6 | Pick-direction model + SVG path overlay | an evening |
| 7 | Tone.js playback; MIDI export | stretch |
| 8 | Cloudflare Access + Pages deploy | an hour |

Ship after Phase 3 — it's already the ad-free shape tool that doesn't exist.
Phases 4–6 are the grimoire.

---

## 8. Why this is worth building even for one user

- **Portfolio:** typed domain model + graph optimization + interactive SVG —
  reads senior-er than another CRUD app. Plausible WGU capstone skeleton.
- **Content pipeline:** every tutorial's fretboard diagram exports from here,
  on-brand, forever.
- **SEO surface (if ever made public):** interactive tools are elite long-tail
  bait on nthpulse.com.
- **Practice curriculum:** the lead machine generates exactly the exercises the
  hands need next, annotated with pick strokes.
- **It's yours.** Vocabulary in JSON, mechanics in the cost function, taste in
  the weights. Nobody sells this because nobody else is the target market.

---

## 9. Non-goals (write them down so scope stays dead)

- No accounts/multi-user. Cloudflare Access allowlist of one.
- No backend, ever, until a feature *proves* it needs one (none currently do).
- No monetization planning. Asset value ≠ revenue value.
- No tab-format import/export (rabbit hole; MIDI + SVG cover real needs).
- No mobile app. Responsive web is sufficient.
