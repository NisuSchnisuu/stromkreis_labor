import { Html, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import {
  type CircuitComponent,
  type ComponentSimState,
  getLocalTerminals,
  getTerminalWorldPosition,
} from '../../simulation/types';
import { useCircuitStore } from '../../store/useCircuitStore';
import { TerminalNode } from '../TerminalNode';

interface Props {
  component: CircuitComponent;
  simState: ComponentSimState;
}

export function BatteryModel({ component, simState }: Props) {
  const showMeasurements = useCircuitStore((s) => s.showMeasurements);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const smokeRef = useRef<THREE.Group>(null);
  const terminals = getLocalTerminals('battery');

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (bodyMatRef.current) {
      if (simState.isShorted) {
        const pulse = 0.4 + 0.4 * Math.sin(t * 10);
        bodyMatRef.current.emissive.set('#ef4444');
        bodyMatRef.current.emissiveIntensity = pulse;
      } else if (bodyMatRef.current.emissiveIntensity !== 0) {
        bodyMatRef.current.emissive.set('#000000');
        bodyMatRef.current.emissiveIntensity = 0;
      }
    }
    if (smokeRef.current && simState.isShorted) {
      smokeRef.current.children.forEach((child, idx) => {
        const phase = (t * 1.4 + idx * 0.33) % 1;
        child.position.y = 0.65 + phase * 0.9;
        child.scale.setScalar(0.6 + phase * 1.1);
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - phase) * 0.5;
      });
    }
  });

  return (
    <group>
      {/* Main 4.5V 3R12 flat battery body */}
      <mesh position={[0, 0.28, 0.08]} castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.52, 0.98]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          color="#1e293b"
          roughness={0.45}
          metalness={0.15}
        />
      </mesh>

      {/* Red top accent band */}
      <mesh position={[0, 0.545, 0.25]} receiveShadow>
        <boxGeometry args={[0.98, 0.015, 0.48]} />
        <meshStandardMaterial color="#dc2626" roughness={0.5} />
      </mesh>

      {/* White label band */}
      <mesh position={[0, 0.548, -0.15]} receiveShadow>
        <boxGeometry args={[0.98, 0.015, 0.28]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>

      {/* Fast GPU Text markings (no DOM Html overhead!) */}
      <Text
        position={[-0.28, 0.56, -0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color="#dc2626"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        +
      </Text>
      <Text
        position={[0.28, 0.56, -0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color="#0f172a"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        −
      </Text>
      <Text
        position={[0, 0.56, 0.25]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.18}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        4,5 V
      </Text>

      {/* Short brass strip (+) on left */}
      <mesh position={[-0.28, 0.36, -0.49]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.14, 0.03, 0.34]} />
        <meshStandardMaterial color="#e5b84b" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Long brass strip (−) on right */}
      <mesh position={[0.28, 0.39, -0.53]} rotation={[0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.14, 0.03, 0.46]} />
        <meshStandardMaterial color="#e5b84b" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Short-circuit rising smoke particles */}
      {simState.isShorted && (
        <group ref={smokeRef}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[(i - 1) * 0.15, 0.7, -0.2]}>
              <sphereGeometry args={[0.14, 8, 8]} />
              <meshBasicMaterial color="#94a3b8" transparent opacity={0.4} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}

      {/* Short-circuit warning badge */}
      {simState.isShorted && (
        <Html position={[0, 1.15, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold shadow-lg whitespace-nowrap">
            ⚠️ Kurzschluss!
          </div>
        </Html>
      )}

      {/* Optional measurement readout */}
      {showMeasurements && !simState.isShorted && (
        <Html position={[0, 0.92, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="px-1.5 py-0.5 rounded bg-slate-900/85 text-amber-300 text-[11px] font-mono shadow whitespace-nowrap">
            {simState.voltageDrop.toFixed(2)} V · {Math.abs(simState.current).toFixed(2)} A
          </div>
        </Html>
      )}

      {/* Interactive Terminals */}
      {terminals.map((t) => (
        <TerminalNode
          key={t.id}
          componentId={component.id}
          terminalId={t.id}
          position={t.localPosition}
          worldPosition={getTerminalWorldPosition(component, t.id)}
          label={t.label}
        />
      ))}
    </group>
  );
}
