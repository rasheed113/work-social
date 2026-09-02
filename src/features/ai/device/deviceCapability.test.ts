import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  GIB,
  classifyRam,
  evaluateLocalModel,
  type DeviceCapability,
} from './deviceCapability';

const capability = (overrides: Partial<DeviceCapability> = {}): DeviceCapability => ({
  supported: true,
  tier: 'STANDARD',
  availableRam: 5 * GIB,
  totalRam: 6 * GIB,
  cpuCores: 8,
  architecture: 'arm64-v8a',
  androidVersion: 'unknown',
  availableStorage: 5 * GIB,
  thermalState: 'unknown',
  batteryLevel: null,
  isCharging: null,
  reason: null,
  limitations: [],
  platform: 'android',
  ...overrides,
});

test('RAM tiers use conservative boundaries', () => {
  assert.equal(classifyRam(2 * GIB), 'LOW');
  assert.equal(classifyRam(3 * GIB), 'BASIC');
  assert.equal(classifyRam(4 * GIB), 'STANDARD');
  assert.equal(classifyRam(6 * GIB), 'HIGH');
  assert.equal(classifyRam(8 * GIB), 'HIGH');
  assert.equal(classifyRam(null), 'UNKNOWN');
});

test('unknown storage blocks a model with a storage requirement', () => {
  const result = evaluateLocalModel(capability({ availableStorage: null }), {
    minimumFreeStorage: 2.5 * GIB,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some((reason) => reason.includes('storage is unknown')));
});

test('insufficient storage blocks model eligibility', () => {
  const result = evaluateLocalModel(capability({ availableStorage: 2 * GIB }), {
    minimumFreeStorage: 2.5 * GIB,
  });
  assert.equal(result.eligible, false);
});

test('unknown CPU information is conservative when architecture is required', () => {
  const result = evaluateLocalModel(capability({ cpuCores: null, architecture: null }), {
    supportedArchitectures: ['arm64-v8a'],
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some((reason) => reason.includes('architecture is unknown')));
});

test('unsupported architecture blocks model eligibility', () => {
  const result = evaluateLocalModel(capability({ architecture: 'x86_64' }), {
    supportedArchitectures: ['arm64-v8a'],
  });
  assert.equal(result.eligible, false);
});

test('optional thermal and battery unknown values remain conservative but do not invent data', () => {
  const device = capability({ thermalState: 'unknown', batteryLevel: null, isCharging: null });
  assert.equal(device.thermalState, 'unknown');
  assert.equal(device.batteryLevel, null);
  assert.equal(device.isCharging, null);
});

test('Android is required for the future local model path', () => {
  const result = evaluateLocalModel(capability({ platform: 'web', supported: false }), {
    requiredPlatform: 'android',
  });
  assert.equal(result.eligible, false);
});
