import { Html } from '@react-three/drei';
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

export function BulbModel({ component, simState }: Props) {
  const showMeasurements = useCircuitStore((s) => s.showMeasurements);
  const terminals = getLocalTerminals('bulb');
  const isScrewedIn = component.isScrewedIn !== false;
  const b = isScrewedIn ? simState.brightness : 0;

  // Warm orange-amber when dim (series), bright warm white-yellow when full (parallel/single)
  const glowColor = b > 0.7 ? '#fef08a' : b > 0.15 ? '#fb923c' : '#334155';
  const filamentColor = b > 0.7 ? '#ffffff' : b > 0.15 ? '#fdba74' : '#475569';

  return (
    <group>
      {/* Black bakelite E10 socket base */}
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.42, 0.16, 20]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Brass screw-terminal wings on left and right */}
      <mesh position={[-0.38, 0.1, 0]} castShadow>
        <boxGeometry args={[0.26, 0.04, 0.18]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0.38, 0.1, 0]} castShadow>
        <boxGeometry args={[0.26, 0.04, 0.18]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Brass inner socket collar */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.14, 18]} />
        <meshStandardMaterial color="#c8a232" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* The screw-in glass bulb (lifts & tilts when unscrewed!) */}
      <group
        position={isScrewedIn ? [0, 0, 0] : [0.22, 0.34, 0.08]}
        rotation={isScrewedIn ? [0, 0, 0] : [0.25, 0, -0.45]}
      >
        {/* Threaded metallic E10 screw base */}
        <mesh position={[0, 0.29, 0]} castShadow>
          <cylinderGeometry args={[0.135, 0.125, 0.14, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.25} />
        </mesh>

        {/* Glowing filament */}
        <mesh position={[0, 0.48, 0]}>
          <torusGeometry args={[0.065, 0.013, 8, 16, Math.PI]} />
          <meshStandardMaterial
            color={filamentColor}
            emissive={glowColor}
            emissiveIntensity={b * 5.5}
          />
        </mesh>

        {/* Fast lightweight glass globe (no expensive physical transmission pass!) */}
        <mesh position={[0, 0.52, 0]}>
          <sphereGeometry args={[0.24, 18, 18]} />
          <meshStandardMaterial
            color={b > 0.05 ? glowColor : '#e2e8f0'}
            emissive={glowColor}
            emissiveIntensity={b * 1.45}
            transparent
            opacity={b > 0.05 ? Math.min(0.92, 0.45 + b * 0.45) : 0.36}
            roughness={0.12}
            metalness={0.1}
          />
        </mesh>

        {/* Soft glow halo when lit */}
        {b > 0.05 && (
          <mesh position={[0, 0.52, 0]}>
            <sphereGeometry args={[0.31 + b * 0.12, 14, 14]} />
            <meshBasicMaterial
              color={glowColor}
              transparent
              opacity={Math.min(0.42, b * 0.3)}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Dynamic point light casting warm glow onto the table */}
        {b > 0.05 && (
          <pointLight
            position={[0, 0.55, 0]}
            color={glowColor}
            intensity={b * 3.0}
            distance={4.2}
            decay={2}
          />
        )}
      </group>

      {/* Unscrewed indicator */}
      {!isScrewedIn && (
        <Html position={[0.25, 0.98, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold shadow whitespace-nowrap">
            Herausgeschraubt
          </div>
        </Html>
      )}

      {/* Optional measurements */}
      {showMeasurements && isScrewedIn && (
        <Html position={[0, 0.98, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="px-1.5 py-0.5 rounded bg-slate-900/85 text-amber-300 text-[11px] font-mono shadow whitespace-nowrap">
            {Math.abs(simState.voltageDrop).toFixed(2)} V · {Math.abs(simState.current).toFixed(2)} A
          </div>
        </Html>
      )}

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
