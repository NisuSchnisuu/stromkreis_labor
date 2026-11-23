import type { ThreeEvent } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { TerminalRef } from '../simulation/types';
import { getAttachedWireEnds, useCircuitStore } from '../store/useCircuitStore';

interface TerminalNodeProps {
  componentId: string;
  terminalId: string;
  position: [number, number, number];
  worldPosition: [number, number, number];
  label?: string;
}

export function TerminalNode({
  componentId,
  terminalId,
  position,
  worldPosition,
}: TerminalNodeProps) {
  const [hovered, setHovered] = useState(false);
  const pointerDownScreen = useRef<{ x: number; y: number } | null>(null);
  const startedDrag = useRef(false);

  const connectingFrom = useCircuitStore((s) => s.connectingFrom);
  const focusedTerminal = useCircuitStore((s) => s.focusedTerminal);
  const wireMode = useCircuitStore((s) => s.wireMode);
  const dragState = useCircuitStore((s) => s.dragState);
  const handleTerminalTap = useCircuitStore((s) => s.handleTerminalTap);
  const startWireFromTerminal = useCircuitStore((s) => s.startWireFromTerminal);
  const detachWireAtTerminal = useCircuitStore((s) => s.detachWireAtTerminal);
  const selectOrCycleWireAtTerminal = useCircuitStore((s) => s.selectOrCycleWireAtTerminal);
  const setHoveredTerminal = useCircuitStore((s) => s.setHoveredTerminal);

  const isSelectedForConnect =
    connectingFrom?.componentId === componentId &&
    connectingFrom?.terminalId === terminalId;

  const isFocused =
    focusedTerminal?.componentId === componentId &&
    focusedTerminal?.terminalId === terminalId;

  const isSnapTarget =
    dragState.type === 'wireEnd' &&
    dragState.hoveredTerminal?.componentId === componentId &&
    dragState.hoveredTerminal?.terminalId === terminalId;

  const isWiringActive = wireMode || dragState.type === 'wireEnd' || connectingFrom !== null;

  const ref: TerminalRef = { componentId, terminalId };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    pointerDownScreen.current = { x: e.clientX, y: e.clientY };
    startedDrag.current = false;

    // In Wire Mode, immediately start pulling a new live wire!
    if (wireMode && !connectingFrom) {
      startedDrag.current = true;
      pointerDownScreen.current = null;
      startWireFromTerminal(ref, worldPosition);
      return;
    }

    // Outside Wire Mode: if wires are attached here, immediately highlight one & focus terminal
    // so the user can scroll the wheel (while holding or after clicking) to pick which wire to detach!
    if (!connectingFrom) {
      const wires = useCircuitStore.getState().wires;
      const attached = getAttachedWireEnds(wires, ref);
      if (attached.length > 0) {
        selectOrCycleWireAtTerminal(ref, 0);
      }
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!pointerDownScreen.current || startedDrag.current) return;
    const dx = e.clientX - pointerDownScreen.current.x;
    const dy = e.clientY - pointerDownScreen.current.y;
    if (Math.hypot(dx, dy) > 6) {
      e.stopPropagation();
      startedDrag.current = true;
      pointerDownScreen.current = null;

      if (!wireMode) {
        const wires = useCircuitStore.getState().wires;
        const attached = getAttachedWireEnds(wires, ref);
        if (attached.length > 0) {
          // Detach the currently highlighted wire at this terminal!
          detachWireAtTerminal(ref, worldPosition);
          return;
        }
      }
      startWireFromTerminal(ref, worldPosition);
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!pointerDownScreen.current) return;
    e.stopPropagation();
    const wasTap = !startedDrag.current;
    pointerDownScreen.current = null;
    if (wasTap) {
      handleTerminalTap(ref);
    }
  };

  const ringColor = isSnapTarget
    ? '#22c55e'
    : isSelectedForConnect
      ? '#f59e0b'
      : isFocused || hovered
        ? '#38bdf8'
        : isWiringActive
          ? '#38bdf8'
          : '#d4af37';

  const showRing = hovered || isFocused || isSelectedForConnect || isSnapTarget || isWiringActive;
  const ringScale = isSnapTarget ? 1.55 : isSelectedForConnect || hovered || isFocused ? 1.3 : 1.05;

  return (
    <group position={position}>
      {/* Generous invisible hit sphere for easy mouse & iPad touch targeting */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          setHoveredTerminal(ref);
          document.body.style.cursor = wireMode ? 'crosshair' : 'grab';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          const curr = useCircuitStore.getState().hoveredTerminal;
          if (curr?.componentId === componentId && curr?.terminalId === terminalId) {
            setHoveredTerminal(null);
          }
          document.body.style.cursor = 'auto';
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <sphereGeometry args={[isWiringActive ? 0.3 : 0.25, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Visual brass/metal contact pin */}
      <mesh castShadow>
        <cylinderGeometry args={[0.078, 0.088, 0.09, 14]} />
        <meshStandardMaterial
          color={isSnapTarget ? '#4ade80' : '#d4af37'}
          metalness={0.85}
          roughness={0.22}
          emissive={
            isSnapTarget
              ? '#22c55e'
              : isSelectedForConnect
                ? '#f59e0b'
                : isFocused || isWiringActive
                  ? '#0284c7'
                  : '#000000'
          }
          emissiveIntensity={
            isSnapTarget ? 0.9 : isSelectedForConnect ? 0.7 : isFocused || isWiringActive ? 0.45 : 0
          }
        />
      </mesh>

      {/* Highlight ring (always visible on top even if component body partially occludes it) */}
      {showRing && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.06, 0]}
          scale={ringScale}
          renderOrder={10}
        >
          <ringGeometry args={[0.105, 0.155, 20]} />
          <meshBasicMaterial color={ringColor} side={2} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}
