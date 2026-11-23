import type { CircuitComponent, SimulationResult, Wire } from './types';

export interface SchematicNodePlacement {
  component: CircuitComponent;
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
}

export interface SchematicWireSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isShorted?: boolean;
}

export interface SchematicJunction {
  x: number;
  y: number;
}

export interface SchematicLayout {
  width: number;
  height: number;
  placements: SchematicNodePlacement[];
  segments: SchematicWireSegment[];
  junctions: SchematicJunction[];
  floatingComponents: CircuitComponent[];
}

/**
 * Union-Find to contract wire-connected terminals into electrical nets.
 */
class UnionFind {
  parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function tKey(compId: string, termId: string): string {
  return `${compId}:${termId}`;
}

function getCompTerminalIds(comp: CircuitComponent): [string, string] {
  return comp.kind === 'battery' ? ['pos', 'neg'] : ['a', 'b'];
}

/**
 * Builds a clean, textbook-style orthogonal schematic diagram (like NaTech 5|6 KMs),
 * independent of how messy the components are arranged on the 3D table.
 */
export function buildTextbookSchematic(
  components: CircuitComponent[],
  wires: Wire[],
  simulation: SimulationResult
): SchematicLayout {
  const width = 360;
  const height = 240;

  if (components.length === 0) {
    return { width, height, placements: [], segments: [], junctions: [], floatingComponents: [] };
  }

  // 1. Contract all connected wires into electrical nets
  const uf = new UnionFind();
  for (const c of components) {
    const [t1, t2] = getCompTerminalIds(c);
    uf.find(tKey(c.id, t1));
    uf.find(tKey(c.id, t2));
  }

  const connectedWires = wires.filter((w) => w.endA.attachedTo && w.endB.attachedTo);
  for (const w of connectedWires) {
    uf.union(
      tKey(w.endA.attachedTo!.componentId, w.endA.attachedTo!.terminalId),
      tKey(w.endB.attachedTo!.componentId, w.endB.attachedTo!.terminalId)
    );
  }

  // Pick main battery (or first component if no battery)
  const mainBattery = components.find((c) => c.kind === 'battery') ?? components[0];
  const [batT1, batT2] = getCompTerminalIds(mainBattery);
  const posNet = uf.find(tKey(mainBattery.id, batT1));
  const negNet = uf.find(tKey(mainBattery.id, batT2));

  // Build component adjacency between nets (excluding mainBattery)
  const otherComps = components.filter((c) => c.id !== mainBattery.id);
  const netToComps = new Map<string, CircuitComponent[]>();
  const addNetComp = (net: string, comp: CircuitComponent) => {
    if (!netToComps.has(net)) netToComps.set(net, []);
    netToComps.get(net)!.push(comp);
  };

  const compNets = new Map<string, [string, string]>();
  for (const c of otherComps) {
    const [t1, t2] = getCompTerminalIds(c);
    const n1 = uf.find(tKey(c.id, t1));
    const n2 = uf.find(tKey(c.id, t2));
    compNets.set(c.id, [n1, n2]);
    addNetComp(n1, c);
    if (n2 !== n1) addNetComp(n2, c);
  }

  // Check if posNet === negNet (direct short circuit across the battery!)
  const hasDirectBusShort = posNet === negNet;

  // Decompose connected non-battery components into parallel rungs (each rung is a series chain)
  const usedCompIds = new Set<string>();
  const rungs: CircuitComponent[][] = [];

  // Helper: trace a series chain starting from a component attached to startNet
  const traceChain = (firstComp: CircuitComponent, startNet: string): CircuitComponent[] => {
    const chain: CircuitComponent[] = [firstComp];
    usedCompIds.add(firstComp.id);

    let [n1, n2] = compNets.get(firstComp.id)!;
    let currNet = n1 === startNet ? n2 : n1;

    while (currNet !== negNet && currNet !== posNet) {
      const neighbors = (netToComps.get(currNet) ?? []).filter((c) => !usedCompIds.has(c.id));
      if (neighbors.length === 0) break;
      const nextComp = neighbors[0];
      chain.push(nextComp);
      usedCompIds.add(nextComp.id);
      const [cn1, cn2] = compNets.get(nextComp.id)!;
      currNet = cn1 === currNet ? cn2 : cn1;
    }

    return chain;
  };

  // Start tracing from all components connected to posNet
  for (const c of netToComps.get(posNet) ?? []) {
    if (!usedCompIds.has(c.id)) {
      rungs.push(traceChain(c, posNet));
    }
  }

  // Also trace any remaining components connected to negNet (e.g., open branch from neg)
  for (const c of netToComps.get(negNet) ?? []) {
    if (!usedCompIds.has(c.id)) {
      rungs.push(traceChain(c, negNet).reverse());
    }
  }

  // Any components still connected to an already-placed net (nested parallel sub-branches)
  let addedNested = true;
  while (addedNested) {
    addedNested = false;
    for (const c of otherComps) {
      if (usedCompIds.has(c.id)) continue;
      const [n1, n2] = compNets.get(c.id)!;
      // Check if either net belongs to any used component
      const touchesUsed = otherComps.some((u) => {
        if (!usedCompIds.has(u.id)) return false;
        const [un1, un2] = compNets.get(u.id)!;
        return un1 === n1 || un2 === n1 || un1 === n2 || un2 === n2;
      });
      if (touchesUsed) {
        rungs.push(traceChain(c, n1));
        addedNested = true;
      }
    }
  }

  // Remaining components are floating / disconnected
  const floatingComponents = otherComps.filter((c) => !usedCompIds.has(c.id));

  // Layout geometry: clean textbook rectangle!
  const leftBusX = 56;
  const rightBusX = width - 56;
  const bottomY = height - 40;
  const topMargin = floatingComponents.length > 0 ? 52 : 34;

  const placements: SchematicNodePlacement[] = [];
  const segments: SchematicWireSegment[] = [];
  const junctions: SchematicJunction[] = [];

  // Place main battery centered on bottom rail
  const batX = width / 2;
  placements.push({
    component: mainBattery,
    x: batX,
    y: bottomY,
    orientation: 'horizontal',
  });

  // Bottom horizontal rail segments around battery (gap of 26px for battery symbol)
  const isMainShorted = simulation.hasShortCircuit;
  segments.push({ x1: leftBusX, y1: bottomY, x2: batX - 14, y2: bottomY, isShorted: isMainShorted });
  segments.push({ x1: batX + 14, y1: bottomY, x2: rightBusX, y2: bottomY, isShorted: isMainShorted });

  // Total rungs to draw (include a dedicated bypass rung if direct short exists)
  const totalRungs = rungs.length + (hasDirectBusShort ? 1 : 0);

  if (totalRungs > 0) {
    const usableH = bottomY - topMargin;
    const rungStep = totalRungs === 1 ? 0 : Math.min(54, usableH / totalRungs);
    const firstRungY =
      totalRungs === 1 ? topMargin + usableH * 0.28 : bottomY - rungStep * totalRungs;

    const topRungY = firstRungY;

    // Left & right vertical bus rails
    segments.push({ x1: leftBusX, y1: bottomY, x2: leftBusX, y2: topRungY, isShorted: isMainShorted });
    segments.push({ x1: rightBusX, y1: bottomY, x2: rightBusX, y2: topRungY, isShorted: isMainShorted });

    let rungIdx = 0;

    // Draw each component rung
    for (const chain of rungs) {
      const y = firstRungY + rungIdx * rungStep;
      const count = chain.length;
      const span = rightBusX - leftBusX;

      let prevX = leftBusX;
      for (let i = 0; i < count; i++) {
        const comp = chain[i];
        const cx = leftBusX + (span * (i + 1)) / (count + 1);
        const halfGap = comp.kind === 'material' ? 20 : 15;

        segments.push({ x1: prevX, y1: y, x2: cx - halfGap, y2: y });
        placements.push({
          component: comp,
          x: cx,
          y,
          orientation: 'horizontal',
        });
        prevX = cx + halfGap;
      }
      segments.push({ x1: prevX, y1: y, x2: rightBusX, y2: y });

      // Add junction dots if this rung branches off the side rails (not the topmost corner)
      if (rungIdx > 0) {
        junctions.push({ x: leftBusX, y });
        junctions.push({ x: rightBusX, y });
      }
      rungIdx++;
    }

    // Draw direct short-circuit bypass line if posNet === negNet
    if (hasDirectBusShort) {
      const y = firstRungY + rungIdx * rungStep;
      segments.push({
        x1: leftBusX,
        y1: y,
        x2: rightBusX,
        y2: y,
        isShorted: true,
      });
      if (rungIdx > 0) {
        junctions.push({ x: leftBusX, y });
        junctions.push({ x: rightBusX, y });
      }
    }
  }

  return {
    width,
    height,
    placements,
    segments,
    junctions,
    floatingComponents,
  };
}
