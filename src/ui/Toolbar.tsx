import {
  Activity,
  AlertTriangle,
  Cable,
  Camera,
  ChevronDown,
  Cpu,
  Eye,
  Gauge,
  Lightbulb,
  LightbulbOff,
  Repeat,
  RotateCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { MATERIAL_SPECS } from '../simulation/types';
import { CIRCUIT_PRESETS } from '../store/presets';
import {
  WIRE_COLORS,
  getAttachedWireEnds,
  useCircuitStore,
} from '../store/useCircuitStore';

export function Toolbar() {
  const [showPresets, setShowPresets] = useState(false);

  const components = useCircuitStore((s) => s.components);
  const wires = useCircuitStore((s) => s.wires);
  const simulation = useCircuitStore((s) => s.simulation);
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId);
  const selectedWireId = useCircuitStore((s) => s.selectedWireId);
  const focusedTerminal = useCircuitStore((s) => s.focusedTerminal);
  const connectingFrom = useCircuitStore((s) => s.connectingFrom);
  const wireMode = useCircuitStore((s) => s.wireMode);
  const dragState = useCircuitStore((s) => s.dragState);

  const showCurrentFlow = useCircuitStore((s) => s.showCurrentFlow);
  const showSchematic = useCircuitStore((s) => s.showSchematic);
  const showMeasurements = useCircuitStore((s) => s.showMeasurements);

  const toggleWireMode = useCircuitStore((s) => s.toggleWireMode);
  const rotateComponent = useCircuitStore((s) => s.rotateComponent);
  const deleteComponent = useCircuitStore((s) => s.deleteComponent);
  const toggleSwitch = useCircuitStore((s) => s.toggleSwitch);
  const toggleBulbScrewed = useCircuitStore((s) => s.toggleBulbScrewed);
  const deleteWire = useCircuitStore((s) => s.deleteWire);
  const setWireColor = useCircuitStore((s) => s.setWireColor);
  const selectOrCycleWireAtTerminal = useCircuitStore((s) => s.selectOrCycleWireAtTerminal);
  const clearSelection = useCircuitStore((s) => s.clearSelection);

  const toggleCurrentFlow = useCircuitStore((s) => s.toggleCurrentFlow);
  const toggleSchematic = useCircuitStore((s) => s.toggleSchematic);
  const toggleMeasurements = useCircuitStore((s) => s.toggleMeasurements);
  const requestCameraPreset = useCircuitStore((s) => s.requestCameraPreset);
  const loadPreset = useCircuitStore((s) => s.loadPreset);

  const selectedComp = components.find((c) => c.id === selectedComponentId) ?? null;
  const selectedWire = wires.find((w) => w.id === selectedWireId) ?? null;

  const attachedAtFocused = focusedTerminal
    ? getAttachedWireEnds(wires, focusedTerminal)
    : [];
  const focusedWireIdx = attachedAtFocused.findIndex(
    (a) => a.wire.id === selectedWireId
  );

  const getCompTitle = () => {
    if (!selectedComp) return '';
    if (selectedComp.kind === 'battery') return '4,5V Batterie';
    if (selectedComp.kind === 'bulb') return 'Lämpchen';
    if (selectedComp.kind === 'switch') return 'Schalter';
    if (selectedComp.kind === 'material' && selectedComp.materialType) {
      return MATERIAL_SPECS[selectedComp.materialType].label;
    }
    return 'Bauteil';
  };

  return (
    <>
      {/* TOP NAVIGATION & DIDACTIC BAR */}
      <header className="fixed top-0 left-0 right-0 z-30 flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-slate-900/88 backdrop-blur-md border-b border-slate-700/70 text-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm tracking-tight hidden sm:inline">
              Stromkreis-Labor 3D
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowPresets((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-xs sm:text-sm font-medium transition"
            >
              <span>Experimente</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {showPresets && (
              <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50">
                {CIRCUIT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      loadPreset(preset.id);
                      setShowPresets(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 transition"
                  >
                    <div className="text-sm font-semibold text-white">{preset.name}</div>
                    <div className="text-[11px] text-slate-400">{preset.subtitle}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Didactic toggles & Camera presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={toggleCurrentFlow}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 ${
              showCurrentFlow
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="Stromfluss-Animation"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden md:inline">Stromfluss</span>
          </button>

          <button
            onClick={toggleSchematic}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 ${
              showSchematic
                ? 'bg-sky-500 text-slate-950 border-sky-400'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="Schaltplan anzeigen"
          >
            <Cpu className="w-4 h-4" />
            <span className="hidden md:inline">Schaltplan</span>
          </button>

          <button
            onClick={toggleMeasurements}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 ${
              showMeasurements
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="Messwerte (V / A)"
          >
            <Gauge className="w-4 h-4" />
            <span className="hidden md:inline">Messwerte</span>
          </button>

          <div className="w-px h-5 bg-slate-700 mx-0.5 hidden sm:block" />

          <button
            onClick={() => requestCameraPreset('default')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 transition active:scale-95"
            title="3D-Ansicht"
          >
            <Camera className="w-4 h-4 text-slate-300" />
            <span className="hidden lg:inline">3D</span>
          </button>

          <button
            onClick={() => requestCameraPreset('top')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 transition active:scale-95"
            title="Von oben"
          >
            <Eye className="w-4 h-4 text-slate-300" />
            <span className="hidden lg:inline">Oben</span>
          </button>
        </div>
      </header>

      {/* SHORT CIRCUIT EDUCATIONAL WARNING BANNER */}
      {simulation.hasShortCircuit && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 max-w-md w-[80%] px-4 py-2.5 rounded-2xl bg-red-600/95 text-white shadow-2xl border border-red-400 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div className="text-xs sm:text-sm leading-snug">
            <span className="font-bold">Kurzschluss!</span> Der Strom fliesst direkt von Pol zu Pol ohne Verbraucher – Batterie und Kabel werden heiss.
          </div>
        </div>
      )}

      {/* WIRE DRAG STATUS PILL */}
      {!simulation.hasShortCircuit && dragState.type === 'wireEnd' && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold shadow-xl transition ${
            dragState.hoveredTerminal
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-slate-800/95 text-slate-200 border border-slate-600'
          }`}
        >
          {dragState.hoveredTerminal
            ? 'Loslassen zum Anklemmen'
            : 'Auf Kontakt ziehen · Ins Leere loslassen zum Entfernen'}
        </div>
      )}

      {/* WIRE MODE STATUS PILL */}
      {!simulation.hasShortCircuit && dragState.type !== 'wireEnd' && (wireMode || connectingFrom) && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-sky-500 text-slate-950 text-xs sm:text-sm font-semibold shadow-xl flex items-center gap-2">
          <Cable className="w-4 h-4" />
          <span>
            {connectingFrom
              ? 'Zweiten Kontakt antippen zum Verbinden'
              : 'Kabel-Modus: Von Kontakt zu Kontakt ziehen'}
          </span>
          <button
            onClick={() => {
              if (wireMode) toggleWireMode();
              clearSelection();
            }}
            className="ml-1 px-2 py-0.5 rounded-full bg-slate-950/20 hover:bg-slate-950/30 text-xs"
          >
            Fertig
          </button>
        </div>
      )}

      {/* PERSISTENT BOTTOM ACTION BAR FOR SELECTED COMPONENT OR WIRE */}
      {(selectedComp || selectedWire) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900/94 backdrop-blur-md border border-slate-700 shadow-2xl text-slate-100">
          {selectedComp && (
            <>
              <span className="text-xs font-bold text-sky-300 pr-1.5 border-r border-slate-700 hidden sm:inline">
                {getCompTitle()}
              </span>

              {selectedComp.kind === 'switch' && (
                <button
                  onClick={() => toggleSwitch(selectedComp.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95 ${
                    selectedComp.isClosed
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  {selectedComp.isClosed ? (
                    <ToggleRight className="w-4 h-4" />
                  ) : (
                    <ToggleLeft className="w-4 h-4" />
                  )}
                  <span>{selectedComp.isClosed ? 'Öffnen' : 'Schliessen'}</span>
                </button>
              )}

              {selectedComp.kind === 'bulb' && (
                <button
                  onClick={() => toggleBulbScrewed(selectedComp.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95 ${
                    selectedComp.isScrewedIn !== false
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  }`}
                >
                  {selectedComp.isScrewedIn !== false ? (
                    <>
                      <LightbulbOff className="w-4 h-4" />
                      <span>Herausschrauben</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4" />
                      <span>Einschrauben</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => rotateComponent(selectedComp.id, Math.PI / 4)}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold transition"
                title="Um 45° drehen"
              >
                <RotateCw className="w-4 h-4" />
                <span className="hidden sm:inline">Drehen</span>
              </button>

              <button
                onClick={() => deleteComponent(selectedComp.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600/25 hover:bg-red-600 text-red-300 hover:text-white active:scale-95 text-xs font-semibold transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Löschen</span>
              </button>
            </>
          )}

          {selectedWire && (
            <>
              <span className="text-xs font-bold text-sky-300 pr-1.5 border-r border-slate-700">
                {attachedAtFocused.length > 1
                  ? `Kabel ${focusedWireIdx + 1}/${attachedAtFocused.length}`
                  : 'Kabel'}
              </span>

              {attachedAtFocused.length > 1 && focusedTerminal && (
                <button
                  onClick={() => selectOrCycleWireAtTerminal(focusedTerminal, 1)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 text-xs font-semibold transition active:scale-95"
                  title="Nächstes Kabel an diesem Kontakt wählen (auch per Mausrad)"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Wechseln</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 px-1">
                {WIRE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setWireColor(selectedWire.id, c.hex)}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      selectedWire.color === c.hex ? 'border-white scale-110' : 'border-slate-600'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>

              <button
                onClick={() => deleteWire(selectedWire.id)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-600/25 hover:bg-red-600 text-red-300 hover:text-white active:scale-95 text-xs font-semibold transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Entfernen</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
