import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "./utils/cn";
import Pitch from "./components/Pitch";
import { DrawingPath, EquipmentToken, PlayerToken } from "./components/Elements";
import {
  type Board,
  type DrawingEl,
  type DrawKind,
  type EquipmentEl,
  type EquipmentKind,
  type PitchMode,
  type PlayerEl,
  type Point,
  type Tool,
  emptyBoard,
} from "./types";

/* ------------------------------ constants ------------------------------ */
const SWATCHES = [
  "#ffffff",
  "#facc15",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#3b82f6",
  "#06b6d4",
  "#22c55e",
  "#111827",
];

const EQUIPMENT: { type: EquipmentKind; label: string; color: string }[] = [
  { type: "ball", label: "Ball", color: "#ffffff" },
  { type: "cone", label: "Cone", color: "#f97316" },
  { type: "disc", label: "Disc", color: "#facc15" },
  { type: "pole", label: "Pole", color: "#ef4444" },
  { type: "ladder", label: "Ladder", color: "#fbbf24" },
  { type: "minigoal", label: "Mini Goal", color: "#e5e7eb" },
  { type: "flag", label: "Flag", color: "#ef4444" },
  { type: "barrier", label: "Hurdle", color: "#facc15" },
];

const DRAW_TYPES: { type: DrawKind; label: string }[] = [
  { type: "pen", label: "Free" },
  { type: "line", label: "Line" },
  { type: "arrow", label: "Arrow line" },
  { type: "dashed", label: "Dashed" },
  { type: "dashedArrow", label: "Arrow dashed" },
  { type: "curve", label: "Curve" },
  { type: "curveDashed", label: "Curve dashed" },
  { type: "curveArrow", label: "Curve arrow" },
  { type: "curveDashedArrow", label: "Curve dashed arrow" },
  { type: "text", label: "Text" },
];

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Fixed, centred camera. Includes a small margin so goals fit.
function fitViewBox(): ViewBox {
  return { x: -3, y: -3, w: 74, h: 111 };
}

type ElPatch = Partial<PlayerEl> & Partial<EquipmentEl> & Partial<DrawingEl>;

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const GRID_STEP = 2.5;
const snapToGrid = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP;

// Helper to check if a draw type is curved (for multi-point drawing)
function isCurvedType(type: string): boolean {
  return type === "curve" || type === "curveDashed" || type === "curveArrow" || type === "curveDashedArrow";
}

/* ============================== App ============================== */
export default function App() {
  const [board, setBoard] = useState<Board>(emptyBoard());
  const [past, setPast] = useState<Board[]>([]);
  const [future, setFuture] = useState<Board[]>([]);

  const [tool, setTool] = useState<Tool>("select");
  const [drawKind, setDrawKind] = useState<DrawKind>("arrow");
  const [color, setColor] = useState<string>("#facc15");
  const [strokeWidth, setStrokeWidth] = useState<number>(0.8);

  const [playerColor, setPlayerColor] = useState<string>("#2563eb");

  const [pitchMode, setPitchMode] = useState<PitchMode>("standard");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [grid, setGrid] = useState<boolean>(false);
  const gridRef = useRef(false);
  const [panel, setPanel] = useState<null | "draw" | "players" | "equipment">(null);
  const [hidden, setHidden] = useState(false);
  const [idle, setIdle] = useState(false);

  const [draft, setDraft] = useState<DrawingEl | null>(null);

  // Camera is fixed (no pan/zoom).
  const camera = fitViewBox();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gestureStart = useRef<Board | null>(null);
  const dragRef = useRef<{ id: string; last: Point; startWorld: Point } | null>(null);
  const rotateRef = useRef<{ id: string; center: Point } | null>(null);
  const moved = useRef(false);
  const activePointer = useRef<number | null>(null);
  const interactionMode = useRef<"idle" | "draw" | "drag" | "rotate">("idle");

  /* --------------------- activity / auto-fade --------------------- */
  const activityTimer = useRef<number | null>(null);
  const bump = useCallback(() => {
    setIdle(false);
    if (activityTimer.current) window.clearTimeout(activityTimer.current);
    activityTimer.current = window.setTimeout(() => setIdle(true), 20000);
  }, []);
  useEffect(() => {
    bump();
    return () => {
      if (activityTimer.current) window.clearTimeout(activityTimer.current);
    };
  }, [bump]);

  const barsVisible = !hidden && !idle;

  // Keep gridRef in sync with grid state for use in gesture callbacks
  useEffect(() => { gridRef.current = grid; }, [grid]);

  /* --------------------- history helpers --------------------- */
  const commit = useCallback(
    (next: Board) => {
      setPast((p) => [...p.slice(-49), board]);
      setFuture([]);
      setBoard(next);
    },
    [board],
  );

  const undo = useCallback(() => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setFuture((f) => [board, ...f]);
    setPast(past.slice(0, -1));
    setBoard(prev);
    setSelectedId(null);
  }, [past, board]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[0];
    setPast((p) => [...p, board]);
    setFuture(future.slice(1));
    setBoard(next);
    setSelectedId(null);
  }, [future, board]);

  /* --------------------- coordinate mapping --------------------- */
  const toWorld = useCallback((clientX: number, clientY: number, vb: ViewBox): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    // Guard against zero-sized SVG which would divide by zero.
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    const scale = Math.min(rect.width / vb.w, rect.height / vb.h);
    if (!Number.isFinite(scale) || scale <= 0) return { x: 0, y: 0 };
    const offX = (rect.width - vb.w * scale) / 2;
    const offY = (rect.height - vb.h * scale) / 2;
    return {
      x: vb.x + (clientX - rect.left - offX) / scale,
      y: vb.y + (clientY - rect.top - offY) / scale,
    };
  }, []);



  /* --------------------- element helpers --------------------- */
  const findElement = (id: string) =>
    board.players.find((p) => p.id === id) ||
    board.equipment.find((e) => e.id === id) ||
    board.drawings.find((d) => d.id === id);

  const safe = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);

  const updateElement = (b: Board, id: string, updater: (el: PlayerEl | EquipmentEl | DrawingEl) => ElPatch): Board => ({
    players: b.players.map((p) => (p.id === id ? { ...p, ...updater(p) } : p)),
    equipment: b.equipment.map((e) => (e.id === id ? { ...e, ...updater(e) } : e)),
    drawings: b.drawings.map((d) => (d.id === id ? { ...d, ...updater(d) } : d)),
  });

  const translateBoardElement = (b: Board, id: string, dx: number, dy: number): Board => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return b;
    return updateElement(b, id, (el) => {
      if (el.kind === "drawing") {
        return {
          points: el.points.map((pt) => ({ x: safe(pt.x + dx, pt.x), y: safe(pt.y + dy, pt.y) })),
        };
      }
      return {
        x: clamp(safe(el.x + dx, el.x), -2, 70),
        y: clamp(safe(el.y + dy, el.y), -2, 107),
      };
    });
  };

  const elementCenter = (id: string): Point | null => {
    const p = board.players.find((player) => player.id === id);
    if (p) return { x: p.x, y: p.y };
    const e = board.equipment.find((eq) => eq.id === id);
    if (e) return { x: e.x, y: e.y };
    return null;
  };

  const rotateBoardElement = (b: Board, id: string, rotation: number): Board => {
    if (!Number.isFinite(rotation)) return b;
    return updateElement(b, id, () => ({ rotation }));
  };

  const angleFromCenter = (center: Point, p: Point) =>
    (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI + 90;

  const deleteElement = useCallback(
    (id: string) => {
      commit({
        players: board.players.filter((p) => p.id !== id),
        equipment: board.equipment.filter((e) => e.id !== id),
        drawings: board.drawings.filter((d) => d.id !== id),
      });
      if (selectedId === id) setSelectedId(null);
    },
    [board, commit, selectedId],
  );

  /* --------------------- pointer handlers (single-pointer, no pan/zoom) --------------------- */
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    bump();
    if (activePointer.current !== null) return; // ignore extra fingers
    activePointer.current = e.pointerId;
    moved.current = false;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);

    const p = toWorld(e.clientX, e.clientY, camera);
    const rotateTarget = (e.target as Element).closest?.("[data-rotate-id]");
    const rotateId = rotateTarget?.getAttribute("data-rotate-id") || null;
    const target = (e.target as Element).closest?.("[data-id]");
    const id = target?.getAttribute("data-id") || null;

    if (tool === "erase") {
      if (id || rotateId) deleteElement(id || rotateId!);
      interactionMode.current = "idle";
      activePointer.current = null;
      return;
    }

    if (tool === "draw") {
      // Text mode: tap an existing element to select it; tap empty space to place text.
      if (drawKind === "text") {
        if (id) {
          // tapped an existing element → just select it (don't spawn text on top)
          setSelectedId(id);
          setPanel(null);
          interactionMode.current = "idle";
          activePointer.current = null;
          return;
        }
        // tapped empty space → place text, then auto-switch back to select tool
        const textEl: DrawingEl = {
          id: uid(),
          kind: "drawing",
          type: "text",
          color,
          width: strokeWidth,
          points: [p],
          label: "Text",
        };
        commit({ ...board, drawings: [...board.drawings, textEl] });
        setSelectedId(textEl.id);
        setPanel(null);
        setTool("select"); // auto-switch so next tap selects/moves naturally
        interactionMode.current = "idle";
        activePointer.current = null;
        return;
      }
      gestureStart.current = board;
      interactionMode.current = "draw";
      setSelectedId(null);
      // Multi-point tools: pen and all curve variants start with single point
      const isMultiPoint = drawKind === "pen" || isCurvedType(drawKind);
      setDraft({
        id: uid(),
        kind: "drawing",
        type: drawKind,
        color,
        width: strokeWidth,
        points: isMultiPoint ? [p] : [p, p],
      });
      return;
    }

    // select tool — rotate handle
    if (rotateId) {
      const center = elementCenter(rotateId);
      if (!center) {
        activePointer.current = null;
        interactionMode.current = "idle";
        return;
      }
      interactionMode.current = "rotate";
      rotateRef.current = { id: rotateId, center };
      gestureStart.current = board;
      setSelectedId(rotateId);
      setPanel(null);
      return;
    }

    if (id) {
      interactionMode.current = "drag";
      dragRef.current = { id, last: p, startWorld: p };
      gestureStart.current = board;
      // Selection happens immediately so highlight shows
      setSelectedId(id);
      setPanel(null); // close any open palette so the editor isn't obscured
    } else {
      interactionMode.current = "idle";
      setSelectedId(null);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointer.current !== e.pointerId) return;
    const p = toWorld(e.clientX, e.clientY, camera);

    if (interactionMode.current === "draw" && draft) {
      moved.current = true;
      setDraft((d) => {
        if (!d) return d;
        // Multi-point tools: pen and all curve variants
        const isMultiPoint = d.type === "pen" || isCurvedType(d.type);
        if (isMultiPoint) {
          // Add point for continuous drawing
          return { ...d, points: [...d.points, p] };
        }
        // Two-point tools: line, arrow, dashed, dashedArrow
        return { ...d, points: [d.points[0], p] };
      });
      return;
    }

    if (interactionMode.current === "drag" && dragRef.current) {
      const drag = dragRef.current;
      const dx = p.x - drag.last.x;
      const dy = p.y - drag.last.y;
      // movement threshold so a tap isn't treated as drag
      if (!moved.current && Math.hypot(p.x - drag.startWorld.x, p.y - drag.startWorld.y) < 1.2)
        return;
      moved.current = true;
      drag.last = p;
      const dragId = drag.id;
      setBoard((b) => translateBoardElement(b, dragId, dx, dy));
      return;
    }

    if (interactionMode.current === "rotate" && rotateRef.current) {
      moved.current = true;
      const targetRotation = ((angleFromCenter(rotateRef.current.center, p) % 360) + 360) % 360;
      const rid = rotateRef.current.id;
      setBoard((b) => rotateBoardElement(b, rid, targetRotation));
      return;
    }
  };

  const endGesture = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointer.current !== e.pointerId) {
      // Release stale pointer (cancel/leave/up from a finger we ignored)
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      return;
    }
    activePointer.current = null;

    if (interactionMode.current === "draw" && draft) {
      const isMultiPoint = draft.type === "pen" || isCurvedType(draft.type);
      const valid = isMultiPoint
        ? draft.points.length > 1
        : draft.points.length >= 2 &&
          Math.hypot(
            draft.points[1].x - draft.points[0].x,
            draft.points[1].y - draft.points[0].y,
          ) > 1;
      if (valid && gestureStart.current) {
        const start = gestureStart.current;
        setPast((pp) => [...pp.slice(-49), start]);
        setFuture([]);
        setBoard((b) => ({ ...b, drawings: [...b.drawings, draft] }));
      }
      setDraft(null);
    }

    if (
      (interactionMode.current === "drag" || interactionMode.current === "rotate") &&
      moved.current &&
      gestureStart.current
    ) {
      const start = gestureStart.current;
      setPast((pp) => [...pp.slice(-49), start]);
      setFuture([]);

      // Snap to grid after drag ends
      if (gridRef.current && interactionMode.current === "drag" && dragRef.current) {
        const snapId = dragRef.current.id;
        setBoard((b) => snapBoardElement(b, snapId));
      }
    }

    gestureStart.current = null;
    dragRef.current = null;
    rotateRef.current = null;
    interactionMode.current = "idle";
  };

  /* --------------------- adding elements --------------------- */
  const addPlayer = () => {
    const count = board.players.length;
    const i = count;
    let x = 10 + (i % 6) * 8;
    let y = 50 + Math.floor(i / 6) * 8;
    if (grid) { x = snapToGrid(x); y = snapToGrid(y); }
    const player: PlayerEl = {
      id: uid(),
      kind: "player",
      team: "home",
      x: clamp(x, 0, 68),
      y: clamp(y, 0, 105),
      number: count + 1,
      label: "",
      color: playerColor,
      rotation: 0,
    };
    commit({ ...board, players: [...board.players, player] });
    setSelectedId(player.id);
  };

  const addEquipment = (type: EquipmentKind, col: string) => {
    let cx = camera.x + camera.w / 2;
    let cy = camera.y + camera.h / 2;
    if (grid) { cx = snapToGrid(cx); cy = snapToGrid(cy); }
    const eq: EquipmentEl = {
      id: uid(),
      kind: "equipment",
      type,
      x: clamp(cx, 0, 68),
      y: clamp(cy, 0, 105),
      rotation: 0,
      scale: 0.7,
      color: col,
    };
    commit({ ...board, equipment: [...board.equipment, eq] });
    setSelectedId(eq.id);
  };

  /* --------------------- selected updates --------------------- */
  const updateSelected = (patch: ElPatch) => {
    if (!selectedId) return;
    commit(updateElement(board, selectedId, () => patch));
  };

  const duplicateSelected = () => {
    const el = selectedId ? findElement(selectedId) : null;
    if (!el) return;
    if (el.kind === "player") {
      const n: PlayerEl = { ...el, id: uid(), x: el.x + 5, y: el.y + 5 };
      commit({ ...board, players: [...board.players, n] });
      setSelectedId(n.id);
    } else if (el.kind === "equipment") {
      const n: EquipmentEl = { ...el, id: uid(), x: el.x + 5, y: el.y + 5 };
      commit({ ...board, equipment: [...board.equipment, n] });
      setSelectedId(n.id);
    } else {
      const n: DrawingEl = { ...el, id: uid(), points: el.points.map((p) => ({ x: p.x + 5, y: p.y + 5 })) };
      commit({ ...board, drawings: [...board.drawings, n] });
      setSelectedId(n.id);
    }
  };

  const clearAll = () => {
    if (board.players.length + board.equipment.length + board.drawings.length === 0) return;
    commit(emptyBoard());
    setSelectedId(null);
  };

  /* --------------------- export PNG --------------------- */
  const exportPng = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const vb = fitViewBox();
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    clone.removeAttribute("style");
    clone.querySelectorAll('.selection-ring').forEach((n) => n.remove());
    const k = 16;
    const W = Math.round(vb.w * k);
    const H = Math.round(vb.h * k);
    clone.setAttribute("width", String(W));
    clone.setAttribute("height", String(H));
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `tactic-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = url;
  }, []);

  const shareBoard = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Tactic Board", text: "Open my tactic board" });
      } else {
        exportPng();
      }
    } catch {
      // ignore cancelled share dialogs
    }
  }, [exportPng]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // ignore fullscreen errors on unsupported browsers
    }
  }, []);

  /* --------------------- keyboard --------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        deleteElement(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedId, deleteElement]);

  const selected = selectedId ? findElement(selectedId) : null;

  const snapBoardElement = (b: Board, id: string): Board =>
    updateElement(b, id, (el) =>
      el.kind === "drawing" ? {} : { x: snapToGrid(el.x), y: snapToGrid(el.y) },
    );

  /* ============================== render ============================== */
  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden bg-slate-900 text-white select-none touch-none"
      style={{ touchAction: "none" }}
      onPointerDownCapture={bump}
    >
      {/* ---------------- Field ---------------- */}
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        <Pitch grass="#1d743d" stripe="#185f31" line="#d7e5d8" mode={pitchMode} />

        <g id="board-content">
          {board.drawings.map((d) => (
            <DrawingPath key={d.id} el={d} selected={d.id === selectedId} />
          ))}
          {draft && <DrawingPath el={draft} selected={false} />}
          {board.equipment.map((e) => (
            <EquipmentToken key={e.id} el={e} selected={e.id === selectedId} />
          ))}
          {board.players.map((p) => (
            <PlayerToken key={p.id} el={p} selected={p.id === selectedId} />
          ))}
        </g>
      </svg>

      {/* ---------------- Top chrome ---------------- */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-20 transition-all duration-300",
          barsVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
        )}
      >
        <div className="flex items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-0.5 rounded-[18px] border border-white/8 bg-[#1a243b]/95 p-1 shadow-xl shadow-black/20 backdrop-blur-xl">
            <TopBtn onClick={undo} disabled={!past.length} title="Undo" grouped>
              <IconUndo />
            </TopBtn>
            <TopBtn onClick={redo} disabled={!future.length} title="Redo" grouped>
              <IconRedo />
            </TopBtn>
          </div>

          <div className="flex items-center gap-1 rounded-[18px] border border-white/8 bg-[#1a243b]/95 p-1 shadow-xl shadow-black/20 backdrop-blur-xl">
            <select
              value={pitchMode}
              onChange={(e) => setPitchMode(e.target.value as PitchMode)}
              className="h-10 rounded-xl bg-transparent px-3 text-xs font-bold text-white outline-none"
              title="Pitch type"
            >
              <option value="standard">Lines</option>
              <option value="funino">FUNino</option>
              <option value="blank">Blank</option>
            </select>
            <TopBtn onClick={() => setGrid((g) => !g)} title="Snap grid" grouped>
              <IconGrid active={grid} />
            </TopBtn>
            <TopBtn onClick={exportPng} title="Export PNG" grouped>
              <IconDownload />
            </TopBtn>
            <TopBtn onClick={shareBoard} title="Share" grouped>
              <IconShare />
            </TopBtn>
            <TopBtn onClick={toggleFullscreen} title="Fullscreen" grouped>
              <IconExpand />
            </TopBtn>
            <TopBtn onClick={clearAll} title="Clear board" danger grouped>
              <IconTrash />
            </TopBtn>
          </div>
        </div>
      </div>

      {/* ---------------- Persistent hide toggle (mid-right like reference) ---------------- */}
      <button
        onClick={() => setHidden((h) => !h)}
        className="absolute right-3 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/8 bg-[#27324a]/88 text-white shadow-lg backdrop-blur-xl active:scale-95"
        title={hidden ? "Show controls" : "Hide controls"}
      >
        {hidden ? <IconEye /> : <IconEyeOff />}
      </button>

      {/* ---------------- Selected editor sheet ---------------- */}
      {selected && barsVisible && (
        <div
          className="absolute inset-x-0 z-30"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 102px)" }}
        >
          <div className="mx-3 max-h-[48dvh] overflow-y-auto rounded-[22px] border border-white/8 bg-[#1a243b]/96 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <SelectedEditor
              el={selected}
              onChange={updateSelected}
              onDelete={() => deleteElement(selected.id)}
              onDuplicate={duplicateSelected}
              onClose={() => setSelectedId(null)}
            />
          </div>
        </div>
      )}

      {/* ---------------- Expandable panel ---------------- */}
      {panel && barsVisible && (
        <div
          className="absolute inset-x-0 z-30"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 102px)" }}
        >
          <div className="mx-3 max-h-[48dvh] overflow-y-auto rounded-[22px] border border-white/8 bg-[#1a243b]/96 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
            {panel === "draw" && (
              <DrawPanel
                drawKind={drawKind}
                setDrawKind={setDrawKind}
                color={color}
                setColor={setColor}
                strokeWidth={strokeWidth}
                setStrokeWidth={setStrokeWidth}
              />
            )}
            {panel === "players" && (
              <PlayersPanel
                color={playerColor}
                setColor={setPlayerColor}
                addPlayer={addPlayer}
              />
            )}
            {panel === "equipment" && <EquipmentPanel add={addEquipment} />}
          </div>
        </div>
      )}

      {/* ---------------- Bottom chrome ---------------- */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 transition-all duration-300",
          barsVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
        )}
      >
        <div className="h-[88px] bg-[#111a31]/96 backdrop-blur-xl">
          <div className="mx-auto flex h-full max-w-[380px] items-start justify-center pt-2">
            <div className="flex w-full items-stretch gap-1 rounded-full border border-white/8 bg-[#141f36]/96 p-1.5 shadow-2xl shadow-black/25">
              <ToolBtn
                active={tool === "select" && !panel}
                onClick={() => {
                  setTool("select");
                  setPanel(null);
                }}
                icon={<IconCursor />}
                label="SELECT"
              />
              <ToolBtn
                active={tool === "draw"}
                onClick={() => {
                  setTool("draw");
                  setSelectedId(null);
                  setPanel(panel === "draw" ? null : "draw");
                }}
                icon={<IconPen />}
                label="DRAW"
              />
              <ToolBtn
                active={panel === "players"}
                onClick={() => {
                  setTool("select");
                  setSelectedId(null);
                  setPanel(panel === "players" ? null : "players");
                }}
                icon={<IconPlayers />}
                label="PLAYERS"
              />
              <ToolBtn
                active={panel === "equipment"}
                onClick={() => {
                  setTool("select");
                  setSelectedId(null);
                  setPanel(panel === "equipment" ? null : "equipment");
                }}
                icon={<IconCone />}
                label="GEAR"
              />
              <ToolBtn
                active={tool === "erase"}
                onClick={() => {
                  setTool("erase");
                  setSelectedId(null);
                  setPanel(null);
                }}
                icon={<IconEraser />}
                label="ERASER"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== sub components ============================== */

function TopBtn({
  children,
  onClick,
  disabled,
  title,
  danger,
  grouped,
}: {
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
  grouped?: boolean;
}) {
  return (
    <button
      onClick={() => void onClick()}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl transition active:scale-95",
        grouped
          ? "bg-transparent text-white/85 hover:bg-white/5"
          : "bg-slate-800/80 backdrop-blur ring-1 ring-white/10",
        disabled && "opacity-30",
        danger && "text-red-400",
      )}
    >
      {children}
    </button>
  );
}



function ToolBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-2 py-2.5 text-[10px] font-bold leading-none transition active:scale-95",
        active
          ? "bg-[#09d19a] text-white shadow-lg shadow-emerald-950/30"
          : "bg-transparent text-white/45 hover:text-white/70",
      )}
    >
      {icon}
      <span className="max-w-full truncate whitespace-nowrap tracking-[0.04em]">{label}</span>
    </button>
  );
}

function Swatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SWATCHES.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            "h-7 w-7 rounded-full ring-2 transition active:scale-90",
            value.toLowerCase() === c.toLowerCase() ? "ring-white" : "ring-transparent",
          )}
          style={{ backgroundColor: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)" }}
        />
      ))}
    </div>
  );
}

function DrawPanel({
  drawKind,
  setDrawKind,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
}: {
  drawKind: DrawKind;
  setDrawKind: (k: DrawKind) => void;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (n: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {DRAW_TYPES.map((d) => (
          <button
            key={d.type}
            onClick={() => setDrawKind(d.type)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              drawKind === d.type ? "bg-emerald-500 text-white" : "bg-slate-700/70 text-white/70",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      <Swatches value={color} onChange={setColor} />
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/60">Width</span>
        <input
          type="range"
          min={0.4}
          max={2}
          step={0.1}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="flex-1 accent-emerald-500"
        />
      </div>
    </div>
  );
}

function PlayersPanel({
  color,
  setColor,
  addPlayer,
}: {
  color: string;
  setColor: (c: string) => void;
  addPlayer: () => void;
}) {
  return (
    <div className="space-y-3">
      <button
        onClick={addPlayer}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white active:scale-95"
        style={{ backgroundColor: color }}
      >
        + Add Player
      </button>
      <Swatches value={color} onChange={setColor} />
    </div>
  );
}

function EquipmentPanel({ add }: { add: (t: EquipmentKind, c: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {EQUIPMENT.map((eq) => (
        <button
          key={eq.type}
          onClick={() => add(eq.type, eq.color)}
          className="flex flex-col items-center gap-1 rounded-xl bg-slate-700/70 py-2 text-[10px] font-semibold text-white/80 active:scale-95"
        >
          <span className="flex h-9 w-9 items-center justify-center">
            <EquipmentMini type={eq.type} color={eq.color} />
          </span>
          {eq.label}
        </button>
      ))}
    </div>
  );
}

function EquipmentMini({ type, color }: { type: EquipmentKind; color: string }) {
  return (
    <svg viewBox="-6 -6 12 12" className="h-7 w-7">
      <EquipmentToken
        el={{ id: "m", kind: "equipment", type, x: 0, y: 0, rotation: 0, scale: 1, color }}
        selected={false}
      />
    </svg>
  );
}

function SelectedEditor({
  el,
  onChange,
  onDelete,
  onDuplicate,
  onClose,
}: {
  el: PlayerEl | EquipmentEl | DrawingEl;
  onChange: (patch: ElPatch) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-white/60">
          {el.kind === "player" ? "Player" : el.kind === "equipment" ? "Equipment" : "Drawing"}
        </span>
        <div className="flex gap-2">
          <button onClick={onDuplicate} className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-semibold">
            Duplicate
          </button>
          <button onClick={onDelete} className="rounded-lg bg-red-500/90 px-3 py-1 text-xs font-semibold">
            Delete
          </button>
          <button onClick={onClose} className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-semibold">
            ✕
          </button>
        </div>
      </div>

      {el.kind === "player" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs text-white/60">Label</span>
            <input
              value={el.label}
              maxLength={10}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="name / role"
              className="flex-1 rounded-lg bg-slate-700 px-3 py-1.5 text-sm outline-none placeholder:text-white/30"
            />
          </div>
          <Swatches value={el.color} onChange={(c) => onChange({ color: c })} />
        </div>
      )}

      {el.kind === "equipment" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-white/60">Size</span>
            <input
              type="range"
              min={0.3}
              max={1.5}
              step={0.1}
              value={el.scale}
              onChange={(e) => onChange({ scale: Number(e.target.value) })}
              className="flex-1 accent-emerald-500"
            />
          </div>
          {el.type !== "ball" && <Swatches value={el.color} onChange={(c) => onChange({ color: c })} />}
        </div>
      )}

      {el.kind === "drawing" && (
        <div className="space-y-3">
          {el.type === "text" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="w-16 text-xs text-white/60">Text</span>
                <textarea
                  value={el.label || ""}
                  onChange={(e) => onChange({ label: e.target.value })}
                  placeholder="Type here..."
                  rows={4}
                  className="flex-1 rounded-lg bg-slate-700 px-3 py-1.5 text-sm outline-none placeholder:text-white/30 resize-none"
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-white/60">{el.type === "text" ? "Size" : "Width"}</span>
            <input
              type="range"
              min={0.4}
              max={2}
              step={0.1}
              value={el.width}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
              className="flex-1 accent-emerald-500"
            />
          </div>
          <Swatches value={el.color} onChange={(c) => onChange({ color: c })} />
        </div>
      )}
    </div>
  );
}

/* ============================== icons ============================== */
const ic = "h-5 w-5";
const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const IconUndo = () => (
  <svg className={ic} viewBox="0 0 24 24" {...s}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
  </svg>
);
const IconRedo = () => (
  <svg className={ic} viewBox="0 0 24 24" {...s}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9a5 5 0 0 0 0 10h1" />
  </svg>
);
const IconTrash = () => (
  <svg className={ic} viewBox="0 0 24 24" {...s}>
    <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
  </svg>
);
const IconDownload = () => (
  <svg className={ic} viewBox="0 0 24 24" {...s}>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
  </svg>
);
const IconShare = () => (
  <svg className={ic} viewBox="0 0 24 24" {...s}>
    <circle cx="18" cy="5" r="2" />
    <circle cx="6" cy="12" r="2" />
    <circle cx="18" cy="19" r="2" />
    <path d="M8 12 16 6M8 12l8 6" />
  </svg>
);
const IconExpand = () => (
  <svg className={ic} viewBox="0 0 24 24" {...s}>
    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 21h-5v-5" />
  </svg>
);

const IconEye = () => (
  <svg className={ic} viewBox="0 0 24 24" {...s}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg className={ic} viewBox="0 0 24 24" {...s}>
    <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.3 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 3-.5" />
  </svg>
);
const IconCursor = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" {...s}>
    <path d="m4 4 7 16 2.5-6.5L20 11 4 4Z" />
  </svg>
);
const IconPen = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" {...s}>
    <path d="M12 19l7-7-3-3-7 7v3h3ZM18 9l1.5-1.5a2.1 2.1 0 0 0-3-3L15 6" />
  </svg>
);
const IconPlayers = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" {...s}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 21a6 6 0 0 1 12 0M17 11a3 3 0 1 0-2-5.2M21 21a6 6 0 0 0-5-5.9" />
  </svg>
);
const IconCone = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" {...s}>
    <path d="M12 3 6 19h12L12 3Z" />
    <path d="M4 21h16M9 11h6" />
  </svg>
);
const IconEraser = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" {...s}>
    <path d="M4 14 14 4l6 6-7 7H7l-3-3Z" />
    <path d="M9 19h11" />
  </svg>
);
const IconGrid = ({ active }: { active: boolean }) => (
  <svg className={ic} viewBox="0 0 24 24" {...s} stroke={active ? "#22c55e" : "currentColor"}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);


