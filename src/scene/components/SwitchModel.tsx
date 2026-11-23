import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import {
  type CircuitComponent,
  type ComponentSimState,
  getLocalTerminals,
  getTerminalWorldPosition,
} from '../../simulation/types';
import { TerminalNode } from '../TerminalNode';

interface Props {
  component: CircuitComponent;
  simState: ComponentSimState;
}

export function SwitchModel({ component }: Props) {
  const leverRef = useRef<THREE.Group>(null);
  const isClosed = Boolean(component.isClosed);
  const terminals = getLocalTerminals('switch');

  // Smoothly animate the knife-switch lever angle
  useFrame((_, delta) => {
    if (!leverRef.current) return;
    const targetRotZ = isClosed ? 0 : 0.68;
    const diff = targetRotZ - leverRef.current.rotation.z;
    if (Math.abs(diff) > 0.002) {
      leverRef.current.rotation.z = THREE.MathUtils.lerp(
        leverRef.current.rotation.z,
        targetRotZ,
        Math.min(1, delta * 14)
      );
    }
  });

  return (
    <group>
      {/* Classic school switch insulated base */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.28, 0.14, 0.56]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Left brass hinge post */}
      <mesh position={[-0.38, 0.22, 0]} castShadow>
        <boxGeometry args={[0.14, 0.18, 0.16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Right brass contact fork */}
      <mesh position={[0.38, 0.22, -0.06]} castShadow>
        <boxGeometry args={[0.14, 0.18, 0.04]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0.38, 0.22, 0.06]} castShadow>
        <boxGeometry args={[0.14, 0.18, 0.04]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Pivoting copper blade + insulated knob */}
      <group ref={leverRef} position={[-0.38, 0.26, 0]}>
        <mesh position={[0.42, 0, 0]} castShadow>
          <boxGeometry args={[0.88, 0.04, 0.07]} />
          <meshStandardMaterial color="#d97706" metalness={0.88} roughness={0.22} />
        </mesh>
        <mesh position={[0.88, 0.07, 0]} castShadow>
          <cylinderGeometry args={[0.068, 0.058, 0.19, 14]} />
          <meshStandardMaterial color={isClosed ? '#16a34a' : '#dc2626'} roughness={0.35} />
        </mesh>
      </group>

      {/* Lightweight GPU Text status on base */}
      <Text
        position={[0, 0.155, 0.19]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.12}
        color={isClosed ? '#4ade80' : '#f87171'}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {isClosed ? 'EIN' : 'AUS'}
      </Text>

      {/* Terminals */}
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
