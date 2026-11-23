export type ComponentKind = 'battery' | 'bulb' | 'switch' | 'material';

export type MaterialType =
  | 'paperclip'
  | 'alufolie'
  | 'nail'
  | 'copper'
  | 'eraser'
  | 'glass'
  | 'sugar'
  | 'paper'
  | 'saltwater'
  | 'distilled_water';

export interface MaterialSpec {
  id: MaterialType;
  label: string;
  resistance: number; // Ohm (Infinity = Nichtleiter)
  isConductor: boolean;
  color: string;
  description: string;
}

export const MATERIAL_SPECS: Record<MaterialType, MaterialSpec> = {
  paperclip: {
    id: 'paperclip',
    label: 'Büroklammer',
    resistance: 0.05,
    isConductor: true,
    color: '#cbd5e1',
    description: 'Metall (Stahl) – leitet den Strom gut.',
  },
  alufolie: {
    id: 'alufolie',
    label: 'Alufolie',
    resistance: 0.04,
    isConductor: true,
    color: '#e2e8f0',
    description: 'Aluminium – leitet den Strom sehr gut.',
  },
  nail: {
    id: 'nail',
    label: 'Stahlnagel',
    resistance: 0.06,
    isConductor: true,
    color: '#94a3b8',
    description: 'Eisen/Stahl – leitet den Strom gut.',
  },
  copper: {
    id: 'copper',
    label: 'Kupferblech',
    resistance: 0.02,
    isConductor: true,
    color: '#d97706',
    description: 'Kupfer – hervorragender elektrischer Leiter.',
  },
  eraser: {
    id: 'eraser',
    label: 'Radiergummi',
    resistance: Infinity,
    isConductor: false,
    color: '#f472b6',
    description: 'Gummi – Nichtleiter (Isolator).',
  },
  glass: {
    id: 'glass',
    label: 'Glas',
    resistance: Infinity,
    isConductor: false,
    color: '#bae6fd',
    description: 'Glas – Nichtleiter (Isolator).',
  },
  sugar: {
    id: 'sugar',
    label: 'Zuckerstück',
    resistance: Infinity,
    isConductor: false,
    color: '#f8fafc',
    description: 'Zucker – Nichtleiter (Isolator).',
  },
  paper: {
    id: 'paper',
    label: 'Papier',
    resistance: Infinity,
    isConductor: false,
    color: '#fef3c7',
    description: 'Papier – Nichtleiter (Isolator).',
  },
  distilled_water: {
    id: 'distilled_water',
    label: 'Dest. Wasser',
    resistance: Infinity,
    isConductor: false,
    color: '#e0f2fe',
    description: 'Destilliertes Wasser – ohne Salze praktisch kein Leiter.',
  },
  saltwater: {
    id: 'saltwater',
    label: 'Salzwasser',
    resistance: 25,
    isConductor: true,
    color: '#7dd3fc',
    description: 'Salzwasser – leitet den Strom (mit höherem Widerstand).',
  },
};

export interface TerminalLocalDef {
  id: string;
  label: string;
  localPosition: [number, number, number];
}

export interface CircuitComponent {
  id: string;
  kind: ComponentKind;
  position: [number, number, number]; // [x, 0, z] on the table
  rotationY: number; // radians
  // Battery props
  voltage?: number; // default 4.5V
  internalResistance?: number; // default 0.5 Ohm
  // Bulb props
  resistance?: number; // default 15 Ohm
  isScrewedIn?: boolean; // default true (false = herausgeschraubt / defekt)
  // Switch props
  isClosed?: boolean; // default false
  // Material props
  materialType?: MaterialType;
}

export interface TerminalRef {
  componentId: string;
  terminalId: string;
}

export interface WireEnd {
  attachedTo: TerminalRef | null;
  freePosition: [number, number, number]; // used when attachedTo is null
}

export interface Wire {
  id: string;
  color: string;
  endA: WireEnd;
  endB: WireEnd;
}

export interface ComponentSimState {
  current: number; // Amperes (signed: pos->neg or a->b)
  voltageDrop: number; // Volts (V_a - V_b)
  power: number; // Watts
  brightness: number; // 0..1.5 for bulbs (1.0 = normal 4.5V brightness)
  isShorted: boolean; // true if battery is in short circuit
}

export interface WireSimState {
  current: number; // Amperes (signed: endA -> endB)
  isShorted: boolean;
}

export interface SimulationResult {
  components: Record<string, ComponentSimState>;
  wires: Record<string, WireSimState>;
  hasShortCircuit: boolean;
  shortedBatteryIds: string[];
  nodeVoltages: Record<string, number>; // key = `${componentId}:${terminalId}`
}

export function getLocalTerminals(kind: ComponentKind): TerminalLocalDef[] {
  switch (kind) {
    case 'battery':
      // 4.5V flat battery: short '+' strip on left-front, long '-' strip on right-front
      return [
        { id: 'pos', label: '+', localPosition: [-0.28, 0.42, -0.58] },
        { id: 'neg', label: '−', localPosition: [0.28, 0.46, -0.58] },
      ];
    case 'bulb':
      return [
        { id: 'a', label: 'A', localPosition: [-0.46, 0.14, 0] },
        { id: 'b', label: 'B', localPosition: [0.46, 0.14, 0] },
      ];
    case 'switch':
      return [
        { id: 'a', label: 'A', localPosition: [-0.55, 0.16, 0] },
        { id: 'b', label: 'B', localPosition: [0.55, 0.16, 0] },
      ];
    case 'material':
      return [
        { id: 'a', label: 'A', localPosition: [-0.48, 0.12, 0] },
        { id: 'b', label: 'B', localPosition: [0.48, 0.12, 0] },
      ];
  }
}

export function getTerminalWorldPosition(
  comp: CircuitComponent,
  terminalId: string
): [number, number, number] {
  const defs = getLocalTerminals(comp.kind);
  const def = defs.find((d) => d.id === terminalId) ?? defs[0];
  const [lx, ly, lz] = def.localPosition;
  const cos = Math.cos(comp.rotationY);
  const sin = Math.sin(comp.rotationY);
  const wx = comp.position[0] + lx * cos + lz * sin;
  const wy = comp.position[1] + ly;
  const wz = comp.position[2] - lx * sin + lz * cos;
  return [wx, wy, wz];
}

