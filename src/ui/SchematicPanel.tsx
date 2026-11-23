import { X } from 'lucide-react';
import { useMemo } from 'react';
import { buildTextbookSchematic } from '../simulation/schematicLayout';
import { type CircuitComponent, MATERIAL_SPECS } from '../simulation/types';
import { useCircuitStore } from '../store/useCircuitStore';

export function SchematicPanel() {
  const showSchematic = useCircuitStore((s) => s.showSchematic);
  const toggleSchematic = useCircuitStore((s) => s.toggleSchematic);
  const components = useCircuitStore((s) => s.components);
  const wires = useCircuitStore((s) => s.wires);
  const simulation = useCircuitStore((s) => s.simulation);

  const layout = useMemo(
    () => buildTextbookSchematic(components, wires, simulation),
    [components, wires, simulation]
  );

  if (!showSchematic) return null;

  const renderSymbol = (comp: CircuitComponent, x: number, y: number) => {
    const sim = simulation.components[comp.id];

    if (comp.kind === 'battery') {
      return (
        <g key={comp.id} transform={`translate(${x}, ${y})`}>
          {/* Clear background behind symbol */}
          <rect x={-14} y={-16} width={28} height={32} fill="#ffffff" />
          {/* Official NaTech battery symbol: long thin (+) left, short thick (-) right */}
          <line x1={-6} y1={-14} x2={-6} y2={14} stroke="#1e3a8a" strokeWidth={2.2} />
          <line x1={6} y1={-7} x2={6} y2={7} stroke="#1e3a8a" strokeWidth={4.5} />
          <text x={-14} y={-9} fill="#dc2626" fontSize={10} fontWeight="bold">
            +
          </text>
          <text x={10} y={-9} fill="#1e3a8a" fontSize={10} fontWeight="bold">
            −
          </text>
          {sim?.isShorted && (
            <circle
              cx={0}
              cy={0}
              r={19}
              fill="none"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          )}
        </g>
      );
    }

    if (comp.kind === 'bulb') {
      const b = comp.isScrewedIn !== false ? (sim?.brightness ?? 0) : 0;
      const fill =
        b > 0.65 ? '#fde047' : b > 0.15 ? '#fdba74' : '#ffffff';
      return (
        <g key={comp.id} transform={`translate(${x}, ${y})`}>
          <circle
            cx={0}
            cy={0}
            r={14}
            fill={fill}
            stroke={comp.isScrewedIn === false ? '#d97706' : '#1e3a8a'}
            strokeWidth={2.2}
            strokeDasharray={comp.isScrewedIn === false ? '3 2' : undefined}
          />
          <line x1={-9.5} y1={-9.5} x2={9.5} y2={9.5} stroke="#1e3a8a" strokeWidth={2} />
          <line x1={-9.5} y1={9.5} x2={9.5} y2={-9.5} stroke="#1e3a8a" strokeWidth={2} />
        </g>
      );
    }

    if (comp.kind === 'switch') {
      const closed = Boolean(comp.isClosed);
      return (
        <g key={comp.id} transform={`translate(${x}, ${y})`}>
          <rect x={-15} y={-14} width={30} height={22} fill="#ffffff" />
          <circle cx={-13} cy={0} r={3.2} fill="#1e3a8a" />
          <circle cx={13} cy={0} r={3.2} fill="#1e3a8a" />
          <line
            x1={-13}
            y1={0}
            x2={closed ? 13 : 10}
            y2={closed ? 0 : -13}
            stroke={closed ? '#15803d' : '#1e3a8a'}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </g>
      );
    }

    if (comp.kind === 'material') {
      const spec = comp.materialType ? MATERIAL_SPECS[comp.materialType] : null;
      return (
        <g key={comp.id} transform={`translate(${x}, ${y})`}>
          <rect
            x={-20}
            y={-10}
            width={40}
            height={20}
            rx={3}
            fill="#f8fafc"
            stroke="#1e3a8a"
            strokeWidth={2}
          />
          <text
            x={0}
            y={3.5}
            textAnchor="middle"
            fill="#0f172a"
            fontSize={8}
            fontWeight="bold"
          >
            {spec?.label.slice(0, 7) ?? 'Stoff'}
          </text>
        </g>
      );
    }

    return null;
  };

  return (
    <div className="fixed top-16 right-[122px] z-30 w-[300px] sm:w-[355px] rounded-2xl bg-slate-900/94 backdrop-blur-md border border-slate-700/80 shadow-2xl overflow-hidden text-slate-100">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-700/70 bg-slate-800/70">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-xs font-semibold tracking-wide uppercase text-slate-200">
            Schaltplan (Lehrmittel-Ansicht)
          </span>
        </div>
        <button
          onClick={toggleSchematic}
          className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
          aria-label="Schaltplan schliessen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2.5 bg-slate-950/60">
        {/* Classic white NaTech worksheet schematic card */}
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="w-full h-auto rounded-xl bg-white border border-slate-300 shadow-inner"
        >
          {/* Subtle notebook grid like NaTech TB S. 55 */}
          <defs>
            <pattern id="natech-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width={layout.width} height={layout.height} fill="url(#natech-grid)" />

          {/* Orthogonal textbook wires */}
          {layout.segments.map((seg, i) => (
            <line
              key={i}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={seg.isShorted ? '#dc2626' : '#1e3a8a'}
              strokeWidth={seg.isShorted ? 3.2 : 2.4}
              strokeLinecap="square"
            />
          ))}

          {/* Solid junction dots (Knotenpunkte) */}
          {layout.junctions.map((j, i) => (
            <circle key={i} cx={j.x} cy={j.y} r={3.6} fill="#1e3a8a" />
          ))}

          {/* Component symbols */}
          {layout.placements.map((p) => renderSymbol(p.component, p.x, p.y))}

          {/* Floating / not yet connected components */}
          {layout.floatingComponents.length > 0 && (
            <g>
              <text x={14} y={18} fill="#64748b" fontSize={8.5} fontWeight="bold">
                Nicht verbunden:
              </text>
              {layout.floatingComponents.slice(0, 4).map((c, idx) => (
                <g key={c.id} opacity={0.65}>
                  {renderSymbol(c, 118 + idx * 52, 18)}
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
