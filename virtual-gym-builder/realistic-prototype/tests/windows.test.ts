import assert from 'node:assert/strict'
import test from 'node:test'
import { constrainWallPosition, distributeWallWindows, normalizeWallPosition, restoreWallPosition } from '../src/scene/windowLayout.ts'

const door = (wallLength: number) => ({ center: -wallLength * 0.28, radius: 1.02 })

test('adapts commercial window panels to small, medium, and large rooms', () => {
  const small = distributeWallWindows(8, [door(8)])
  const medium = distributeWallWindows(14, [door(14)])
  const large = distributeWallWindows(24, [door(24)])

  assert.equal(small.length, 1)
  assert.ok(medium.length > small.length)
  assert.ok(large.length > medium.length)
  assert.ok(large.length <= 5)

  for (const window of [...small, ...medium, ...large]) {
    assert.ok(window.width >= 2.2)
    assert.ok(window.width <= 3.6)
  }
})

test('keeps every window clear of doors, columns, and wall corners', () => {
  const wallLength = 14
  const reserved = [door(wallLength), { center: 4.8, radius: 0.48 }]
  const windows = distributeWallWindows(wallLength, reserved)

  for (const window of windows) {
    const start = window.center - window.width / 2
    const end = window.center + window.width / 2
    assert.ok(start >= -wallLength / 2 + 0.65)
    assert.ok(end <= wallLength / 2 - 0.65)
    for (const span of reserved) {
      assert.ok(end <= span.center - span.radius || start >= span.center + span.radius)
    }
  }
})

test('persists wall positions proportionally when the room is resized', () => {
  const normalized = normalizeWallPosition(3.5, 14)
  assert.equal(normalized, 0.5)
  assert.equal(restoreWallPosition(normalized, 0, 24), 6)
  assert.equal(restoreWallPosition(undefined, -2.5, 24), -2.5)
})

test('constrains moved architecture to corners, snap, and occupied spans', () => {
  assert.equal(constrainWallPosition(20, 2.4, 14, [], 0.25), 5.15)
  assert.equal(constrainWallPosition(1.13, 1, 14, [], 0.25), 1.25)
  assert.equal(constrainWallPosition(0, 2.4, 14, [{ center: 0, radius: 1 }], 0.25), -2.2)
})