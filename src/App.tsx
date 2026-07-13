import { useState } from "react";
import { Fretboard } from "./components/Fretboard";
import { SCALES, E_STANDARD, NOTE_NAMES } from "./theory/data";
import { diatonicChords, deduceSweepShape, type ChordSize } from "./theory/chords";

export default function App() {
  const [keyPc, setKeyPc] = useState(5); // F
  const [scaleName, setScaleName] = useState("harmonicMinor");
  const [chordDegree, setChordDegree] = useState(0); // tonic on load

  const [chordSize, setChordSize] = useState<ChordSize>(4);
  const scale = SCALES.find((s) => s.name === scaleName) ?? SCALES[0];

  const chords = diatonicChords(keyPc, scale, chordSize);

  const chord = chords[Math.min(chordDegree, chords.length - 1)];
  const sweep = deduceSweepShape(chord, E_STANDARD);

  // Changing key or scale snaps back to the tonic chord.
  const changeKey = (v: number) => {
    setKeyPc(v);
    setChordDegree(0);
  };
  const changeScale = (v: string) => {
    setScaleName(v);
    setChordDegree(0);
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.4rem" }}>The Grimoire</h1>

      {/* ---- the constant self: key + scale, always visible ---- */}
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          alignItems: "center",
          margin: "1rem 0",
          flexWrap: "wrap",
        }}
      >
        <label>
          Key{" "}
          <select
            value={keyPc}
            onChange={(e) => changeKey(Number(e.target.value))}
          >
            {NOTE_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Scale{" "}
          <select
            value={scaleName}
            onChange={(e) => changeScale(e.target.value)}
          >
            {SCALES.map((s) => (
              <option key={s.name} value={s.name}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Fretboard keyPc={keyPc} scale={scale} tuning={E_STANDARD} />

      {/* ---- the mutable self: the module workspace ---- */}
      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Sweep</h2>
            <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0" }}>
              {([3, 4] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setChordSize(size)}
                  style={{
                    padding: "0.3rem 0.7rem",
                    border: chordSize === size ? "2px solid #1d9e75" : "1px solid #999",
                    borderRadius: 6,
                    background: "transparent",
                    cursor: "pointer",
                    fontWeight: chordSize === size ? 600 : 400,
                  }}
                >
                  {size === 3 ? "Triads" : "7th chords"}
                </button>
              ))}
            </div>        
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            margin: "0.75rem 0",
          }}
        >
          {chords.map((c) => (
            <button
              key={c.degree}
              onClick={() => setChordDegree(c.degree)}
              style={{
                padding: "0.4rem 0.8rem",
                border:
                  c.degree === chord.degree
                    ? "2px solid #d85a30"
                    : "1px solid #999",
                borderRadius: 6,
                background: "transparent",
                cursor: "pointer",
                fontWeight: c.degree === chord.degree ? 600 : 400,
              }}
            >
              {c.numeral} · {c.name}
            </button>
          ))}
        </div>

        {sweep ? (
          <Fretboard
            keyPc={chord.rootPc}
            scale={scale}
            tuning={E_STANDARD}
            placements={sweep}
            ghostPcs={chord.pcs}
          />
        ) : (
          <p>No compact sweep found for {chord.name} within 15 frets.</p>
        )}
      </section>
    </main>
  );
}
