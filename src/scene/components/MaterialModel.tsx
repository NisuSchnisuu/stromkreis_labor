import { Text } from '@react-three/drei';
import {
  type CircuitComponent,
  type ComponentSimState,
  MATERIAL_SPECS,
  getLocalTerminals,
  getTerminalWorldPosition,
} from '../../simulation/types';
import { TerminalNode } from '../TerminalNode';

interface Props {
  component: CircuitComponent;
  simState: ComponentSimState;
}

export function MaterialModel({ component }: Props) {
  const matType = component.materialType ?? 'paperclip';
  const spec = MATERIAL_SPECS[matType];
  const terminals = getLocalTerminals('material');

  const renderObject = () => {
    switch (matType) {
      case 'paperclip':
        return (
          <group position={[0, 0.07, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <torusGeometry args={[0.14, 0.02, 8, 18, Math.PI]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
            </mesh>
            <mesh position={[-0.22, 0, 0.14]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
            </mesh>
            <mesh position={[0.22, 0, -0.14]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
            </mesh>
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.022, 0.022, 0.88, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
            </mesh>
          </group>
        );

      case 'nail':
        return (
          <group position={[0, 0.11, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.045, 0.045, 0.82, 12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.28} />
            </mesh>
            <mesh position={[-0.43, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.11, 0.11, 0.04, 12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.28} />
            </mesh>
            <mesh position={[0.47, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
              <coneGeometry args={[0.045, 0.14, 12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.28} />
            </mesh>
          </group>
        );

      case 'copper':
        return (
          <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.92, 0.045, 0.44]} />
            <meshStandardMaterial color="#d97706" metalness={0.92} roughness={0.2} />
          </mesh>
        );

      case 'alufolie':
        return (
          <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.94, 0.03, 0.46]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.32} />
          </mesh>
        );

      case 'eraser':
        return (
          <group position={[0, 0.11, 0]}>
            <mesh position={[-0.14, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.62, 0.2, 0.36]} />
              <meshStandardMaterial color="#f472b6" roughness={0.85} />
            </mesh>
            <mesh position={[0.31, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.28, 0.2, 0.36]} />
              <meshStandardMaterial color="#3b82f6" roughness={0.85} />
            </mesh>
          </group>
        );

      case 'glass':
        return (
          <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.92, 0.08, 0.46]} />
            <meshStandardMaterial
              color="#bae6fd"
              transparent
              opacity={0.55}
              roughness={0.08}
              metalness={0.15}
            />
          </mesh>
        );

      case 'sugar':
        return (
          <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.56, 0.34, 0.46]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.95} />
          </mesh>
        );

      case 'paper':
        return (
          <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.94, 0.02, 0.52]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.92} />
          </mesh>
        );

      case 'saltwater':
      case 'distilled_water':
        return (
          <group position={[0, 0.02, 0]}>
            <mesh position={[0, 0.28, 0]}>
              <cylinderGeometry args={[0.32, 0.28, 0.54, 18, 1, true]} />
              <meshStandardMaterial
                color="#e0f2fe"
                transparent
                opacity={0.35}
                roughness={0.1}
                side={2}
              />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.285, 0.26, 0.36, 18]} />
              <meshStandardMaterial
                color={matType === 'saltwater' ? '#38bdf8' : '#bae6fd'}
                transparent
                opacity={0.55}
                roughness={0.1}
              />
            </mesh>
            <mesh position={[-0.14, 0.32, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.42, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0.14, 0.32, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.42, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        );
    }
  };

  return (
    <group>
      {/* Subtle tray mat under test item */}
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry args={[1.15, 0.02, 0.68]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} transparent opacity={0.55} />
      </mesh>

      {renderObject()}

      {/* Fast GPU Text label on the tray front */}
      <Text
        position={[0, 0.03, 0.42]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.13}
        color="#1e293b"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {spec.label}
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
