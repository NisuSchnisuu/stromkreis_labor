import {
  type CircuitComponent,
  type ComponentSimState,
  MATERIAL_SPECS,
  type SimulationResult,
  type Wire,
  type WireSimState,
  getLocalTerminals,
} from './types';

const WIRE_RESISTANCE = 0.02; // Ohm per connected wire
const CLOSED_SWITCH_RESISTANCE = 0.02; // Ohm
const DEFAULT_BATTERY_VOLTAGE = 4.5; // Volts
const DEFAULT_BATTERY_INTERNAL_R = 0.5; // Ohm
const DEFAULT_BULB_RESISTANCE = 15.0; // Ohm (4.5V -> 0.3A, 1.35W)
const NOMINAL_BULB_POWER = (4.35 * 4.35) / DEFAULT_BULB_RESISTANCE; // ~1.26W = 1.0 brightness
const SHORT_CIRCUIT_CURRENT_THRESHOLD = 3.5; // Amps

interface Branch {
  id: string;
  kind: 'battery' | 'resistor' | 'wire';
  nodeA: string;
  nodeB: string;
  resistance: number;
  voltage?: number; // for battery: V_nodeA - V_nodeB open-circuit
}

function terminalKey(componentId: string, terminalId: string): string {
  return `${componentId}:${terminalId}`;
}

/**
 * Solve linear system A * x = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];

  // Deep copy augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxAbs) {
        maxAbs = val;
        pivotRow = row;
      }
    }

    if (maxAbs < 1e-12) {
      return null; // Singular
    }

    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const pivotVal = M[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivotVal;
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }

  return x;
}

/**
 * Pure DC circuit solver using Nodal Analysis with Norton-equivalent batteries.
 * Handles arbitrary topologies: series, parallel, mixed, bridges, multiple batteries,
 * disconnected subcircuits, and realistic short circuits.
 */
export function solveCircuit(
  components: CircuitComponent[],
  wires: Wire[]
): SimulationResult {
  const compStates: Record<string, ComponentSimState> = {};
  const wireStates: Record<string, WireSimState> = {};
  const nodeVoltages: Record<string, number> = {};

  // Initialize default states
  for (const c of components) {
    compStates[c.id] = {
      current: 0,
      voltageDrop: 0,
      power: 0,
      brightness: 0,
      isShorted: false,
    };
  }
  for (const w of wires) {
    wireStates[w.id] = {
      current: 0,
      isShorted: false,
    };
  }

  // Build active branches and adjacency list
  const branches: Branch[] = [];
  const adj = new Map<string, Set<string>>();

  const ensureNode = (k: string) => {
    if (!adj.has(k)) adj.set(k, new Set());
  };

  const addEdge = (a: string, b: string) => {
    ensureNode(a);
    ensureNode(b);
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };

  // Register all component terminals
  const validTerminals = new Set<string>();
  for (const c of components) {
    for (const t of getLocalTerminals(c.kind)) {
      const k = terminalKey(c.id, t.id);
      validTerminals.add(k);
      ensureNode(k);
    }
  }

  // Add component branches
  for (const c of components) {
    if (c.kind === 'battery') {
      const pos = terminalKey(c.id, 'pos');
      const neg = terminalKey(c.id, 'neg');
      const v = c.voltage ?? DEFAULT_BATTERY_VOLTAGE;
      const ri = Math.max(0.05, c.internalResistance ?? DEFAULT_BATTERY_INTERNAL_R);
      branches.push({
        id: c.id,
        kind: 'battery',
        nodeA: pos,
        nodeB: neg,
        resistance: ri,
        voltage: v,
      });
      addEdge(pos, neg);
    } else if (c.kind === 'bulb') {
      if (c.isScrewedIn !== false) {
        const a = terminalKey(c.id, 'a');
        const b = terminalKey(c.id, 'b');
        const r = c.resistance ?? DEFAULT_BULB_RESISTANCE;
        branches.push({ id: c.id, kind: 'resistor', nodeA: a, nodeB: b, resistance: r });
        addEdge(a, b);
      }
    } else if (c.kind === 'switch') {
      if (c.isClosed) {
        const a = terminalKey(c.id, 'a');
        const b = terminalKey(c.id, 'b');
        branches.push({
          id: c.id,
          kind: 'resistor',
          nodeA: a,
          nodeB: b,
          resistance: CLOSED_SWITCH_RESISTANCE,
        });
        addEdge(a, b);
      }
    } else if (c.kind === 'material') {
      const spec = c.materialType ? MATERIAL_SPECS[c.materialType] : null;
      if (spec && Number.isFinite(spec.resistance)) {
        const a = terminalKey(c.id, 'a');
        const b = terminalKey(c.id, 'b');
        branches.push({
          id: c.id,
          kind: 'resistor',
          nodeA: a,
          nodeB: b,
          resistance: spec.resistance,
        });
        addEdge(a, b);
      }
    }
  }

  // Add connected wire branches
  for (const w of wires) {
    if (w.endA.attachedTo && w.endB.attachedTo) {
      const kA = terminalKey(w.endA.attachedTo.componentId, w.endA.attachedTo.terminalId);
      const kB = terminalKey(w.endB.attachedTo.componentId, w.endB.attachedTo.terminalId);
      if (validTerminals.has(kA) && validTerminals.has(kB) && kA !== kB) {
        branches.push({
          id: w.id,
          kind: 'wire',
          nodeA: kA,
          nodeB: kB,
          resistance: WIRE_RESISTANCE,
        });
        addEdge(kA, kB);
      }
    }
  }

  // Find connected components via BFS
  const visited = new Set<string>();
  const connectedGroups: Set<string>[] = [];

  for (const node of adj.keys()) {
    if (visited.has(node)) continue;
    const group = new Set<string>();
    const queue = [node];
    visited.add(node);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      group.add(curr);
      for (const next of adj.get(curr) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    connectedGroups.push(group);
  }

  // Solve each connected component independently
  for (const group of connectedGroups) {
    const groupBranches = branches.filter(
      (b) => group.has(b.nodeA) && group.has(b.nodeB)
    );
    const groupBatteries = groupBranches.filter((b) => b.kind === 'battery');

    // No battery in this connected component => all voltages 0
    if (groupBatteries.length === 0) {
      for (const n of group) nodeVoltages[n] = 0;
      continue;
    }

    // Pick ground = negative terminal of the first battery in this group
    const groundNode = groupBatteries[0].nodeB;
    const unknownNodes = Array.from(group).filter((n) => n !== groundNode);
    const nodeIndex = new Map<string, number>();
    unknownNodes.forEach((n, idx) => nodeIndex.set(n, idx));

    const N = unknownNodes.length;
    const G: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
    const I: number[] = new Array<number>(N).fill(0);

    for (const br of groupBranches) {
      const g = 1 / br.resistance;
      const idxA = nodeIndex.get(br.nodeA);
      const idxB = nodeIndex.get(br.nodeB);

      if (idxA !== undefined) G[idxA][idxA] += g;
      if (idxB !== undefined) G[idxB][idxB] += g;
      if (idxA !== undefined && idxB !== undefined) {
        G[idxA][idxB] -= g;
        G[idxB][idxA] -= g;
      }

      if (br.kind === 'battery' && br.voltage) {
        // Norton current source Is = V / ri flowing from nodeB (neg) to nodeA (pos)
        const isrc = br.voltage * g;
        if (idxA !== undefined) I[idxA] += isrc;
        if (idxB !== undefined) I[idxB] -= isrc;
      }
    }

    const solution = solveLinearSystem(G, I);
    nodeVoltages[groundNode] = 0;
    if (solution) {
      unknownNodes.forEach((n, idx) => {
        nodeVoltages[n] = solution[idx];
      });
    } else {
      for (const n of unknownNodes) nodeVoltages[n] = 0;
    }
  }

  // Compute currents, powers, brightness, and short-circuit flags
  const shortedBatteryIds: string[] = [];

  for (const br of branches) {
    const vA = nodeVoltages[br.nodeA] ?? 0;
    const vB = nodeVoltages[br.nodeB] ?? 0;
    const vDiff = vA - vB;

    if (br.kind === 'battery') {
      const emf = br.voltage ?? DEFAULT_BATTERY_VOLTAGE;
      // Current leaving the '+' terminal into the external circuit
      const current = (emf - vDiff) / br.resistance;
      const isShorted = Math.abs(current) >= SHORT_CIRCUIT_CURRENT_THRESHOLD;
      if (isShorted) shortedBatteryIds.push(br.id);

      compStates[br.id] = {
        current,
        voltageDrop: vDiff,
        power: Math.abs(vDiff * current),
        brightness: 0,
        isShorted,
      };
    } else if (br.kind === 'resistor') {
      const current = vDiff / br.resistance;
      const power = Math.abs(vDiff * current);
      const comp = components.find((c) => c.id === br.id);
      let brightness = 0;
      if (comp?.kind === 'bulb') {
        // Nonlinear perceptual brightness curve so series (2 bulbs) is clearly dimmer than parallel
        const ratio = power / NOMINAL_BULB_POWER;
        brightness = ratio < 0.015 ? 0 : Math.min(1.6, Math.pow(ratio, 0.75));
      }
      compStates[br.id] = {
        current,
        voltageDrop: vDiff,
        power,
        brightness,
        isShorted: false,
      };
    } else if (br.kind === 'wire') {
      const current = vDiff / br.resistance;
      const isShorted = Math.abs(current) >= SHORT_CIRCUIT_CURRENT_THRESHOLD;
      wireStates[br.id] = {
        current,
        isShorted,
      };
    }
  }

  return {
    components: compStates,
    wires: wireStates,
    hasShortCircuit: shortedBatteryIds.length > 0,
    shortedBatteryIds,
    nodeVoltages,
  };
}
