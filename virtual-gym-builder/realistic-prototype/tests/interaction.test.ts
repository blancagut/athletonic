import assert from 'node:assert/strict'
import test from 'node:test'
import {
  constrainTransform,
  exceededDragThreshold,
  normalizeAngle,
  serializeTransform,
  transitionInteraction,
} from '../src/interaction/interaction.ts'

test('requires a deliberate drag threshold for mouse and touch', () => {
  assert.equal(exceededDragThreshold(0, 0, 2, 2, 'mouse'), false)
  assert.equal(exceededDragThreshold(0, 0, 6, 0, 'mouse'), true)
  assert.equal(exceededDragThreshold(0, 0, 9, 0, 'touch'), false)
  assert.equal(exceededDragThreshold(0, 0, 10, 0, 'touch'), true)
})

test('keeps object and camera gestures mutually exclusive', () => {
  const selected = transitionInteraction({ mode: 'idle' }, { type: 'select', objectId: 'ring' })
  const pending = transitionInteraction(selected, { type: 'pointer-down', objectId: 'ring', pointerId: 4 })
  assert.deepEqual(pending, { mode: 'pending-drag', objectId: 'ring', pointerId: 4 })
  const dragging = transitionInteraction(pending, { type: 'drag-threshold', pointerId: 4 })
  assert.deepEqual(transitionInteraction(dragging, { type: 'camera-start', pointerId: 5 }), dragging)
  assert.deepEqual(transitionInteraction(dragging, { type: 'cancel' }), { mode: 'selected', objectId: 'ring' })
})

test('always exits rotation on completion or cancellation', () => {
  const rotating = transitionInteraction(
    { mode: 'selected', objectId: 'ring' },
    { type: 'rotate-start', objectId: 'ring', pointerId: 7 },
  )
  assert.deepEqual(rotating, { mode: 'rotating', objectId: 'ring', pointerId: 7 })
  assert.deepEqual(transitionInteraction(rotating, { type: 'complete' }), { mode: 'selected', objectId: 'ring' })
  assert.deepEqual(transitionInteraction(rotating, { type: 'cancel' }), { mode: 'selected', objectId: 'ring' })
})

test('normalizes rotation and clamps the complete rotated footprint', () => {
  const constrained = constrainTransform(
    { x: 8, z: -8, rotation: Math.PI / 2 },
    {
      roomWidth: 10,
      roomDepth: 8,
      objectWidth: 4,
      objectDepth: 2,
      wallMargin: 0.1,
      moveSnap: 0.25,
      rotationSnap: Math.PI / 12,
    },
  )
  assert.deepEqual(constrained.value, { x: 3.9, z: -1.9, rotation: 1.570796 })
  assert.equal(constrained.oversized, false)
  assert.equal(normalizeAngle(Math.PI * 3), -Math.PI)
})

test('centers an oversized footprint deterministically without deforming it', () => {
  const constrained = constrainTransform(
    { x: 2, z: 3, rotation: 0 },
    {
      roomWidth: 3,
      roomDepth: 3,
      objectWidth: 4,
      objectDepth: 5,
      wallMargin: 0.1,
      moveSnap: null,
      rotationSnap: null,
    },
  )
  assert.deepEqual(constrained.value, { x: 0, z: 0, rotation: 0 })
  assert.equal(constrained.oversized, true)
})

test('serializes transforms without floating point drift', () => {
  assert.deepEqual(serializeTransform({ x: 0.30000000000004, z: -0, rotation: Math.PI * 2 }), { x: 0.3, z: 0, rotation: 0 })
})