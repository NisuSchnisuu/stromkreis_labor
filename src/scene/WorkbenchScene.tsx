import { OrbitControls } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  type TerminalRef,
  getLocalTerminals,
  getTerminalWorldPosition,
} from '../simulation/types';
import { useCircuitStore } from '../store/useCircuitStore';
import { DraggableComponent } from './DraggableComponent';
import { WireMesh } from './WireMesh';
import { findSpliceableWire } from './wireRouting';

const SNAP_RADIUS = 0.56;

export function WorkbenchScene() {
  const components = useCircuitStore((s) => s.components);
  const wires = useCircuitStore((s) => s.wires);
  const simulation = useCircuitStore((s) => s.simulation);
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const selectedWireId = useCircuitStore((s) => s.selectedWireId);
  const focusedTerminal = useCircuitStore((s) => s.focusedTerminal);
  const dragState = useCircuitStore((s) => s.dragState);
  const pendingSpawn = useCircuitStore((s) => s.pendingSpawn);
  const showCurrentFlow = useCircuitStore((s) => s.showCurrentFlow);
  const cameraPresetRequest = useCircuitStore((s) => s.cameraPresetRequest);

  const moveComponent = useCircuitStore((s) => s.moveComponent);
  const setComponentRotation = useCircuitStore((s) => s.setComponentRotation);
  const spliceComponentIntoWire = useCircuitStore((s) => s.spliceComponentIntoWire);
  const toggleSwitch = useCircuitStore((s) => s.toggleSwitch);
  const updateWireEndFreePosition = useCircuitStore((s) => s.updateWireEndFreePosition);
  const finishWireEndDrag = useCircuitStore((s) => s.finishWireEndDrag);
  const setDragState = useCircuitStore((s) => s.setDragState);
  const clearSelection = useCircuitStore((s) => s.clearSelection);

  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();
  const targetCamPos = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3 | null>(null);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const tablePlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  // Project screen coordinates (clientX, clientY) onto the y=0 tabletop
  const screenToTable = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      if (raycaster.ray.intersectPlane(tablePlane, hitPoint)) {
        return [hitPoint.x, hitPoint.z];
      }
      return null;
    },
    [gl, raycaster, camera, tablePlane, hitPoint]
  );

  // Handle sidebar drag-and-drop: the moment pointer moves out of the right sidebar onto the 3D table,
  // spawn the real 3D component right under the finger/cursor!
  useEffect(() => {
    if (!pendingSpawn) return;

    const handleMove = (e: PointerEvent) => {
      const state = useCircuitStore.getState();
      if (!state.pendingSpawn) return;

      // Sidebar sits on the right ~112px; once pointer enters the canvas area, spawn live 3D object!
      const sidebarLeft = window.innerWidth - 118;
      if (e.clientX < sidebarLeft) {
        const pt = screenToTable(e.clientX, e.clientY);
        if (pt) {
          state.spawnComponentAt(
            state.pendingSpawn.kind,
            pt[0],
            pt[1],
            state.pendingSpawn.materialType
          );
          return;
        }
      }
      state.setPendingSpawn({
        ...state.pendingSpawn,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    };

    const handleUp = (e: PointerEvent) => {
      const state = useCircuitStore.getState();
      if (!state.pendingSpawn) return;
      const sidebarLeft = window.innerWidth - 118;
      if (e.clientX < sidebarLeft) {
        const pt = screenToTable(e.clientX, e.clientY);
        if (pt) {
          const id = state.spawnComponentAt(
            state.pendingSpawn.kind,
            pt[0],
            pt[1],
            state.pendingSpawn.materialType
          );
          state.setDragState({ type: 'none' });
          state.selectComponent(id);
          return;
        }
      }
      // Dropped back inside sidebar => cancel cleanly
      state.setPendingSpawn(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [pendingSpawn, screenToTable]);

  // Handle camera preset button clicks
  useEffect(() => {
    if (!cameraPresetRequest) return;
    if (cameraPresetRequest.mode === 'top') {
      targetCamPos.current = new THREE.Vector3(0, 9.2, 0.01);
      targetLookAt.current = new THREE.Vector3(0, 0, 0);
    } else {
      targetCamPos.current = new THREE.Vector3(0, 6.2, 6.8);
      targetLookAt.current = new THREE.Vector3(0, 0, 0);
    }
  }, [cameraPresetRequest]);

  // Smooth camera transition
  useFrame((_, delta) => {
    if (targetCamPos.current && targetLookAt.current && controlsRef.current) {
      camera.position.lerp(targetCamPos.current, Math.min(1, delta * 7));
      controlsRef.current.target.lerp(targetLookAt.current, Math.min(1, delta * 7));
      controlsRef.current.update();
      if (camera.position.distanceTo(targetCamPos.current) < 0.05) {
        targetCamPos.current = null;
        targetLookAt.current = null;
      }
    }
  });

  // Global mouse-wheel (rotate grabbed component OR cycle multiple wires on focused terminal),
  // keyboard shortcuts, and pointerup safety net
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const state = useCircuitStore.getState();
      if (state.dragState.type === 'component') {
        e.preventDefault();
        const step = (e.deltaY > 0 ? 1 : -1) * (Math.PI / 12); // 15° smooth step
        state.rotateComponent(state.dragState.componentId, step);
        return;
      }
      if (state.focusedTerminal) {
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        state.selectOrCycleWireAtTerminal(state.focusedTerminal, dir);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useCircuitStore.getState();
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedComponentId) {
          state.deleteComponent(state.selectedComponentId);
        } else if (state.selectedWireId) {
          state.deleteWire(state.selectedWireId);
        }
      } else if (e.key === 'Escape') {
        state.setWireMode(false);
        state.clearSelection();
      }
    };

    const handleWindowPointerUp = () => {
      const state = useCircuitStore.getState();
      if (state.dragState.type === 'component') {
        const drag = state.dragState;
        if (drag.spliceWireId) {
          state.spliceComponentIntoWire(drag.componentId, drag.spliceWireId);
        } else {
          if (!drag.hasMoved) {
            const comp = state.components.find((c) => c.id === drag.componentId);
            if (comp?.kind === 'switch') {
              state.toggleSwitch(comp.id);
            }
          }
          state.setDragState({ type: 'none' });
        }
      } else if (state.dragState.type === 'rotate') {
        state.setDragState({ type: 'none' });
      } else if (state.dragState.type === 'wireEnd') {
        const drag = state.dragState;
        const w = state.wires.find((x) => x.id === drag.wireId);
        const pos = w
          ? w[drag.end].freePosition
          : ([0, 0.08, 0] as [number, number, number]);
        state.finishWireEndDrag(drag.wireId, drag.end, pos, drag.hoveredTerminal);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, []);

  const findNearestTerminal = (x: number, z: number): TerminalRef | null => {
    let best: TerminalRef | null = null;
    let bestDist = SNAP_RADIUS;
    for (const comp of components) {
      for (const t of getLocalTerminals(comp.kind)) {
        const [wx, , wz] = getTerminalWorldPosition(comp, t.id);
        const d = Math.hypot(wx - x, wz - z);
        if (d < bestDist) {
          bestDist = d;
          best = { componentId: comp.id, terminalId: t.id };
        }
      }
    }
    return best;
  };

  const handlePlanePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (dragState.type === 'none') return;
    e.stopPropagation();
    const { x, z } = e.point;

    if (dragState.type === 'component') {
      const nx = x + dragState.offsetX;
      const nz = z + dragState.offsetZ;
      const spliceWireId = findSpliceableWire(
        nx,
        nz,
        dragState.componentId,
        wires,
        components
      );
      moveComponent(dragState.componentId, nx, nz, spliceWireId);
    } else if (dragState.type === 'rotate') {
      const comp = components.find((c) => c.id === dragState.componentId);
      if (comp) {
        const angle = Math.atan2(x - comp.position[0], z - comp.position[2]);
        setComponentRotation(comp.id, angle);
      }
    } else if (dragState.type === 'wireEnd') {
      const nearest = findNearestTerminal(x, z);
      if (nearest) {
        const comp = components.find((c) => c.id === nearest.componentId);
        const snapPos = comp
          ? getTerminalWorldPosition(comp, nearest.terminalId)
          : ([x, 0.14, z] as [number, number, number]);
        updateWireEndFreePosition(dragState.wireId, dragState.end, snapPos, nearest);
      } else {
        updateWireEndFreePosition(dragState.wireId, dragState.end, [x, 0.12, z], null);
      }
    }
  };

  const handlePlanePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (dragState.type === 'none') return;
    e.stopPropagation();
    const { x, z } = e.point;

    if (dragState.type === 'component') {
      if (dragState.spliceWireId) {
        spliceComponentIntoWire(dragState.componentId, dragState.spliceWireId);
      } else {
        if (!dragState.hasMoved) {
          const comp = components.find((c) => c.id === dragState.componentId);
          if (comp?.kind === 'switch') {
            toggleSwitch(comp.id);
          }
        }
        setDragState({ type: 'none' });
      }
    } else if (dragState.type === 'rotate') {
      setDragState({ type: 'none' });
    } else if (dragState.type === 'wireEnd') {
      const nearest = findNearestTerminal(x, z);
      finishWireEndDrag(dragState.wireId, dragState.end, [x, 0.08, z], nearest);
    }
  };

  const handleTablePointerDown = (e: ThreeEvent<PointerEvent>) => {
    // Only clear selection when explicitly pressing down on empty table (NOT on release/click!)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearSelection();
  };

  const isDragging = dragState.type !== 'none' || pendingSpawn !== null;
  const activeSpliceWireId =
    dragState.type === 'component' ? dragState.spliceWireId : null;
  const activeSpliceCompId =
    dragState.type === 'component' && dragState.spliceWireId ? dragState.componentId : null;

  return (
    <>
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 18, 34]} />

      {/* Crisp, fast classroom lighting */}
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#f8fafc', '#334155', 0.45]} />
      <directionalLight
        position={[6, 11, 7]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7.5}
        shadow-camera-right={7.5}
        shadow-camera-top={5.5}
        shadow-camera-bottom={-5.5}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[-6, 6, -5]} intensity={0.32} color="#bae6fd" />

      {/* Orbit camera (automatically paused while dragging/rotating/wiring/spawning; zoom disabled when cycling wires on a terminal) */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={!isDragging}
        enableZoom={!isDragging && focusedTerminal === null}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.2}
        maxDistance={15.5}
        maxPolarAngle={Math.PI / 2 - 0.06}
        minPolarAngle={0.05}
      />

      {/* Wooden classroom workbench table */}
      <group>
        <mesh position={[0, -0.18, 0]} receiveShadow onPointerDown={handleTablePointerDown}>
          <boxGeometry args={[12.2, 0.36, 8.2]} />
          <meshStandardMaterial color="#c89d6c" roughness={0.72} metalness={0.04} />
        </mesh>

        <mesh position={[0, -0.38, 0]} receiveShadow>
          <boxGeometry args={[12.4, 0.14, 8.4]} />
          <meshStandardMaterial color="#8b5e34" roughness={0.8} />
        </mesh>

        <mesh
          position={[0, 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          onPointerDown={handleTablePointerDown}
        >
          <planeGeometry args={[11.2, 7.2]} />
          <meshStandardMaterial color="#d9b78c" roughness={0.85} />
        </mesh>
      </group>

      {/* Invisible drag capture plane active only during drag/rotate/wire */}
      {dragState.type !== 'none' && (
        <mesh
          position={[0, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={handlePlanePointerMove}
          onPointerUp={handlePlanePointerUp}
        >
          <planeGeometry args={[50, 50]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Render all placed components */}
      {components.map((comp) => (
        <DraggableComponent
          key={comp.id}
          component={comp}
          simState={
            simulation.components[comp.id] ?? {
              current: 0,
              voltageDrop: 0,
              power: 0,
              brightness: 0,
              isShorted: false,
            }
          }
          isSelected={selectedComponentId === comp.id}
          isSplicing={activeSpliceCompId === comp.id}
        />
      ))}

      {/* Render all physics-driven Verlet cables */}
      {wires.map((wire) => (
        <WireMesh
          key={wire.id}
          wire={wire}
          components={components}
          simState={simulation.wires[wire.id] ?? { current: 0, isShorted: false }}
          isSelected={selectedWireId === wire.id}
          isSpliceTarget={activeSpliceWireId === wire.id}
          showCurrentFlow={showCurrentFlow}
        />
      ))}
    </>
  );
}
