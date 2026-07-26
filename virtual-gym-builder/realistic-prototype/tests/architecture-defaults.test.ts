import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_ARCHITECTURE } from '../src/domain/architecture.ts'

test('keeps ceiling and LED lighting opt-in', () => {
  assert.equal(DEFAULT_ARCHITECTURE.ceiling, false)
  assert.equal(DEFAULT_ARCHITECTURE.ledLighting, false)
})