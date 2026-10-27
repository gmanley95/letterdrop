/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  flightPose, landedCount, orderRefills, queueShift, refillDuration,
  REFILL_FLIGHT, REFILL_STAGGER, TRAY_R,
} from '../src/components/refillMotion';

test('refill motion starts at the original queue slot and lands exactly at the board slot', () => {
  const from = { x: 15, y: 22 };
  const to = { x: 240, y: 382, r: 17 };
  for (let k = 0; k < 10; k++) {
    const start = flightPose(k, 0, from, to);
    assert.equal(start.x, from.x);
    assert.equal(start.y, from.y);
    assert.equal(start.r, TRAY_R);
    const end = flightPose(k, refillDuration(10), from, to);
    assert.equal(end.x, to.x);
    assert.equal(end.y, to.y);
    assert.equal(end.r, to.r);
    assert.equal(end.scale, 1);
    assert.equal(end.rotation, 0);
  }
});

test('refills launch in original queue order and all flights settle before the turn commits', () => {
  const refills = [
    { pegIndex: 2, queueIndex: 1, letter: 'A' },
    { pegIndex: 8, queueIndex: 0, letter: 'O' },
  ];
  assert.deepEqual(orderRefills(refills).map((r) => r.letter), ['O', 'A']);
  assert.equal(refills[0].letter, 'A', 'sorting does not mutate refill metadata');
  assert.equal(landedCount(2, REFILL_FLIGHT - 1), 0);
  assert.equal(landedCount(2, REFILL_FLIGHT), 1);
  assert.equal(landedCount(2, REFILL_FLIGHT + REFILL_STAGGER), 2);
  for (let count = 1; count <= 10; count++) {
    assert.equal(landedCount(count, refillDuration(count)), count);
    assert.equal(queueShift(count, refillDuration(count)), 1);
  }
  assert.equal(refillDuration(0), 0);
});
