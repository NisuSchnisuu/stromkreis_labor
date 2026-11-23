import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { memo } from 'react';
import type { CircuitComponent, ComponentSimState } from '../simulation/types';
import { useCircuitStore } from '../store/useCircuitStore';
import { BatteryModel } from './components/BatteryModel';
import { BulbModel } from './components/BulbModel';
import { MaterialModel } from './components/MaterialModel';
import { SwitchModel } from './components/SwitchModel';

interface DraggableComponentProps {
  component: CircuitComponent;
  simState: ComponentSimState;
  isSelected: boolean;
  isSplicing: boolean;
}

function getRingRadius(kind: CircuitComponent['kind']): number {
  switch (kind) {
    case 'battery':
      return 0.88;
    case 'switch':
      return 0.8;
    case 'bulb':
      return 0.65;
    case 'material':
      return 0.74;
  }
}

export const DraggableComponent = memo(function DraggableComponent({
  component,
  simState,
  isSelected,
  isSplicing,
}: DraggableComponentProps) {
  const selectComponent = useCircuitStore((s) => s.selectComponent);
  const setDragState = useCircuitStore((s) => s.setDragState);
  const toggleBulbScrewed = useCircuitStore((s) => s.toggleBulbScrewed);
  const wireMode = useCircuitStore((s) => s.wireMode);

  const ringR = getRingRadius(component.kind);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    // Strictly left-click on mouse (so right-click pans camera consistently everywhere)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (wireMode) return;
    // If a terminal hover ring is active, NEVER steal the click — let the terminal handle it!
    if (useCircuitStore.getState().hoveredTerminal !== null) return;
    e.stopPropagation();
    selectComponent(component.id);
    setDragState({
      type: 'component',
      componentId: component.id,
      offsetX: component.position[0] - e.point.x,
      offsetZ: component.position[2] - e.point.z,
      spliceWireId: null,
      hasMoved: false,
    });
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.button !== 0 || wireMode) return;
    if (component.kind === 'bulb') {
      e.stopPropagation();
      toggleBulbScrewed(component.id);
    }
  };

  const handleRotateHandleDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    setDragState({
      type: 'rotate',
      componentId: component.id,
    });
  };

  return (
    <group
      position={component.position}
      rotation={[0, component.rotationY, 0]}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {component.kind === 'battery' && (
        <BatteryModel component={component} simState={simState} />
      )}
      {component.kind === 'bulb' && (
        <BulbModel component={component} simState={simState} />
      )}
      {component.kind === 'switch' && (
        <SwitchModel component={component} simState={simState} />
      )}
      {component.kind === 'material' && (
        <MaterialModel component={component} simState={simState} />
      )}

      {/* Unified Selection Ring + Direct Touch/Mouse 3D Rotation Handle */}
      {isSelected && (
        <group position={[0, 0.018, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[ringR - 0.04, ringR + 0.03, 32]} />
            <meshBasicMaterial color={isSplicing ? '#22c55e' : '#38bdf8'} side={2} />
          </mesh>

          {/* Direct Rotation Grab Handle on the front of the ring (works seamlessly on iPad & Mouse!) */}
          <group position={[0, 0.06, ringR + 0.16]}>
            {/* Generous touch target */}
            <mesh
              onPointerDown={handleRotateHandleDown}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'grab';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
              }}
            >
              <sphereGeometry args={[0.26, 10, 10]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Visual cyan rotation knob */}
            <mesh castShadow>
              <cylinderGeometry args={[0.12, 0.12, 0.07, 16]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={0.45}
                roughness={0.3}
              />
            </mesh>
            {/* Connector stem to ring */}
            <mesh position={[0, -0.02, -0.1]}>
              <boxGeometry args={[0.04, 0.03, 0.14]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        </group>
      )}

      {/* Visual Splice Indicator when dragging a component over a wire */}
      {isSplicing && (
        <Html position={[0, 1.05, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold shadow-lg whitespace-nowrap">
            ⚡ Loslassen zum Verkabeln
          </div>
        </Html>
      )}
    </group>
  );
});
