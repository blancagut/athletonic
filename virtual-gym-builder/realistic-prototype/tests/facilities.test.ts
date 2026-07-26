import assert from 'node:assert/strict'
import test from 'node:test'
import { EQUIPMENT } from '../src/catalog/equipment.ts'
import { snapWallPadToMount, wallMountSide } from '../src/interaction/facilities.ts'

const room = { roomWidth: 12, roomDepth: 12, padWidth: 2.4, padDepth: 0.12 }

test('preserves the fixed planning dimensions for Facilities equipment', () => {
  assert.deepEqual(EQUIPMENT.bench.dimensions, [1.5, 0.48, 0.48])
  assert.deepEqual(EQUIPMENT['wall-pads'].dimensions, [2.4, 0.12, 1.8])
  assert.deepEqual(EQUIPMENT['equipment-rack'].dimensions, [1.8, 0.55, 1.9])
  assert.deepEqual(EQUIPMENT['reception-counter'].dimensions, [2.4, 0.75, 1.15])
  assert.deepEqual(EQUIPMENT['wrestling-circle'].dimensions, [10, 10, 0.01])
})

test('aligns wall pads with the interior face of every wall', () => {
  const cases = [
    { input: { x: 1, z: -5.7, rotation: 0 }, side: 'north', expected: { x: 1, z: -5.85, rotation: 0 } },
    { input: { x: 5.7, z: 1, rotation: -Math.PI / 2 }, side: 'east', expected: { x: 5.85, z: 1, rotation: -1.570796 } },
    { input: { x: -1, z: 5.7, rotation: Math.PI }, side: 'south', expected: { x: -1, z: 5.85, rotation: -3.141593 } },
    { input: { x: -5.7, z: -1, rotation: Math.PI / 2 }, side: 'west', expected: { x: -5.85, z: -1, rotation: 1.570796 } },
  ] as const

  for (const scenario of cases) {
    const snapped = snapWallPadToMount(scenario.input, room)
    assert.deepEqual(snapped, scenario.expected)
    assert.equal(wallMountSide(snapped, room), scenario.side)
  }
})

test('does not invent a mount for a free-standing or misaligned pad', () => {
  const freeStanding = { x: 0, z: 0, rotation: 0.3 }
  assert.deepEqual(snapWallPadToMount(freeStanding, room), freeStanding)
  assert.equal(wallMountSide(freeStanding, room), null)
})

test('rejects a pad that would extend beyond the end of a wall', () => {
  const outsideSpan = { x: 5.2, z: -5.85, rotation: 0 }
  assert.equal(wallMountSide(outsideSpan, room), null)
})
