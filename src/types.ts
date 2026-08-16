// Coordinate system: pitch units. Full pitch is 68 wide (x) x 105 tall (y).
// Vertical orientation (portrait friendly).

export type Team = "home" | "away";

export type Tool = "select" | "draw" | "erase";

export type DrawKind =
  | "pen"
  | "line"
  | "arrow"
  | "dashed"
  | "dashedArrow"
  | "curve"
  | "curveDashed"
  | "curveArrow"
  | "curveDashedArrow"
  | "text";

export type EquipmentKind =
  | "ball"
  | "cone"
  | "disc"
  | "pole"
  | "ladder"
  | "minigoal"
  | "flag"
  | "barrier";

export interface Point {
  x: number;
  y: number;
}

export interface PlayerEl {
  id: string;
  kind: "player";
  team: Team;
  x: number;
  y: number;
  number: number;
  label: string;
  color: string;
  rotation: number; // degrees, direction the player faces
}

export interface EquipmentEl {
  id: string;
  kind: "equipment";
  type: EquipmentKind;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
}

export interface DrawingEl {
  id: string;
  kind: "drawing";
  type: DrawKind;
  color: string;
  width: number;
  points: Point[];
  label?: string; // Used for text tool
}

export type BoardElement = PlayerEl | EquipmentEl | DrawingEl;

export interface Board {
  players: PlayerEl[];
  equipment: EquipmentEl[];
  drawings: DrawingEl[];
}

export type PitchMode = "standard" | "funino" | "blank";

export const emptyBoard = (): Board => ({
  players: [],
  equipment: [],
  drawings: [],
});

// Pitch dimensions (units)
export const PITCH_W = 68;
export const PITCH_H = 105;
