import * as THREE from 'three';
import {
  type CircuitComponent,
  type Wire,
  getTerminalWorldPosition,
} from '../simulation/types';

export interface ObstacleCircle {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export function getComponentObstacleRadius(kind: CircuitComponent['kind']): number {
  switch (kind) {
    case 'battery':
      return 0.82;
    case 'switch':
      return 0.74;
    case 'bulb':
      return 0.58;
    case 'material':
      return 0.66;
  }
}

export function resolveWireEndPos(
  end: Wire['endA'],
  components: CircuitComponent[]
): [number, number, number] {
  if (end.attachedTo) {
    const comp = components.find((c) => c.id === end.attachedTo!.componentId);
    if (comp) {
      return getTerminalWorldPosition(comp, end.attachedTo.terminalId);
    }
  }
  return end.freePosition;
}

/**
 * Computes a smooth, dynamic 3D cable path that rests on the wooden desk
 * and automatically wraps around components instead of clipping through them.
 */
export function computeDynamicWirePoints(
  wire: Wire,
  components: CircuitComponent[]
): THREE.Vector3[] {
  const posA = resolveWireEndPos(wire.endA, components);
  const posB = resolveWireEndPos(wire.endB, components);

  const start = new THREE.Vector3(...posA);
  const end = new THREE.Vector3(...posB);
  const dist = start.distanceTo(end);

  const attachedA = wire.endA.attachedTo?.componentId ?? null;
  const attachedB = wire.endB.attachedTo?.componentId ?? null;

  // Build obstacle list
  const obstacles: ObstacleCircle[] = components.map((c) => {
    const baseR = getComponentObstacleRadius(c.kind);
    // Keep a slightly tighter core radius for the two endpoint components
    // so cables don't pass right through the battery body, while still reaching the terminal cleanly.
    const isEndpoint = c.id === attachedA || c.id === attachedB;
    return {
      id: c.id,
      x: c.position[0],
      z: c.position[2],
      radius: isEndpoint ? baseR * 0.68 : baseR + 0.14,
    };
  });

  // Deterministic subtle initial side offset so parallel/same-terminal wires separate nicely
  const hash = wire.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const sideSign = hash % 2 === 0 ? 1 : -1;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const len2d = Math.hypot(dx, dz) || 1;
  const perpX = (-dz / len2d) * sideSign;
  const perpZ = (dx / len2d) * sideSign;
  const initialArch = Math.min(0.32, dist * 0.09);

  // Sample N+1 points along the cable
  const segments = 10;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const archFactor = Math.sin(t * Math.PI);
    const x = THREE.MathUtils.lerp(start.x, end.x, t) + perpX * initialArch * archFactor;
    const z = THREE.MathUtils.lerp(start.z, end.z, t) + perpZ * initialArch * archFactor;
    // Smoothly drop from terminal height down to the tabletop (y = 0.045)
    let y = 0.045;
    if (i === 0) y = start.y;
    else if (i === segments) y = end.y;
    else if (i === 1) y = Math.max(0.055, start.y * 0.55);
    else if (i === segments - 1) y = Math.max(0.055, end.y * 0.55);

    pts.push(new THREE.Vector3(x, y, z));
  }

  // Iterative obstacle avoidance + elastic curve relaxation
  const iterations = 7;
  for (let iter = 0; iter < iterations; iter++) {
    // 1. Push interior points out of any obstacle circle
    for (let i = 1; i < segments; i++) {
      const p = pts[i];
      for (const obs of obstacles) {
        const vx = p.x - obs.x;
        const vz = p.z - obs.z;
        const d = Math.hypot(vx, vz);
        if (d < obs.radius) {
          if (d < 0.001) {
            p.x = obs.x + perpX * obs.radius;
            p.z = obs.z + perpZ * obs.radius;
          } else {
            const push = obs.radius / d;
            p.x = obs.x + vx * push;
            p.z = obs.z + vz * push;
          }
        }
      }
      // Keep inside tabletop bounds
      p.x = Math.max(-5.5, Math.min(5.5, p.x));
      p.z = Math.max(-3.6, Math.min(3.6, p.z));
    }

    // 2. Smooth interior points (elastic tension)
    if (iter < iterations - 1) {
      for (let i = 1; i < segments; i++) {
        const prev = pts[i - 1];
        const next = pts[i + 1];
        pts[i].x = pts[i].x * 0.55 + ((prev.x + next.x) * 0.5) * 0.45;
        pts[i].z = pts[i].z * 0.55 + ((prev.z + next.z) * 0.5) * 0.45;
      }
    }
  }

  return pts;
}

/**
 * Finds the closest connected wire to a tabletop position (x, z), used for
 * auto-splicing a dragged component directly into an existing wire.
 */
export function findSpliceableWire(
  x: number,
  z: number,
  draggedComponentId: string,
  wires: Wire[],
  components: CircuitComponent[],
  threshold = 0.58
): string | null {
  // Only allow auto-splicing if the dragged component currently has NO wires attached to it
  const alreadyWired = wires.some(
    (w) =>
      w.endA.attachedTo?.componentId === draggedComponentId ||
      w.endB.attachedTo?.componentId === draggedComponentId
  );
  if (alreadyWired) return null;

  // Exclude the dragged component from obstacle avoidance when checking wire hit
  const otherComps = components.filter((c) => c.id !== draggedComponentId);

  let bestWireId: string | null = null;
  let bestDist = threshold;

  for (const w of wires) {
    if (!w.endA.attachedTo || !w.endB.attachedTo) continue;
    const pts = computeDynamicWirePoints(w, otherComps);
    // Check distance to each interior segment of the wire
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i].x - x, pts[i].z - z);
      if (d < bestDist) {
        bestDist = d;
        bestWireId = w.id;
      }
    }
  }

  return bestWireId;
}
