import { Cable, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import {
  type ComponentKind,
  MATERIAL_SPECS,
  type MaterialType,
} from '../simulation/types';
import { WIRE_COLORS, useCircuitStore } from '../store/useCircuitStore';

function ComponentIllustration({
  kind,
  materialType,
}: {
  kind: ComponentKind;
  materialType?: MaterialType;
}) {
  if (kind === 'battery') {
    return (
      <svg viewBox="0 0 64 54" className="w-12 h-10">
        {/* Brass strips */}
        <rect x="19" y="4" width="6" height="12" rx="1" fill="#eab308" />
        <rect x="39" y="1" width="6" height="15" rx="1" fill="#eab308" />
        {/* Battery body */}
        <rect x="11" y="14" width="42" height="36" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
        <rect x="13" y="16" width="38" height="11" rx="2" fill="#f8fafc" />
        <rect x="13" y="29" width="38" height="18" rx="2" fill="#dc2626" />
        <text x="22" y="25" fill="#dc2626" fontSize="10" fontWeight="bold" textAnchor="middle">+</text>
        <text x="42" y="25" fill="#0f172a" fontSize="10" fontWeight="bold" textAnchor="middle">−</text>
        <text x="32" y="42" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">4,5 V</text>
      </svg>
    );
  }

  if (kind === 'bulb') {
    return (
      <svg viewBox="0 0 64 54" className="w-12 h-10">
        {/* Glass globe */}
        <circle cx="32" cy="20" r="14" fill="#fef08a" fillOpacity="0.45" stroke="#fde047" strokeWidth="1.8" />
        <path d="M27 24 Q32 14 37 24" fill="none" stroke="#f59e0b" strokeWidth="2" />
        {/* E10 screw collar */}
        <rect x="25" y="32" width="14" height="6" rx="1" fill="#cbd5e1" />
        {/* Black socket + brass wings */}
        <rect x="8" y="41" width="12" height="5" rx="1.5" fill="#d4af37" />
        <rect x="44" y="41" width="12" height="5" rx="1.5" fill="#d4af37" />
        <rect x="17" y="37" width="30" height="12" rx="3" fill="#1f2937" stroke="#475569" strokeWidth="1.2" />
      </svg>
    );
  }

  if (kind === 'switch') {
    return (
      <svg viewBox="0 0 64 54" className="w-12 h-10">
        {/* Base */}
        <rect x="8" y="34" width="48" height="12" rx="3" fill="#334155" stroke="#64748b" strokeWidth="1.2" />
        {/* Brass terminals */}
        <circle cx="14" cy="34" r="3.5" fill="#d4af37" />
        <circle cx="50" cy="34" r="3.5" fill="#d4af37" />
        {/* Copper blade angled up */}
        <line x1="18" y1="32" x2="45" y2="15" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
        {/* Red handle */}
        <circle cx="47" cy="13" r="4.5" fill="#dc2626" />
      </svg>
    );
  }

  // Materials
  const spec = materialType ? MATERIAL_SPECS[materialType] : MATERIAL_SPECS.paperclip;
  if (materialType === 'eraser') {
    return (
      <svg viewBox="0 0 64 44" className="w-11 h-8">
        <rect x="10" y="12" width="28" height="20" rx="3" fill="#f472b6" />
        <rect x="38" y="12" width="16" height="20" rx="3" fill="#3b82f6" />
      </svg>
    );
  }
  if (materialType === 'nail') {
    return (
      <svg viewBox="0 0 64 44" className="w-11 h-8">
        <rect x="10" y="14" width="5" height="16" rx="1" fill="#94a3b8" />
        <rect x="15" y="19" width="32" height="6" fill="#94a3b8" />
        <polygon points="47,19 56,22 47,25" fill="#cbd5e1" />
      </svg>
    );
  }
  if (materialType === 'paperclip') {
    return (
      <svg viewBox="0 0 64 44" className="w-11 h-8">
        <rect x="12" y="12" width="40" height="20" rx="10" fill="none" stroke="#cbd5e1" strokeWidth="3.2" />
        <rect x="20" y="17" width="24" height="10" rx="5" fill="none" stroke="#cbd5e1" strokeWidth="2.5" />
      </svg>
    );
  }
  if (materialType === 'saltwater' || materialType === 'distilled_water') {
    return (
      <svg viewBox="0 0 64 44" className="w-11 h-8">
        <path d="M18 8 L22 38 L42 38 L46 8 Z" fill="#e0f2fe" fillOpacity="0.25" stroke="#bae6fd" strokeWidth="1.8" />
        <path d="M20 20 L22 37 L42 37 L44 20 Z" fill={materialType === 'saltwater' ? '#38bdf8' : '#bae6fd'} fillOpacity="0.7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 44" className="w-11 h-8">
      <rect
        x="12"
        y="11"
        width="40"
        height="22"
        rx="4"
        fill={spec.color}
        fillOpacity={materialType === 'glass' ? 0.5 : 0.95}
        stroke="#94a3b8"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function ComponentSidebar() {
  const [materialsOpen, setMaterialsOpen] = useState(false);

  const wireMode = useCircuitStore((s) => s.wireMode);
  const activeWireColor = useCircuitStore((s) => s.activeWireColor);
  const pendingSpawn = useCircuitStore((s) => s.pendingSpawn);
  const toggleWireMode = useCircuitStore((s) => s.toggleWireMode);
  const setActiveWireColor = useCircuitStore((s) => s.setActiveWireColor);
  const setPendingSpawn = useCircuitStore((s) => s.setPendingSpawn);

  const startDragItem = (
    kind: ComponentKind,
    label: string,
    materialType?: MaterialType
  ) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    setPendingSpawn({
      kind,
      materialType,
      label,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  return (
    <>
      <aside className="fixed top-16 right-2.5 bottom-3 z-30 w-[108px] rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Wire Mode button at top of sidebar */}
        <div className="p-2 border-b border-slate-700/70 bg-slate-800/40">
          <button
            onClick={toggleWireMode}
            className={`w-full flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition active:scale-95 ${
              wireMode
                ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-lg shadow-sky-500/25'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
            }`}
          >
            <Cable className="w-5 h-5" style={{ color: wireMode ? '#0f172a' : activeWireColor }} />
            <span className="text-[11px] font-bold">Kabel</span>
          </button>

          {/* Compact wire color dots */}
          <div className="flex items-center justify-center gap-1 mt-2">
            {WIRE_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setActiveWireColor(c.hex)}
                className={`w-3.5 h-3.5 rounded-full border transition ${
                  activeWireColor === c.hex ? 'border-white scale-125' : 'border-slate-600'
                }`}
                style={{ backgroundColor: c.hex }}
                title={`Kabelfarbe: ${c.name}`}
              />
            ))}
          </div>
        </div>

        {/* Scrollable draggable components list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
            Auf Tisch ziehen
          </div>

          {/* Core NaTech components */}
          {(
            [
              { kind: 'battery', label: 'Batterie' },
              { kind: 'bulb', label: 'Lämpchen' },
              { kind: 'switch', label: 'Schalter' },
            ] as const
          ).map((item) => (
            <div
              key={item.kind}
              onPointerDown={startDragItem(item.kind, item.label)}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 cursor-grab active:cursor-grabbing select-none touch-none transition hover:border-sky-400/60"
            >
              <ComponentIllustration kind={item.kind} />
              <span className="text-[11px] font-semibold text-slate-200">{item.label}</span>
            </div>
          ))}

          {/* Collapsible Materials section (KM 53.1 & 53.2) */}
          <button
            onClick={() => setMaterialsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/70 text-[11px] font-bold text-sky-300 border border-slate-700/60 transition"
          >
            <span>Stoffe</span>
            {materialsOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {materialsOpen && (
            <div className="space-y-1.5">
              {(Object.keys(MATERIAL_SPECS) as MaterialType[]).map((matKey) => {
                const spec = MATERIAL_SPECS[matKey];
                return (
                  <div
                    key={matKey}
                    onPointerDown={startDragItem('material', spec.label, matKey)}
                    className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/70 cursor-grab active:cursor-grabbing select-none touch-none transition hover:border-sky-400/60"
                  >
                    <ComponentIllustration kind="material" materialType={matKey} />
                    <span className="text-[10px] font-medium text-slate-200 text-center leading-tight">
                      {spec.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Floating ghost preview while dragging from sidebar before entering the 3D table */}
      {pendingSpawn && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 px-3 py-2 rounded-2xl bg-slate-900/95 border-2 border-sky-400 shadow-2xl flex flex-col items-center gap-1"
          style={{ left: pendingSpawn.clientX, top: pendingSpawn.clientY }}
        >
          <ComponentIllustration
            kind={pendingSpawn.kind}
            materialType={pendingSpawn.materialType}
          />
          <span className="text-[11px] font-bold text-white">{pendingSpawn.label}</span>
        </div>
      )}
    </>
  );
}
