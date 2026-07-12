import { useState } from "react";
import { Fretboard } from "./components/Fretboard";
import { SCALES, E_STANDARD, NOTE_NAMES } from "./theory/data";

export default function App() {
  const [keyPc, setKeyPc] = useState(5); // F
  const [scaleName, setScaleName] = useState("harmonicMinor");

  const scale = SCALES.find((s) => s.name === scaleName) ?? SCALES[0];

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.4rem" }}>The Grimoire</h1>

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
            onChange={(e) => setKeyPc(Number(e.target.value))}
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
            onChange={(e) => setScaleName(e.target.value)}
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
    </main>
  );
}
