import type { CircuitComponent, Wire } from '../simulation/types';

export interface CircuitPreset {
  id: string;
  name: string;
  subtitle: string;
  components: CircuitComponent[];
  wires: Wire[];
}

export const CIRCUIT_PRESETS: CircuitPreset[] = [
  {
    id: 'simple',
    name: 'Einfacher Stromkreis',
    subtitle: 'Batterie, Schalter & Lämpchen',
    components: [
      { id: 'bat-1', kind: 'battery', position: [-2.4, 0, 0.2], rotationY: 0 },
      { id: 'sw-1', kind: 'switch', position: [0, 0, 1.5], rotationY: 0, isClosed: true },
      { id: 'bulb-1', kind: 'bulb', position: [2.2, 0, -0.3], rotationY: 0, isScrewedIn: true },
    ],
    wires: [
      {
        id: 'w-1',
        color: '#ef4444',
        endA: { attachedTo: { componentId: 'bat-1', terminalId: 'pos' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bulb-1', terminalId: 'a' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-2',
        color: '#2563eb',
        endA: { attachedTo: { componentId: 'bulb-1', terminalId: 'b' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'sw-1', terminalId: 'b' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-3',
        color: '#1e293b',
        endA: { attachedTo: { componentId: 'sw-1', terminalId: 'a' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bat-1', terminalId: 'neg' }, freePosition: [0, 0, 0] },
      },
    ],
  },
  {
    id: 'series',
    name: 'Serieschaltung',
    subtitle: 'KM 54.1 / 55.1 – 2 Lämpchen in Serie',
    components: [
      { id: 'bat-1', kind: 'battery', position: [-2.6, 0, 0.6], rotationY: 0 },
      { id: 'bulb-1', kind: 'bulb', position: [-0.2, 0, -1.2], rotationY: 0, isScrewedIn: true },
      { id: 'bulb-2', kind: 'bulb', position: [2.2, 0, -0.4], rotationY: 0, isScrewedIn: true },
      { id: 'sw-1', kind: 'switch', position: [0.6, 0, 1.6], rotationY: 0, isClosed: true },
    ],
    wires: [
      {
        id: 'w-1',
        color: '#ef4444',
        endA: { attachedTo: { componentId: 'bat-1', terminalId: 'pos' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bulb-1', terminalId: 'a' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-2',
        color: '#eab308',
        endA: { attachedTo: { componentId: 'bulb-1', terminalId: 'b' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bulb-2', terminalId: 'a' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-3',
        color: '#2563eb',
        endA: { attachedTo: { componentId: 'bulb-2', terminalId: 'b' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'sw-1', terminalId: 'b' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-4',
        color: '#1e293b',
        endA: { attachedTo: { componentId: 'sw-1', terminalId: 'a' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bat-1', terminalId: 'neg' }, freePosition: [0, 0, 0] },
      },
    ],
  },
  {
    id: 'parallel',
    name: 'Parallelschaltung',
    subtitle: 'KM 54.1 / 55.1 – 2 Lämpchen parallel',
    components: [
      { id: 'bat-1', kind: 'battery', position: [-2.8, 0, 0.2], rotationY: 0 },
      { id: 'bulb-1', kind: 'bulb', position: [0.4, 0, -1.2], rotationY: 0, isScrewedIn: true },
      { id: 'bulb-2', kind: 'bulb', position: [2.2, 0, 1.0], rotationY: 0, isScrewedIn: true },
    ],
    wires: [
      {
        id: 'w-1',
        color: '#ef4444',
        endA: { attachedTo: { componentId: 'bat-1', terminalId: 'pos' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bulb-1', terminalId: 'a' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-2',
        color: '#ef4444',
        endA: { attachedTo: { componentId: 'bulb-1', terminalId: 'a' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bulb-2', terminalId: 'a' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-3',
        color: '#2563eb',
        endA: { attachedTo: { componentId: 'bulb-1', terminalId: 'b' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bat-1', terminalId: 'neg' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-4',
        color: '#2563eb',
        endA: { attachedTo: { componentId: 'bulb-2', terminalId: 'b' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bulb-1', terminalId: 'b' }, freePosition: [0, 0, 0] },
      },
    ],
  },
  {
    id: 'conductors',
    name: 'Leiter oder Nichtleiter?',
    subtitle: 'KM 53.1 – Materialien testen',
    components: [
      { id: 'bat-1', kind: 'battery', position: [-2.8, 0, 0.4], rotationY: 0 },
      { id: 'bulb-1', kind: 'bulb', position: [-0.2, 0, 1.8], rotationY: 0, isScrewedIn: true },
      { id: 'mat-1', kind: 'material', position: [0.6, 0, -1.0], rotationY: 0, materialType: 'paperclip' },
      { id: 'mat-2', kind: 'material', position: [2.8, 0, -1.4], rotationY: 0.2, materialType: 'eraser' },
      { id: 'mat-3', kind: 'material', position: [2.9, 0, 0.2], rotationY: -0.15, materialType: 'copper' },
      { id: 'mat-4', kind: 'material', position: [2.8, 0, 1.7], rotationY: 0.1, materialType: 'glass' },
    ],
    wires: [
      {
        id: 'w-1',
        color: '#ef4444',
        endA: { attachedTo: { componentId: 'bat-1', terminalId: 'pos' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'mat-1', terminalId: 'a' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-2',
        color: '#2563eb',
        endA: { attachedTo: { componentId: 'mat-1', terminalId: 'b' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bulb-1', terminalId: 'b' }, freePosition: [0, 0, 0] },
      },
      {
        id: 'w-3',
        color: '#1e293b',
        endA: { attachedTo: { componentId: 'bulb-1', terminalId: 'a' }, freePosition: [0, 0, 0] },
        endB: { attachedTo: { componentId: 'bat-1', terminalId: 'neg' }, freePosition: [0, 0, 0] },
      },
    ],
  },
  {
    id: 'empty',
    name: 'Leerer Tisch',
    subtitle: 'Frei von Grund auf basteln',
    components: [],
    wires: [],
  },
];
