import type { DrawingEl, EquipmentEl, PlayerEl, Point } from "../types";

const SELECT = "#fbbf24";

/* ---------------- Player ---------------- */
export function PlayerToken({
  el,
  selected,
}: {
  el: PlayerEl;
  selected: boolean;
}) {
  const r = 2;
  return (
    <g data-id={el.id} style={{ cursor: "grab" }}>
      {/* invisible hit area for easier selection */}
      <circle cx={el.x} cy={el.y} r={4} fill="transparent" stroke="none" />
      {selected && (
        <g className="selection-ring">
          <circle cx={el.x} cy={el.y} r={r + 0.6} fill="none" stroke={SELECT} strokeWidth={0.4} />
          <RotateHandle id={el.id} x={el.x} y={el.y} rotation={el.rotation} radius={4.5} />
        </g>
      )}
      <circle cx={el.x} cy={el.y} r={r} fill={el.color} />
      {/* bigger colour nose / direction marker */}
      <g transform={`rotate(${el.rotation} ${el.x} ${el.y})`}>
        <path
          d={`M ${el.x} ${el.y - r - 1.05} L ${el.x - 0.75} ${el.y - r + 0.25} L ${el.x + 0.75} ${el.y - r + 0.25} Z`}
          fill={el.color}
          fillOpacity={0.95}
        />
      </g>
      {el.label && (
        <text
          x={el.x}
          y={el.y + r + 2.6}
          fontSize={2.4}
          fontWeight={600}
          fill="#ffffff"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={0.15}
          textAnchor="middle"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {el.label}
        </text>
      )}
    </g>
  );
}

/* ---------------- Equipment ---------------- */
export function EquipmentToken({
  el,
  selected,
}: {
  el: EquipmentEl;
  selected: boolean;
}) {
  return (
    <g style={{ cursor: "grab" }}>
      {/* World-space invisible hit area (not affected by transform) */}
      <circle
        data-id={el.id}
        cx={el.x}
        cy={el.y}
        r={5}
        fill="transparent"
        stroke="none"
      />
      <g
        data-id={el.id}
        transform={`translate(${el.x} ${el.y}) rotate(${el.rotation}) scale(${el.scale})`}
        style={{ pointerEvents: "none" }}
      >
        {selected && (
          <g className="selection-ring">
            <rect x={-4} y={-4} width={8} height={8} fill="none" stroke={SELECT} strokeWidth={0.4} pointerEvents="none" />
            <line x1={0} y1={-4} x2={0} y2={-6.2} stroke={SELECT} strokeWidth={0.25} pointerEvents="none" />
          </g>
        )}
        <EquipmentShape el={el} />
      </g>
      {/* Rotate handle drawn in world space (not rotated/scaled with element) */}
      {selected && (
        <g className="selection-ring">
          <RotateHandle id={el.id} x={el.x} y={el.y} rotation={el.rotation} radius={5.8} />
        </g>
      )}
    </g>
  );
}

function RotateHandle({
  id,
  x,
  y,
  rotation,
  radius,
}: {
  id: string;
  x: number;
  y: number;
  rotation: number;
  radius: number;
}) {
  const a = (rotation * Math.PI) / 180;
  const hx = x + Math.sin(a) * radius;
  const hy = y - Math.cos(a) * radius;
  return (
    <g>
      <line x1={x} y1={y} x2={hx} y2={hy} stroke={SELECT} strokeWidth={0.25} />
      <circle
        data-rotate-id={id}
        cx={hx}
        cy={hy}
        r={0.7}
        fill={SELECT}
        stroke="#111827"
        strokeWidth={0.2}
        style={{ cursor: "grab" }}
      />
      {/* invisible larger hit area for touch */}
      <circle
        data-rotate-id={id}
        cx={hx}
        cy={hy}
        r={2.5}
        fill="transparent"
        stroke="none"
        style={{ cursor: "grab" }}
      />
    </g>
  );
}

function EquipmentShape({ el }: { el: EquipmentEl }) {
  const c = el.color;
  switch (el.type) {
    case "ball":
      return <circle r={1.6} fill="#ffffff" />;
    case "cone":
      // Plain triangle, no inner stripe.
      return <path d="M 0 -2.8 L 2.3 2.3 L -2.3 2.3 Z" fill={c} />;
    case "disc":
      // Plain flat disc, no inner marking.
      return <ellipse cx={0} cy={0} rx={2.7} ry={1.15} fill={c} />;
    case "pole":
      return (
        <g>
          <rect x={-0.4} y={-5} width={0.8} height={10} fill={c} />
          <rect x={-0.4} y={-3} width={0.8} height={2} fill="#ffffff" fillOpacity={0.5} />
          <rect x={-0.4} y={1} width={0.8} height={2} fill="#ffffff" fillOpacity={0.5} />
        </g>
      );
    case "ladder":
      return (
        <g stroke={c} strokeWidth={0.5} fill="none" strokeLinecap="square">
          <line x1={-2.2} y1={-6} x2={-2.2} y2={6} />
          <line x1={2.2} y1={-6} x2={2.2} y2={6} />
          {[-5, -3, -1, 1, 3, 5].map((y) => (
            <line key={y} x1={-2.2} y1={y} x2={2.2} y2={y} />
          ))}
        </g>
      );
    case "minigoal":
      return (
        <g>
          {/* net */}
          <g stroke={c} strokeOpacity={0.35} strokeWidth={0.12}>
            {[-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5].map((x) => (
              <line key={`v${x}`} x1={x} y1={-1.5} x2={x} y2={1.5} />
            ))}
            {[-0.9, -0.2, 0.5, 1.2].map((y) => (
              <line key={`h${y}`} x1={-4.2} y1={y} x2={4.2} y2={y} />
            ))}
          </g>
          {/* frame: posts + crossbar only */}
          <path
            d="M -4.2 1.7 L -4.2 -1.6 L 4.2 -1.6 L 4.2 1.7"
            fill="none"
            stroke={c}
            strokeWidth={0.55}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    case "flag":
      return (
        <g>
          <rect x={-0.25} y={-4} width={0.5} height={8} fill="#6b7280" />
          <path d="M0.25 -4 L4 -3 L0.25 -2 Z" fill={c} />
        </g>
      );
    case "barrier":
      return (
        <g>
          <rect x={-4} y={-0.5} width={8} height={1} fill={c} />
          <rect x={-4} y={-0.5} width={1.4} height={1} fill="#ffffff" />
          <rect x={-1.4} y={-0.5} width={1.4} height={1} fill="#ffffff" />
          <rect x={1.4} y={-0.5} width={1.4} height={1} fill="#ffffff" />
          <line x1={-3} y1={0.5} x2={-3.6} y2={2.2} stroke={c} strokeWidth={0.4} />
          <line x1={3} y1={0.5} x2={3.6} y2={2.2} stroke={c} strokeWidth={0.4} />
        </g>
      );
    default:
      return null;
  }
}

/* ---------------- Drawing ---------------- */
export function DrawingPath({
  el,
  selected,
}: {
  el: DrawingEl;
  selected: boolean;
}) {
  if (el.type === "text") {
    const label = el.label || "Text";
    const fontSize = el.width * 5;
    // Handle multi-line text by splitting on newlines
    const lines = label.split("\n");
    const lineHeight = fontSize * 1.4;
    const maxLineLen = Math.max(...lines.map(l => l.length));
    const estW = maxLineLen * fontSize * 0.6 + 2;
    const estH = lines.length * lineHeight + 2;
    const cx = el.points[0].x;
    const cy = el.points[0].y - (lines.length - 1) * lineHeight / 2;
    return (
      <g data-id={el.id} style={{ cursor: "grab" }}>
        {/* invisible hit area so the text can be selected / dragged / erased */}
        <rect
          x={cx - estW / 2}
          y={cy - estH / 2}
          width={estW}
          height={estH}
          fill="transparent"
          stroke="none"
        />
        {selected && (
          <rect
            className="selection-ring"
            x={cx - estW / 2}
            y={cy - estH / 2}
            width={estW}
            height={estH}
            fill="#fbbf24"
            fillOpacity={0.3}
            stroke={SELECT}
            strokeWidth={0.4}
            opacity={0.9}
          />
        )}
        {lines.map((line, i) => (
          <text
            key={i}
            x={cx}
            y={cy + i * lineHeight}
            fontSize={fontSize}
            fontWeight={el.bold ? 700 : 400}
            fill={el.color}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ userSelect: "none", pointerEvents: "none" }}
            whiteSpace="pre"
          >
            {line}
          </text>
        ))}
      </g>
    );
  }

  const curved = isCurvedType(el.type);
  const showArrow = isArrowType(el.type);
  const dash = isDashedType(el.type) ? `${el.width * 2.2} ${el.width * 1.8}` : undefined;
  const dFull = curved ? curvedPathFromPoints(el.points) : pathFromPoints(el.points, el.type === "pen");
  const d = curved
    ? curvedPathFromPoints(el.points, showArrow ? arrowLen(el.width) : 0)
    : pathFromPoints(showArrow && el.points.length >= 2 ? shortenEnd(el.points, arrowLen(el.width)) : el.points, el.type === "pen");

  // For curved arrows, get the proper control points for arrow angle calculation
  let arrowPoints: Point[] | null = null;
  if (showArrow && el.points.length >= 2) {
    if (curved) {
      const ctrlPts = getCurveEndControlPoints(el.points);
      if (ctrlPts) {
        arrowPoints = [ctrlPts.cp2, ctrlPts.end];
      }
    } else {
      arrowPoints = el.points;
    }
  }

  return (
    <g data-id={el.id} style={{ cursor: "grab" }}>
      {/* invisible fat hit area */}
      <path d={dFull} fill="none" stroke="transparent" strokeWidth={el.width + 3} strokeLinecap="round" />
      {selected && (
        <path
          className="selection-ring"
          d={dFull}
          fill="none"
          stroke={SELECT}
          strokeWidth={el.width + 1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.6}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={el.color}
        strokeWidth={el.width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
      {arrowPoints && arrowPoints.length >= 2 && (
        <Arrowhead
          points={arrowPoints}
          color={el.color}
          width={el.width}
        />
      )}
    </g>
  );
}

/** Returns the arrowhead length so the line can be shortened. */
function arrowLen(width: number) {
  return 1.6 + width * 1.2;
}

/** Shortens the last segment of a point array so the line stops at the arrowhead base. */
function shortenEnd(pts: Point[], amount: number): Point[] {
  if (pts.length < 2) return pts;
  const res = pts.slice();
  const p1 = res[res.length - 2];
  const p2 = res[res.length - 1];
  const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  res[res.length - 1] = {
    x: p2.x - amount * Math.cos(ang),
    y: p2.y - amount * Math.sin(ang),
  };
  return res;
}

function Arrowhead({ points, color, width }: { points: Point[]; color: string; width: number }) {
  const p2 = points[points.length - 1];
  const p1 = points[points.length - 2];
  const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const len = arrowLen(width);
  const spread = 0.45;
  const a = { x: p2.x - len * Math.cos(ang - spread), y: p2.y - len * Math.sin(ang - spread) };
  const b = { x: p2.x - len * Math.cos(ang + spread), y: p2.y - len * Math.sin(ang + spread) };
  return <path d={`M ${p2.x} ${p2.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`} fill={color} />;
}

function isArrowType(type: DrawingEl["type"]) {
  return type === "arrow" || type === "dashedArrow" || type === "curveArrow" || type === "curveDashedArrow";
}

function isDashedType(type: DrawingEl["type"]) {
  return type === "dashed" || type === "dashedArrow" || type === "curveDashed" || type === "curveDashedArrow";
}

function isCurvedType(type: DrawingEl["type"]) {
  return type === "curve" || type === "curveDashed" || type === "curveArrow" || type === "curveDashedArrow";
}

/** 
 * Returns the tangent angle at the end of a cubic bezier curve.
 * For a cubic bezier P(t) = (1-t)^3*P0 + 3(1-t)^2*t*CP1 + 3(1-t)*t^2*CP2 + t^3*P3,
 * the tangent at t=1 points from CP2 to P3.
 */
export function getCurveEndAngle(p0: Point, cp1: Point, cp2: Point, p3: Point): number {
  // Tangent at end is from cp2 to p3
  return Math.atan2(p3.y - cp2.y, p3.x - cp2.x);
}

export function curvedPathFromPoints(points: Point[], shortenBy = 0) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  
  // For 2 points, create a single S-curve
  if (points.length === 2) {
    const p1 = points[0];
    const p2 = points[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    
    // Create two control points for an S-shape
    const bend = dist * 0.25;
    const cp1 = { x: p1.x + dx * 0.33 + nx * bend, y: p1.y + dy * 0.33 + ny * bend };
    const cp2 = { x: p1.x + dx * 0.67 - nx * bend, y: p1.y + dy * 0.67 - ny * bend };
    
    let endX = p2.x, endY = p2.y;
    if (shortenBy > 0) {
      const tx = p2.x - cp2.x, ty = p2.y - cp2.y;
      const tLen = Math.hypot(tx, ty) || 1;
      endX = p2.x - (tx / tLen) * shortenBy;
      endY = p2.y - (ty / tLen) * shortenBy;
    }
    return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${endX} ${endY}`;
  }

  // 3+ points: Create continuous S-shaped segments between consecutive points
  // Each segment gets its own S-curve with alternating bends for natural dribbling flow
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy) || 1;
    
    // Skip very short segments
    if (dist < 0.5) continue;
    
    const nx = -dy / dist;
    const ny = dx / dist;
    
    // Create S-curve for this segment
    const bend = dist * 0.25;
    const cp1 = { x: p1.x + dx * 0.33 + nx * bend, y: p1.y + dy * 0.33 + ny * bend };
    const cp2 = { x: p1.x + dx * 0.67 - nx * bend, y: p1.y + dy * 0.67 - ny * bend };
    
    let endX = p2.x;
    let endY = p2.y;
    
    // Apply shortening only to the absolute final point
    if (i === points.length - 2 && shortenBy > 0) {
      const tx = p2.x - cp2.x, ty = p2.y - cp2.y;
      const tLen = Math.hypot(tx, ty) || 1;
      endX = p2.x - (tx / tLen) * shortenBy;
      endY = p2.y - (ty / tLen) * shortenBy;
    }
    
    path += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${endX} ${endY}`;
  }
  return path;
}

/**
 * Get the last two control points for arrow angle calculation on curved paths.
 * For 2-point S-curves, returns the second control point and end point.
 * For multi-point curves, returns the last segment's cp2 and end point.
 */
export function getCurveEndControlPoints(points: Point[]): { cp2: Point; end: Point } | null {
  if (points.length < 2) return null;
  
  if (points.length === 2) {
    const p1 = points[0];
    const p2 = points[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    
    const bend = dist * 0.25;
    const cp2 = { x: p1.x + dx * 0.67 - nx * bend, y: p1.y + dy * 0.67 - ny * bend };
    return { cp2, end: p2 };
  }
  
  // Multi-point: calculate the last segment's cp2 using the same S-curve formula
  const i = points.length - 2;
  const p1 = points[i];
  const p2 = points[i + 1];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  
  const bend = dist * 0.25;
  const cp2 = { x: p1.x + dx * 0.67 - nx * bend, y: p1.y + dy * 0.67 - ny * bend };
  
  return { cp2, end: p2 };
}

// curveControl is no longer used - replaced by getCurveEndControlPoints for proper arrow alignment
// Kept for backwards compatibility but not called anywhere
function curveControl(p1: Point, p2: Point) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = Math.min(Math.max(len * 0.70, 4), 12);
  return {
    x: (p1.x + p2.x) / 2 + nx * bend,
    y: (p1.y + p2.y) / 2 + ny * bend,
  };
}

export function pathFromPoints(points: Point[], smooth: boolean) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (!smooth) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }
  // Enhanced Catmull-Rom -> bezier smoothing with much tighter tension for ultra-smooth fluid strokes
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    // Very low tension factor (0.01) for maximum smoothing, eliminating jagged edges even when drawing slowly
    const tension = 0.01;
    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}
