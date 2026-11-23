import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CircuitComponent, Wire, WireSimState } from '../simulation/types';
import { useCircuitStore } from '../store/useCircuitStore';
import { getComponentObstacleRadius, resolveWireEndPos } from './wireRouting';

interface WireMeshProps {
  wire: Wire;
  components: CircuitComponent[];
  simState: WireSimState;
  isSelected: boolean;
  isSpliceTarget: boolean;
  showCurrentFlow: boolean;
}

const NODE_COUNT = 12; // Verlet physics nodes
const TUBE_SEGMENTS = 24; // Smooth sampled rings along CatmullRomCurve
const RADIAL_SEGMENTS = 8;
const FLOOR_Y = 0.042;
const PARTICLE_COUNT = 8;

function createReusableTubeGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const vertexCount = (TUBE_SEGMENTS + 1) * (RADIAL_SEGMENTS + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  for (let i = 0; i < TUBE_SEGMENTS; i++) {
    for (let j = 0; j < RADIAL_SEGMENTS; j++) {
      const a = i * (RADIAL_SEGMENTS + 1) + j;
      const b = (i + 1) * (RADIAL_SEGMENTS + 1) + j;
      const c = (i + 1) * (RADIAL_SEGMENTS + 1) + (j + 1);
      const d = i * (RADIAL_SEGMENTS + 1) + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geom.setIndex(indices);
  return geom;
}

export const WireMesh = memo(function WireMesh({
  wire,
  components,
  simState,
  isSelected,
  isSpliceTarget,
  showCurrentFlow,
}: WireMeshProps) {
  const selectWire = useCircuitStore((s) => s.selectWire);
  const tubeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);

  // Persistent Verlet physics state (no React re-renders per frame!)
  const nodesRef = useRef<THREE.Vector3[] | null>(null);
  const prevNodesRef = useRef<THREE.Vector3[] | null>(null);
  const tempCurve = useMemo(() => new THREE.CatmullRomCurve3([], false, 'catmullrom', 0.45), []);
  const geometry = useMemo(() => createReusableTubeGeometry(), []);

  // Pre-allocated scratch vectors for zero-GC tube updates
  const scratch = useMemo(
    () => ({
      pts: Array.from({ length: TUBE_SEGMENTS + 1 }, () => new THREE.Vector3()),
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      binormal: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      altUp: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(),
    }),
    []
  );

  // Keep latest props in refs so useFrame always reads fresh values without rebuilding
  const latestRef = useRef({ wire, components, simState, isSelected, isSpliceTarget, showCurrentFlow });
  latestRef.current = { wire, components, simState, isSelected, isSpliceTarget, showCurrentFlow };

  const sideSign = useMemo(() => {
    const hash = wire.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return hash % 2 === 0 ? 1 : -1;
  }, [wire.id]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const posA = resolveWireEndPos(wire.endA, components);
  const posB = resolveWireEndPos(wire.endB, components);

  useFrame(({ clock }, rawDelta) => {
    const {
      wire: curWire,
      components: curComps,
      simState: curSim,
      isSelected: curSelected,
      isSpliceTarget: curSplice,
      showCurrentFlow: curFlow,
    } = latestRef.current;

    const dt = Math.min(rawDelta, 0.033);
    const pA = resolveWireEndPos(curWire.endA, curComps);
    const pB = resolveWireEndPos(curWire.endB, curComps);

    // Initialize Verlet chain on first frame
    if (!nodesRef.current || !prevNodesRef.current) {
      const initNodes: THREE.Vector3[] = [];
      const initPrev: THREE.Vector3[] = [];
      const dx = pB[0] - pA[0];
      const dz = pB[2] - pA[2];
      const len = Math.hypot(dx, dz) || 1;
      const perpX = (-dz / len) * sideSign;
      const perpZ = (dx / len) * sideSign;

      for (let i = 0; i < NODE_COUNT; i++) {
        const t = i / (NODE_COUNT - 1);
        const bow = Math.sin(t * Math.PI) * Math.min(0.45, len * 0.14);
        const v = new THREE.Vector3(
          THREE.MathUtils.lerp(pA[0], pB[0], t) + perpX * bow,
          i === 0 ? pA[1] : i === NODE_COUNT - 1 ? pB[1] : FLOOR_Y + 0.02,
          THREE.MathUtils.lerp(pA[2], pB[2], t) + perpZ * bow
        );
        initNodes.push(v);
        initPrev.push(v.clone());
      }
      nodesRef.current = initNodes;
      prevNodesRef.current = initPrev;
    }

    const nodes = nodesRef.current;
    const prev = prevNodesRef.current;

    // 1. Pin endpoints to terminals / dragged clip
    nodes[0].set(pA[0], pA[1], pA[2]);
    prev[0].set(pA[0], pA[1], pA[2]);
    nodes[NODE_COUNT - 1].set(pB[0], pB[1], pB[2]);
    prev[NODE_COUNT - 1].set(pB[0], pB[1], pB[2]);

    // 2. Verlet integration with gravity & tabletop friction
    const damping = 0.84;
    const gravityY = -12.0 * dt * dt;

    for (let i = 1; i < NODE_COUNT - 1; i++) {
      const n = nodes[i];
      const p = prev[i];
      const onTable = n.y <= FLOOR_Y + 0.015;
      const friction = onTable ? 0.72 : damping;

      const vx = (n.x - p.x) * friction;
      const vy = (n.y - p.y) * damping;
      const vz = (n.z - p.z) * friction;

      p.copy(n);
      n.x += vx;
      n.y += vy + gravityY;
      n.z += vz;

      if (n.y < FLOOR_Y) n.y = FLOOR_Y;
    }

    // 3. Distance constraints + obstacle collision relaxation
    const directDist = nodes[0].distanceTo(nodes[NODE_COUNT - 1]);
    // Give cables realistic slack so they bow & drape softly when endpoints move closer
    const totalSlackLen = Math.max(directDist * 1.12, Math.min(2.6, directDist + 0.45));
    const segLen = totalSlackLen / (NODE_COUNT - 1);

    const attachedA = curWire.endA.attachedTo?.componentId ?? null;
    const attachedB = curWire.endB.attachedTo?.componentId ?? null;

    for (let iter = 0; iter < 6; iter++) {
      // Distance constraints
      for (let i = 0; i < NODE_COUNT - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
        const diff = (d - segLen) / d;

        if (i === 0) {
          b.x -= dx * diff;
          b.y -= dy * diff;
          b.z -= dz * diff;
        } else if (i === NODE_COUNT - 2) {
          a.x += dx * diff;
          a.y += dy * diff;
          a.z += dz * diff;
        } else {
          a.x += dx * diff * 0.5;
          a.y += dy * diff * 0.5;
          a.z += dz * diff * 0.5;
          b.x -= dx * diff * 0.5;
          b.y -= dy * diff * 0.5;
          b.z -= dz * diff * 0.5;
        }
      }

      // Floor + tabletop bounds + component obstacle collision
      for (let i = 1; i < NODE_COUNT - 1; i++) {
        const n = nodes[i];
        if (n.y < FLOOR_Y) n.y = FLOOR_Y;

        for (let cIdx = 0; cIdx < curComps.length; cIdx++) {
          const c = curComps[cIdx];
          const isEndpoint = c.id === attachedA || c.id === attachedB;
          const r = isEndpoint
            ? getComponentObstacleRadius(c.kind) * 0.66
            : getComponentObstacleRadius(c.kind) + 0.12;
          const vx = n.x - c.position[0];
          const vz = n.z - c.position[2];
          const d = Math.hypot(vx, vz);
          if (d < r) {
            if (d < 0.001) {
              n.x = c.position[0] + sideSign * r;
            } else {
              const scale = r / d;
              n.x = c.position[0] + vx * scale;
              n.z = c.position[2] + vz * scale;
            }
          }
        }

        n.x = Math.max(-5.5, Math.min(5.5, n.x));
        n.z = Math.max(-3.6, Math.min(3.6, n.z));
      }
    }

    // 4. Update pre-allocated Tube BufferGeometry in-place (ZERO GC!)
    tempCurve.points = nodes;
    for (let i = 0; i <= TUBE_SEGMENTS; i++) {
      tempCurve.getPoint(i / TUBE_SEGMENTS, scratch.pts[i]);
    }

    const radius = curSplice ? 0.058 : curSelected ? 0.05 : 0.036;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const normArr = normAttr.array as Float32Array;

    let vIdx = 0;
    for (let i = 0; i <= TUBE_SEGMENTS; i++) {
      const currPt = scratch.pts[i];
      if (i === 0) {
        scratch.tangent.subVectors(scratch.pts[1], currPt);
      } else if (i === TUBE_SEGMENTS) {
        scratch.tangent.subVectors(currPt, scratch.pts[i - 1]);
      } else {
        scratch.tangent.subVectors(scratch.pts[i + 1], scratch.pts[i - 1]);
      }
      if (scratch.tangent.lengthSq() < 1e-8) {
        scratch.tangent.set(1, 0, 0);
      } else {
        scratch.tangent.normalize();
      }

      const refUp = Math.abs(scratch.tangent.y) > 0.92 ? scratch.altUp : scratch.up;
      scratch.binormal.crossVectors(scratch.tangent, refUp).normalize();
      scratch.normal.crossVectors(scratch.binormal, scratch.tangent).normalize();

      for (let j = 0; j <= RADIAL_SEGMENTS; j++) {
        const theta = (j / RADIAL_SEGMENTS) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const nx = scratch.normal.x * cosT + scratch.binormal.x * sinT;
        const ny = scratch.normal.y * cosT + scratch.binormal.y * sinT;
        const nz = scratch.normal.z * cosT + scratch.binormal.z * sinT;

        posArr[vIdx] = currPt.x + nx * radius;
        posArr[vIdx + 1] = currPt.y + ny * radius;
        posArr[vIdx + 2] = currPt.z + nz * radius;

        normArr[vIdx] = nx;
        normArr[vIdx + 1] = ny;
        normArr[vIdx + 2] = nz;
        vIdx += 3;
      }
    }

    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
    geometry.computeBoundingSphere();

    // 5. Material emissive highlight / short-circuit / splice glow
    if (tubeMatRef.current) {
      if (curSplice) {
        const pulse = 0.55 + 0.45 * Math.sin(clock.getElapsedTime() * 10);
        tubeMatRef.current.emissive.set('#22c55e');
        tubeMatRef.current.emissiveIntensity = 0.75 + pulse * 0.75;
      } else if (curSim.isShorted) {
        const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 14);
        tubeMatRef.current.emissive.set('#ff4500');
        tubeMatRef.current.emissiveIntensity = 0.6 + pulse * 1.1;
      } else if (curSelected) {
        tubeMatRef.current.emissive.set('#38bdf8');
        tubeMatRef.current.emissiveIntensity = 0.65;
      } else if (tubeMatRef.current.emissiveIntensity !== 0) {
        tubeMatRef.current.emissive.set('#000000');
        tubeMatRef.current.emissiveIntensity = 0;
      }
    }

    // 6. Current-flow animated spheres
    if (curFlow && particlesRef.current && Math.abs(curSim.current) > 0.01) {
      const speed = Math.min(2.4, 0.25 + Math.abs(curSim.current) * 0.85);
      const dirSign = curSim.current >= 0 ? 1 : -1;
      phaseRef.current = (phaseRef.current + dt * speed * dirSign + 100) % 1;

      const children = particlesRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const u = (phaseRef.current + i / children.length) % 1;
        tempCurve.getPoint(u, scratch.v);
        children[i].position.copy(scratch.v);
      }
    }
  });

  const handleWirePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    selectWire(wire.id);
  };

  const renderClipVisual = (pos: [number, number, number], isAttached: boolean) => (
    <group position={pos}>
      <mesh castShadow>
        <cylinderGeometry args={[0.052, 0.068, 0.14, 10]} />
        <meshStandardMaterial
          color={isSelected ? '#38bdf8' : isAttached ? '#e2e8f0' : '#94a3b8'}
          metalness={0.9}
          roughness={0.22}
        />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.056, 0.12, 10]} />
        <meshStandardMaterial
          color={isSpliceTarget ? '#22c55e' : isSelected ? '#38bdf8' : wire.color}
          roughness={0.5}
        />
      </mesh>
    </group>
  );

  const hasCurrent = showCurrentFlow && Math.abs(simState.current) > 0.01;

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        castShadow
        onPointerDown={handleWirePointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <meshStandardMaterial
          ref={tubeMatRef}
          color={isSpliceTarget ? '#22c55e' : wire.color}
          roughness={0.42}
          metalness={0.05}
        />
      </mesh>

      {renderClipVisual(posA, Boolean(wire.endA.attachedTo))}
      {renderClipVisual(posB, Boolean(wire.endB.attachedTo))}

      {hasCurrent && (
        <group ref={particlesRef}>
          {Array.from({ length: PARTICLE_COUNT }).map((_, idx) => (
            <mesh key={idx}>
              <sphereGeometry args={[0.066, 8, 8]} />
              <meshBasicMaterial color={simState.isShorted ? '#ff2a00' : '#fde047'} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
});
