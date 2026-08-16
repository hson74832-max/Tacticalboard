import { PITCH_W, PITCH_H, type PitchMode } from "../types";

interface Props {
  grass: string;
  stripe: string;
  line: string;
  mode: PitchMode;
}

/**
 * Vertical football pitch (units: 68 x 105).
 * Goals at top (y=0) and bottom (y=105).
 */
export default function Pitch({ grass, stripe, line, mode }: Props) {
  const lineW = 0.3;
  const cx = PITCH_W / 2;
  const cy = PITCH_H / 2;

  // Real-football dimensions (metres)
  const penW = 40.32;
  const penD = 16.5;
  const goalAreaW = 18.32;
  const goalAreaD = 5.5;
  const penX = cx - penW / 2;
  const gaX = cx - goalAreaW / 2;
  const goalW = 7.32;
  const goalX = cx - goalW / 2;
  const penaltySpot = 11;
  const arcR = 9.15;

  // For the penalty arc ("D"): it's the part of a circle (centre = penalty spot, r = 9.15)
  // that lies OUTSIDE the penalty box (i.e. y > penD for top side).
  // The circle intersects y = penD at:  (penD - penaltySpot)^2 + dx^2 = arcR^2
  //   dx = sqrt(arcR^2 - (penD - penaltySpot)^2)
  const dx = Math.sqrt(arcR * arcR - (penD - penaltySpot) * (penD - penaltySpot));

  // Top arc endpoints (on the penalty box line y = penD)
  const topArcStart = { x: cx + dx, y: penD };
  const topArcEnd = { x: cx - dx, y: penD };
  // Bottom arc endpoints (on the line y = PITCH_H - penD)
  const botArcStart = { x: cx - dx, y: PITCH_H - penD };
  const botArcEnd = { x: cx + dx, y: PITCH_H - penD };

  const stripeCount = 12;
  const stripeH = PITCH_H / stripeCount;

  return (
    <g>
      {/* Grass base */}
      <rect x={-10} y={-10} width={PITCH_W + 20} height={PITCH_H + 20} fill={grass} />
      {/* Mowing stripes */}
      {Array.from({ length: stripeCount }).map((_, i) =>
        i % 2 === 0 ? (
          <rect
            key={i}
            x={-10}
            y={i * stripeH}
            width={PITCH_W + 20}
            height={stripeH}
            fill={stripe}
          />
        ) : null,
      )}

      {mode === "standard" && (
      <g fill="none" stroke={line} strokeWidth={lineW} strokeLinejoin="miter">
        {/* Outer boundary */}
        <rect x={0} y={0} width={PITCH_W} height={PITCH_H} />
        {/* Halfway line */}
        <line x1={0} y1={cy} x2={PITCH_W} y2={cy} />
        {/* Center circle + spot */}
        <circle cx={cx} cy={cy} r={arcR} />
        <circle cx={cx} cy={cy} r={0.4} fill={line} stroke="none" />

        {/* ---------- TOP HALF ---------- */}
        {/* Penalty area */}
        <rect x={penX} y={0} width={penW} height={penD} />
        {/* Goal area (6-yard box) */}
        <rect x={gaX} y={0} width={goalAreaW} height={goalAreaD} />
        {/* Penalty spot */}
        <circle cx={cx} cy={penaltySpot} r={0.4} fill={line} stroke="none" />
        {/* Penalty arc ("D") — curves AWAY from the goal, outside the box */}
        <path
          d={`M ${topArcStart.x} ${topArcStart.y} A ${arcR} ${arcR} 0 0 1 ${topArcEnd.x} ${topArcEnd.y}`}
        />
        {/* Goal */}
        <rect x={goalX} y={-1.6} width={goalW} height={1.6} fill={line} fillOpacity={0.3} />

        {/* ---------- BOTTOM HALF ---------- */}
        <rect x={penX} y={PITCH_H - penD} width={penW} height={penD} />
        <rect x={gaX} y={PITCH_H - goalAreaD} width={goalAreaW} height={goalAreaD} />
        <circle cx={cx} cy={PITCH_H - penaltySpot} r={0.4} fill={line} stroke="none" />
        <path
          d={`M ${botArcStart.x} ${botArcStart.y} A ${arcR} ${arcR} 0 0 1 ${botArcEnd.x} ${botArcEnd.y}`}
        />
        <rect x={goalX} y={PITCH_H} width={goalW} height={1.6} fill={line} fillOpacity={0.3} />

        {/* Corner arcs (quarter circles, r=1, curving inward) */}
        <path d={`M 1 0 A 1 1 0 0 1 0 1`} />
        <path d={`M ${PITCH_W} 1 A 1 1 0 0 1 ${PITCH_W - 1} 0`} />
        <path d={`M ${PITCH_W - 1} ${PITCH_H} A 1 1 0 0 1 ${PITCH_W} ${PITCH_H - 1}`} />
        <path d={`M 0 ${PITCH_H - 1} A 1 1 0 0 1 1 ${PITCH_H}`} />
      </g>
      )}

      {mode === "funino" && <FuninoLines line={line} lineW={lineW} />}
    </g>
  );
}

function FuninoLines({ line, lineW }: { line: string; lineW: number }) {
  const cx = PITCH_W / 2;
  const miniGoalW = 8;
  const miniGoalD = 1.4;
  const lane = 15;
  const goalYTop = -miniGoalD;
  const goalYBottom = PITCH_H;

  return (
    <g fill="none" stroke={line} strokeWidth={lineW} strokeLinejoin="miter">
      <rect x={0} y={0} width={PITCH_W} height={PITCH_H} />
      <line x1={0} y1={PITCH_H / 2} x2={PITCH_W} y2={PITCH_H / 2} />
      <line x1={0} y1={lane} x2={PITCH_W} y2={lane} strokeDasharray="1.4 1.4" />
      <line x1={0} y1={PITCH_H - lane} x2={PITCH_W} y2={PITCH_H - lane} strokeDasharray="1.4 1.4" />

      {/* Four small FUNino target goals */}
      <rect x={10} y={goalYTop} width={miniGoalW} height={miniGoalD} fill={line} fillOpacity={0.28} />
      <rect x={PITCH_W - 18} y={goalYTop} width={miniGoalW} height={miniGoalD} fill={line} fillOpacity={0.28} />
      <rect x={10} y={goalYBottom} width={miniGoalW} height={miniGoalD} fill={line} fillOpacity={0.28} />
      <rect x={PITCH_W - 18} y={goalYBottom} width={miniGoalW} height={miniGoalD} fill={line} fillOpacity={0.28} />
      <circle cx={cx} cy={PITCH_H / 2} r={0.4} fill={line} stroke="none" />
    </g>
  );
}
