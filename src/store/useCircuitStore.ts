import { create } from 'zustand';
import { solveCircuit } from '../simulation/mnaSolver';
import {
  type CircuitComponent,
  type ComponentKind,
  type MaterialType,
  type SimulationResult,
  type TerminalRef,
  type Wire,
  getLocalTerminals,
  getTerminalWorldPosition,
} from '../simulation/types';
import { CIRCUIT_PRESETS } from './presets';

export type DragState =
  | { type: 'none' }
  | {
      type: 'component';
      componentId: string;
      offsetX: number;
      offsetZ: number;
      spliceWireId: string | null;
      hasMoved: boolean;
    }
  | {
      type: 'rotate';
      componentId: string;
    }
  | {
      type: 'wireEnd';
      wireId: string;
      end: 'endA' | 'endB';
      hoveredTerminal: TerminalRef | null;
    };

export interface PendingSpawn {
  kind: ComponentKind;
  materialType?: MaterialType;
  label: string;
  clientX: number;
  clientY: number;
}

export const WIRE_COLORS = [
  { name: 'Rot', hex: '#ef4444' },
  { name: 'Blau', hex: '#2563eb' },
  { name: 'Schwarz', hex: '#1e293b' },
  { name: 'Gelb', hex: '#eab308' },
  { name: 'Grün', hex: '#16a34a' },
];

let idCounter = 100;
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

export function getAttachedWireEnds(
  wires: Wire[],
  terminal: TerminalRef
): Array<{ wire: Wire; end: 'endA' | 'endB' }> {
  const result: Array<{ wire: Wire; end: 'endA' | 'endB' }> = [];
  for (const w of wires) {
    if (
      w.endA.attachedTo?.componentId === terminal.componentId &&
      w.endA.attachedTo?.terminalId === terminal.terminalId
    ) {
      result.push({ wire: w, end: 'endA' });
    } else if (
      w.endB.attachedTo?.componentId === terminal.componentId &&
      w.endB.attachedTo?.terminalId === terminal.terminalId
    ) {
      result.push({ wire: w, end: 'endB' });
    }
  }
  return result;
}

interface CircuitStore {
  components: CircuitComponent[];
  wires: Wire[];
  simulation: SimulationResult;

  // Selection & interaction
  selectedComponentId: string | null;
  selectedWireId: string | null;
  focusedTerminal: TerminalRef | null; // Terminal being inspected/cycled when multiple wires share it
  hoveredTerminal: TerminalRef | null; // Terminal whose hover ring is currently visible
  connectingFrom: TerminalRef | null;
  wireMode: boolean;
  activeWireColor: string;
  dragState: DragState;
  pendingSpawn: PendingSpawn | null;

  // Didactic toggles
  showCurrentFlow: boolean;
  showSchematic: boolean;
  showMeasurements: boolean;
  cameraPresetRequest: { id: number; mode: 'default' | 'top' } | null;

  // Component actions
  spawnComponentAt: (
    kind: ComponentKind,
    x: number,
    z: number,
    materialType?: MaterialType
  ) => string;
  moveComponent: (id: string, x: number, z: number, spliceWireId: string | null) => void;
  rotateComponent: (id: string, deltaRad: number) => void;
  setComponentRotation: (id: string, rotationY: number) => void;
  deleteComponent: (id: string) => void;
  toggleSwitch: (id: string) => void;
  toggleBulbScrewed: (id: string) => void;
  spliceComponentIntoWire: (componentId: string, wireId: string) => void;

  // Sidebar drag-to-spawn actions
  setPendingSpawn: (spawn: PendingSpawn | null) => void;

  // Wire actions
  toggleWireMode: () => void;
  setWireMode: (enabled: boolean) => void;
  startWireFromTerminal: (terminal: TerminalRef, startWorldPos: [number, number, number]) => string;
  detachWireAtTerminal: (
    terminal: TerminalRef,
    startWorldPos: [number, number, number]
  ) => boolean;
  selectOrCycleWireAtTerminal: (terminal: TerminalRef, step?: number) => void;
  setFocusedTerminal: (terminal: TerminalRef | null) => void;
  setHoveredTerminal: (terminal: TerminalRef | null) => void;
  updateWireEndFreePosition: (
    wireId: string,
    end: 'endA' | 'endB',
    pos: [number, number, number],
    hoveredTerminal: TerminalRef | null
  ) => void;
  finishWireEndDrag: (
    wireId: string,
    end: 'endA' | 'endB',
    finalPos: [number, number, number],
    snapTerminal: TerminalRef | null
  ) => void;
  handleTerminalTap: (terminal: TerminalRef) => void;
  deleteWire: (id: string) => void;
  setWireColor: (id: string, color: string) => void;
  setActiveWireColor: (color: string) => void;

  // Selection & Drag
  selectComponent: (id: string | null) => void;
  selectWire: (id: string | null) => void;
  clearSelection: () => void;
  setDragState: (drag: DragState) => void;

  // Didactic & Camera
  toggleCurrentFlow: () => void;
  toggleSchematic: () => void;
  toggleMeasurements: () => void;
  requestCameraPreset: (mode: 'default' | 'top') => void;
  loadPreset: (presetId: string) => void;
}

const initialPreset = CIRCUIT_PRESETS[0];
const initialSim = solveCircuit(initialPreset.components, initialPreset.wires);

function clampTable(val: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, val));
}

export const useCircuitStore = create<CircuitStore>((set, get) => ({
  components: structuredClone(initialPreset.components),
  wires: structuredClone(initialPreset.wires),
  simulation: initialSim,

  selectedComponentId: null,
  selectedWireId: null,
  focusedTerminal: null,
  hoveredTerminal: null,
  connectingFrom: null,
  wireMode: false,
  activeWireColor: '#ef4444',
  dragState: { type: 'none' },
  pendingSpawn: null,

  showCurrentFlow: false,
  showSchematic: false,
  showMeasurements: false,
  cameraPresetRequest: null,

  spawnComponentAt: (kind, x, z, materialType) => {
    const { components, wires } = get();
    const cx = clampTable(x, 5.2);
    const cz = clampTable(z, 3.3);
    const newComp: CircuitComponent = {
      id: nextId(kind),
      kind,
      position: [cx, 0, cz],
      rotationY: 0,
      ...(kind === 'battery' ? { voltage: 4.5, internalResistance: 0.5 } : {}),
      ...(kind === 'bulb' ? { resistance: 15, isScrewedIn: true } : {}),
      ...(kind === 'switch' ? { isClosed: false } : {}),
      ...(kind === 'material' ? { materialType: materialType ?? 'paperclip' } : {}),
    };
    const nextComps = [...components, newComp];
    set({
      components: nextComps,
      simulation: solveCircuit(nextComps, wires),
      selectedComponentId: newComp.id,
      selectedWireId: null,
      focusedTerminal: null,
      connectingFrom: null,
      wireMode: false,
      pendingSpawn: null,
      dragState: {
        type: 'component',
        componentId: newComp.id,
        offsetX: 0,
        offsetZ: 0,
        spliceWireId: null,
        hasMoved: true,
      },
    });
    return newComp.id;
  },

  setPendingSpawn: (pendingSpawn) => set({ pendingSpawn }),

  moveComponent: (id, x, z, spliceWireId) => {
    const cx = clampTable(x, 5.2);
    const cz = clampTable(z, 3.3);
    const nextComps = get().components.map((c) =>
      c.id === id ? { ...c, position: [cx, 0, cz] as [number, number, number] } : c
    );
    const { dragState } = get();
    set({
      components: nextComps,
      dragState:
        dragState.type === 'component'
          ? { ...dragState, spliceWireId, hasMoved: true }
          : dragState,
    });
  },

  rotateComponent: (id, deltaRad) => {
    const nextComps = get().components.map((c) =>
      c.id === id ? { ...c, rotationY: c.rotationY + deltaRad } : c
    );
    set({ components: nextComps });
  },

  setComponentRotation: (id, rotationY) => {
    const nextComps = get().components.map((c) =>
      c.id === id ? { ...c, rotationY } : c
    );
    set({ components: nextComps });
  },

  deleteComponent: (id) => {
    const { components, wires, selectedComponentId } = get();
    const nextComps = components.filter((c) => c.id !== id);
    const nextWires = wires.filter(
      (w) =>
        w.endA.attachedTo?.componentId !== id && w.endB.attachedTo?.componentId !== id
    );

    set({
      components: nextComps,
      wires: nextWires,
      simulation: solveCircuit(nextComps, nextWires),
      selectedComponentId: selectedComponentId === id ? null : selectedComponentId,
      focusedTerminal: null,
      connectingFrom: null,
    });
  },

  toggleSwitch: (id) => {
    const { components, wires } = get();
    const nextComps = components.map((c) =>
      c.id === id && c.kind === 'switch' ? { ...c, isClosed: !c.isClosed } : c
    );
    set({
      components: nextComps,
      simulation: solveCircuit(nextComps, wires),
    });
  },

  toggleBulbScrewed: (id) => {
    const { components, wires } = get();
    const nextComps = components.map((c) =>
      c.id === id && c.kind === 'bulb' ? { ...c, isScrewedIn: c.isScrewedIn === false } : c
    );
    set({
      components: nextComps,
      simulation: solveCircuit(nextComps, wires),
    });
  },

  spliceComponentIntoWire: (componentId, wireId) => {
    const { components, wires } = get();
    const comp = components.find((c) => c.id === componentId);
    const wire = wires.find((w) => w.id === wireId);
    if (!comp || !wire || !wire.endA.attachedTo || !wire.endB.attachedTo) return;

    const terminals = getLocalTerminals(comp.kind);
    if (terminals.length < 2) return;

    const compA = components.find((c) => c.id === wire.endA.attachedTo!.componentId);
    const compB = components.find((c) => c.id === wire.endB.attachedTo!.componentId);
    if (!compA || !compB) return;

    const posEndA = getTerminalWorldPosition(compA, wire.endA.attachedTo.terminalId);
    const posT0 = getTerminalWorldPosition(comp, terminals[0].id);
    const posT1 = getTerminalWorldPosition(comp, terminals[1].id);

    const dist0 = Math.hypot(posT0[0] - posEndA[0], posT0[2] - posEndA[2]);
    const dist1 = Math.hypot(posT1[0] - posEndA[0], posT1[2] - posEndA[2]);
    const nearTerm = dist0 <= dist1 ? terminals[0].id : terminals[1].id;
    const farTerm = dist0 <= dist1 ? terminals[1].id : terminals[0].id;

    const wire1: Wire = {
      id: nextId('wire'),
      color: wire.color,
      endA: wire.endA,
      endB: {
        attachedTo: { componentId: comp.id, terminalId: nearTerm },
        freePosition: [0, 0.08, 0],
      },
    };
    const wire2: Wire = {
      id: nextId('wire'),
      color: wire.color,
      endA: {
        attachedTo: { componentId: comp.id, terminalId: farTerm },
        freePosition: [0, 0.08, 0],
      },
      endB: wire.endB,
    };

    const nextWires = [...wires.filter((w) => w.id !== wireId), wire1, wire2];
    set({
      wires: nextWires,
      simulation: solveCircuit(components, nextWires),
      dragState: { type: 'none' },
      selectedComponentId: comp.id,
    });
  },

  toggleWireMode: () =>
    set((s) => ({
      wireMode: !s.wireMode,
      selectedComponentId: null,
      selectedWireId: null,
      focusedTerminal: null,
      connectingFrom: null,
    })),

  setWireMode: (enabled) =>
    set({
      wireMode: enabled,
      connectingFrom: null,
      ...(enabled
        ? { selectedComponentId: null, selectedWireId: null, focusedTerminal: null }
        : {}),
    }),

  startWireFromTerminal: (terminal, startWorldPos) => {
    const { components, wires, activeWireColor } = get();
    const newWire: Wire = {
      id: nextId('wire'),
      color: activeWireColor,
      endA: { attachedTo: terminal, freePosition: startWorldPos },
      endB: { attachedTo: null, freePosition: startWorldPos },
    };
    const nextWires = [...wires, newWire];
    set({
      wires: nextWires,
      simulation: solveCircuit(components, nextWires),
      selectedWireId: newWire.id,
      selectedComponentId: null,
      focusedTerminal: null,
      connectingFrom: null,
      dragState: {
        type: 'wireEnd',
        wireId: newWire.id,
        end: 'endB',
        hoveredTerminal: null,
      },
    });
    return newWire.id;
  },

  detachWireAtTerminal: (terminal, startWorldPos) => {
    const { components, wires, selectedWireId } = get();
    const attached = getAttachedWireEnds(wires, terminal);
    if (attached.length === 0) return false;

    // Detach the currently highlighted wire at this terminal, or the first one
    const chosen =
      attached.find((a) => a.wire.id === selectedWireId) ?? attached[0];

    const nextWires = wires.map((w) =>
      w.id === chosen.wire.id
        ? {
            ...w,
            [chosen.end]: {
              attachedTo: null,
              freePosition: startWorldPos,
            },
          }
        : w
    );

    set({
      wires: nextWires,
      simulation: solveCircuit(components, nextWires),
      selectedWireId: chosen.wire.id,
      selectedComponentId: null,
      focusedTerminal: null,
      dragState: {
        type: 'wireEnd',
        wireId: chosen.wire.id,
        end: chosen.end,
        hoveredTerminal: null,
      },
    });
    return true;
  },

  selectOrCycleWireAtTerminal: (terminal, step = 0) => {
    const { wires, selectedWireId } = get();
    const attached = getAttachedWireEnds(wires, terminal);
    if (attached.length === 0) return;

    const currIdx = attached.findIndex((a) => a.wire.id === selectedWireId);
    let nextIdx = 0;
    if (currIdx === -1) {
      nextIdx = 0;
    } else if (step !== 0) {
      nextIdx = (currIdx + step + attached.length) % attached.length;
    } else {
      nextIdx = currIdx;
    }

    set({
      selectedWireId: attached[nextIdx].wire.id,
      selectedComponentId: null,
      focusedTerminal: terminal,
      connectingFrom: null,
    });
  },

  setFocusedTerminal: (focusedTerminal) => set({ focusedTerminal }),
  setHoveredTerminal: (hoveredTerminal) => set({ hoveredTerminal }),

  updateWireEndFreePosition: (wireId, end, pos, hoveredTerminal) => {
    const cx = clampTable(pos[0], 5.5);
    const cz = clampTable(pos[2], 3.6);
    const nextWires = get().wires.map((w) =>
      w.id === wireId
        ? {
            ...w,
            [end]: {
              attachedTo: null,
              freePosition: [cx, pos[1], cz] as [number, number, number],
            },
          }
        : w
    );
    const { dragState } = get();
    set({
      wires: nextWires,
      dragState:
        dragState.type === 'wireEnd'
          ? { ...dragState, hoveredTerminal }
          : dragState,
    });
  },

  finishWireEndDrag: (wireId, end, _finalPos, snapTerminal) => {
    const { components, wires } = get();

    let nextWires: Wire[];

    if (!snapTerminal) {
      // Dropped in empty space => cleanly remove/detach the wire!
      nextWires = wires.filter((w) => w.id !== wireId);
    } else {
      nextWires = wires
        .map((w) => {
          if (w.id !== wireId) return w;
          const otherEnd = end === 'endA' ? w.endB : w.endA;
          const isSameAsOther =
            otherEnd.attachedTo &&
            otherEnd.attachedTo.componentId === snapTerminal.componentId &&
            otherEnd.attachedTo.terminalId === snapTerminal.terminalId;

          if (isSameAsOther) return null;

          return {
            ...w,
            [end]: {
              attachedTo: snapTerminal,
              freePosition: [0, 0.08, 0] as [number, number, number],
            },
          };
        })
        .filter((w): w is Wire => w !== null);
    }

    set({
      wires: nextWires,
      simulation: solveCircuit(components, nextWires),
      dragState: { type: 'none' },
      selectedWireId: snapTerminal ? wireId : null,
      focusedTerminal: null,
    });
  },

  handleTerminalTap: (terminal) => {
    const { connectingFrom, components, wires, activeWireColor, wireMode } = get();

    // If not in wireMode and not mid-connection, tapping a terminal with wires selects/highlights its wire!
    if (!wireMode && !connectingFrom) {
      const attached = getAttachedWireEnds(wires, terminal);
      if (attached.length > 0) {
        get().selectOrCycleWireAtTerminal(terminal, 0);
        return;
      }
    }

    if (!connectingFrom) {
      set({
        connectingFrom: terminal,
        selectedComponentId: null,
        selectedWireId: null,
        focusedTerminal: null,
      });
      return;
    }

    if (
      connectingFrom.componentId === terminal.componentId &&
      connectingFrom.terminalId === terminal.terminalId
    ) {
      set({ connectingFrom: null });
      return;
    }

    const newWire: Wire = {
      id: nextId('wire'),
      color: activeWireColor,
      endA: { attachedTo: connectingFrom, freePosition: [0, 0.08, 0] },
      endB: { attachedTo: terminal, freePosition: [0, 0.08, 0] },
    };
    const nextWires = [...wires, newWire];
    set({
      wires: nextWires,
      simulation: solveCircuit(components, nextWires),
      connectingFrom: null,
      selectedWireId: newWire.id,
      focusedTerminal: null,
    });
  },

  deleteWire: (id) => {
    const { components, wires, selectedWireId } = get();
    const nextWires = wires.filter((w) => w.id !== id);
    set({
      wires: nextWires,
      simulation: solveCircuit(components, nextWires),
      selectedWireId: selectedWireId === id ? null : selectedWireId,
      focusedTerminal: null,
    });
  },

  setWireColor: (id, color) => {
    const nextWires = get().wires.map((w) => (w.id === id ? { ...w, color } : w));
    set({ wires: nextWires });
  },

  setActiveWireColor: (color) => set({ activeWireColor: color }),

  selectComponent: (id) =>
    set({
      selectedComponentId: id,
      selectedWireId: null,
      focusedTerminal: null,
      connectingFrom: null,
    }),

  selectWire: (id) =>
    set({
      selectedWireId: id,
      selectedComponentId: null,
      connectingFrom: null,
    }),

  clearSelection: () =>
    set({
      selectedComponentId: null,
      selectedWireId: null,
      focusedTerminal: null,
      connectingFrom: null,
    }),

  setDragState: (dragState) => set({ dragState }),

  toggleCurrentFlow: () => set((s) => ({ showCurrentFlow: !s.showCurrentFlow })),
  toggleSchematic: () => set((s) => ({ showSchematic: !s.showSchematic })),
  toggleMeasurements: () => set((s) => ({ showMeasurements: !s.showMeasurements })),

  requestCameraPreset: (mode) =>
    set({ cameraPresetRequest: { id: Date.now(), mode } }),

  loadPreset: (presetId) => {
    const preset = CIRCUIT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const comps = structuredClone(preset.components);
    const wires = structuredClone(preset.wires);
    set({
      components: comps,
      wires,
      simulation: solveCircuit(comps, wires),
      selectedComponentId: null,
      selectedWireId: null,
      focusedTerminal: null,
      connectingFrom: null,
      wireMode: false,
      dragState: { type: 'none' },
      pendingSpawn: null,
    });
  },
}));
