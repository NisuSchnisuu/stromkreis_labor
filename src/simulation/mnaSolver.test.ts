import { describe, expect, it } from 'vitest';
import { solveCircuit } from './mnaSolver';
import type { CircuitComponent, Wire } from './types';

function makeWire(
  id: string,
  aComp: string,
  aTerm: string,
  bComp: string,
  bTerm: string
): Wire {
  return {
    id,
    color: '#ef4444',
    endA: { attachedTo: { componentId: aComp, terminalId: aTerm }, freePosition: [0, 0, 0] },
    endB: { attachedTo: { componentId: bComp, terminalId: bTerm }, freePosition: [0, 0, 0] },
  };
}

describe('MNA DC Circuit Solver (NaTech 5|6 scenarios)', () => {
  it('1. Simple circuit: 1 battery + 1 bulb glows at normal brightness (~1.0)', () => {
    const comps: CircuitComponent[] = [
      { id: 'bat1', kind: 'battery', position: [0, 0, 0], rotationY: 0 },
      { id: 'bulb1', kind: 'bulb', position: [2, 0, 0], rotationY: 0, isScrewedIn: true },
    ];
    const wires: Wire[] = [
      makeWire('w1', 'bat1', 'pos', 'bulb1', 'a'),
      makeWire('w2', 'bulb1', 'b', 'bat1', 'neg'),
    ];

    const res = solveCircuit(comps, wires);
    expect(res.hasShortCircuit).toBe(false);
    expect(res.components.bulb1.brightness).toBeGreaterThan(0.9);
    expect(res.components.bulb1.brightness).toBeLessThan(1.1);
    expect(res.components.bulb1.current).toBeCloseTo(0.29, 2);
  });

  it('2. Series circuit (KM 55.1): 2 bulbs in series are clearly dimmer than 1 bulb', () => {
    const comps: CircuitComponent[] = [
      { id: 'bat1', kind: 'battery', position: [0, 0, 0], rotationY: 0 },
      { id: 'b1', kind: 'bulb', position: [1, 0, 0], rotationY: 0, isScrewedIn: true },
      { id: 'b2', kind: 'bulb', position: [2, 0, 0], rotationY: 0, isScrewedIn: true },
    ];
    const wires: Wire[] = [
      makeWire('w1', 'bat1', 'pos', 'b1', 'a'),
      makeWire('w2', 'b1', 'b', 'b2', 'a'),
      makeWire('w3', 'b2', 'b', 'bat1', 'neg'),
    ];

    const res = solveCircuit(comps, wires);
    expect(res.hasShortCircuit).toBe(false);
    expect(res.components.b1.brightness).toBeCloseTo(res.components.b2.brightness, 3);
    expect(res.components.b1.brightness).toBeGreaterThan(0.2);
    expect(res.components.b1.brightness).toBeLessThan(0.5);
  });

  it('3. Series circuit with unscrewed bulb (KM 54.1 Rätsel 1): both bulbs go dark', () => {
    const comps: CircuitComponent[] = [
      { id: 'bat1', kind: 'battery', position: [0, 0, 0], rotationY: 0 },
      { id: 'b1', kind: 'bulb', position: [1, 0, 0], rotationY: 0, isScrewedIn: false },
      { id: 'b2', kind: 'bulb', position: [2, 0, 0], rotationY: 0, isScrewedIn: true },
    ];
    const wires: Wire[] = [
      makeWire('w1', 'bat1', 'pos', 'b1', 'a'),
      makeWire('w2', 'b1', 'b', 'b2', 'a'),
      makeWire('w3', 'b2', 'b', 'bat1', 'neg'),
    ];

    const res = solveCircuit(comps, wires);
    expect(res.components.b1.brightness).toBe(0);
    expect(res.components.b2.brightness).toBe(0);
  });

  it('4. Parallel circuit (KM 54.1 Rätsel 2 & KM 55.1): both bulbs stay bright; unscrewing 1 leaves the other bright', () => {
    const comps: CircuitComponent[] = [
      { id: 'bat1', kind: 'battery', position: [0, 0, 0], rotationY: 0 },
      { id: 'b1', kind: 'bulb', position: [1, 0, 0], rotationY: 0, isScrewedIn: true },
      { id: 'b2', kind: 'bulb', position: [2, 0, 0], rotationY: 0, isScrewedIn: true },
    ];
    const wires: Wire[] = [
      makeWire('w1', 'bat1', 'pos', 'b1', 'a'),
      makeWire('w2', 'b1', 'b', 'bat1', 'neg'),
      makeWire('w3', 'bat1', 'pos', 'b2', 'a'),
      makeWire('w4', 'b2', 'b', 'bat1', 'neg'),
    ];

    const resBoth = solveCircuit(comps, wires);
    expect(resBoth.hasShortCircuit).toBe(false);
    expect(resBoth.components.b1.brightness).toBeGreaterThan(0.85);
    expect(resBoth.components.b2.brightness).toBeGreaterThan(0.85);

    // Unscrew b1
    comps[1].isScrewedIn = false;
    const resOne = solveCircuit(comps, wires);
    expect(resOne.components.b1.brightness).toBe(0);
    expect(resOne.components.b2.brightness).toBeGreaterThan(0.9);
  });

  it('5. Short circuit (KM 52.1 & KM 55.3 #4): wire bypassing bulb extinguishes bulb and flags short circuit', () => {
    const comps: CircuitComponent[] = [
      { id: 'bat1', kind: 'battery', position: [0, 0, 0], rotationY: 0 },
      { id: 'b1', kind: 'bulb', position: [1, 0, 0], rotationY: 0, isScrewedIn: true },
    ];
    const wires: Wire[] = [
      makeWire('w1', 'bat1', 'pos', 'b1', 'a'),
      makeWire('w2', 'b1', 'b', 'bat1', 'neg'),
      makeWire('wShort', 'b1', 'a', 'b1', 'b'), // direct bypass
    ];

    const res = solveCircuit(comps, wires);
    expect(res.hasShortCircuit).toBe(true);
    expect(res.shortedBatteryIds).toContain('bat1');
    expect(res.components.b1.brightness).toBe(0);
    expect(res.wires.wShort.isShorted).toBe(true);
  });

  it('6. Conductors vs. Insulators (KM 53.1 & 53.2)', () => {
    const makeTest = (materialType: CircuitComponent['materialType']) => {
      const comps: CircuitComponent[] = [
        { id: 'bat1', kind: 'battery', position: [0, 0, 0], rotationY: 0 },
        { id: 'b1', kind: 'bulb', position: [1, 0, 0], rotationY: 0, isScrewedIn: true },
        { id: 'm1', kind: 'material', position: [2, 0, 0], rotationY: 0, materialType },
      ];
      const wires: Wire[] = [
        makeWire('w1', 'bat1', 'pos', 'b1', 'a'),
        makeWire('w2', 'b1', 'b', 'm1', 'a'),
        makeWire('w3', 'm1', 'b', 'bat1', 'neg'),
      ];
      return solveCircuit(comps, wires);
    };

    expect(makeTest('paperclip').components.b1.brightness).toBeGreaterThan(0.9);
    expect(makeTest('eraser').components.b1.brightness).toBe(0);
    expect(makeTest('saltwater').components.b1.brightness).toBeGreaterThan(0.1);
    expect(makeTest('saltwater').components.b1.brightness).toBeLessThan(0.5);
  });
});
