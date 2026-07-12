import type { Tuning, Scale } from "../theory/types";
import { pc, scaleSet } from "../theory/engine";
import { NOTE_NAMES, MAX_FRET, INLAY_FRETS } from "../theory/data";

type FretboardProps = {
  keyPc: number;
  scale: Scale;
  tuning: Tuning;
};

// Layout constants — decide once, change never (see coordinate conventions).
const WIDTH = 900;
const LEFT = 44; // room for open-string labels
const TOP = 20;
const STRING_GAP = 30;
const FRET_W = (WIDTH - LEFT - 16) / MAX_FRET;

export function Fretboard({ keyPc, scale, tuning }: FretboardProps) {
  const legal = scaleSet(keyPc, scale);
  const nStrings = tuning.length;
  const boardBottom = TOP + STRING_GAP * (nStrings - 1);
  const height = boardBottom + 44;

  // Convention: low string (index 0) at the BOTTOM, like tab.
  const stringY = (s: number) => TOP + (nStrings - 1 - s) * STRING_GAP;
  // Convention: fret 0 (open) sits ON the nut line; fretted notes center
  // in the space between fret wires.
  const noteX = (f: number) => (f === 0 ? LEFT : LEFT + f * FRET_W - FRET_W / 2);

  const dots: {
    string: number;
    fret: number;
    midi: number;
    isRoot: boolean;
  }[] = [];

  for (let s = 0; s < nStrings; s++) {
    for (let f = 0; f <= MAX_FRET; f++) {
      const midi = tuning[s] + f;
      if (legal.has(pc(midi))) {
        dots.push({ string: s, fret: f, midi, isRoot: pc(midi) === keyPc });
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label={`${NOTE_NAMES[keyPc]} ${scale.label} on the fretboard`}
    >
      {/* fret wires (fret 0 drawn thick = the nut) */}
      {Array.from({ length: MAX_FRET + 1 }, (_, f) => (
        <line
          key={`fret-${f}`}
          x1={LEFT + f * FRET_W}
          y1={TOP}
          x2={LEFT + f * FRET_W}
          y2={boardBottom}
          stroke="#888"
          strokeWidth={f === 0 ? 4 : 1}
        />
      ))}

      {/* fret number labels at inlay positions */}
      {INLAY_FRETS.map((f) => (
        <text
          key={`num-${f}`}
          x={LEFT + f * FRET_W - FRET_W / 2}
          y={boardBottom + 26}
          textAnchor="middle"
          fontSize={12}
          fill="#999"
        >
          {f}
        </text>
      ))}

      {/* strings + open-string names */}
      {tuning.map((open, s) => (
        <g key={`string-${s}`}>
          <line
            x1={LEFT}
            y1={stringY(s)}
            x2={WIDTH - 16}
            y2={stringY(s)}
            stroke="#bbb"
            strokeWidth={1}
          />
          <text
            x={LEFT - 16}
            y={stringY(s) + 4}
            textAnchor="middle"
            fontSize={12}
            fill="#777"
          >
            {NOTE_NAMES[pc(open)]}
          </text>
        </g>
      ))}

      {/* note dots */}
      {dots.map((d) => (
        <g key={`${d.string}-${d.fret}`}>
          <circle
            cx={noteX(d.fret)}
            cy={stringY(d.string)}
            r={10}
            fill={d.isRoot ? "#d85a30" : "#1d9e75"}
          >
            <title>{NOTE_NAMES[pc(d.midi)]}</title>
          </circle>
          {d.isRoot && (
            <circle
              cx={noteX(d.fret)}
              cy={stringY(d.string)}
              r={10}
              fill="none"
              stroke="#712b13"
              strokeWidth={2}
            />
          )}
        </g>
      ))}
    </svg>
  );
}
