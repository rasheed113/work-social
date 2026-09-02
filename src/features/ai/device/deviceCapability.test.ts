import {
  GIB,
  classifyRam,
  evaluateLocalModel,
  type DeviceCapability,
} from './deviceCapability';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const capability = (overrides: Partial<DeviceCapability> = {}): DeviceCapability => ({
  supported: true,
  tier: 'STANDARD',
  availableRam: 5 * GIB,
  totalRam: 6 * GIB,
  cpuCores: 8,
  architecture: 'arm64-v8a',
  androidVersion: null,
  availableStorage: 5 * GIB,
  thermalState: 'unknown',
  batteryLevel: null,
  isCharging: null,
  reason: null,
  limitations: [],
  platform: 'android',
  ...overrides,
});

function runTests(): void {
  assertEqual(classifyRam(2 * GIB), 'LOW', '2 GiB RAM should be LOW');
  assertEqual(classifyRam(3 * GIB), 'BASIC', '3 GiB RAM should be BASIC');
  assertEqual(classifyRam(4 * GIB), 'STANDARD', '4 GiB RAM should be STANDARD');
  assertEqual(classifyRam(6 * GIB), 'HIGH', '6 GiB RAM should be HIGH');
  assertEqual(classifyRam(8 * GIB), 'HIGH', '8 GiB RAM should be HIGH');
  assertEqual(classifyRam(null), 'UNKNOWN', 'unknown RAM should be UNKNOWN');

  const unknownStorage = evaluateLocalModel(capability({ availableStorage: null }), {
    minimumFreeStorage: 2.5 * GIB,
  });
  assert(!unknownStorage.eligible, 'unknown storage must block a storage-gated model');
  assert(
    unknownStorage.reasons.some((reason) => reason.includes('storage is unknown')),
    'unknown storage should explain the conservative rejection',
  );

  const insufficientStorage = evaluateLocalModel(capability({ availableStorage: 2 * GIB }), {
    minimumFreeStorage: 2.5 * GIB,
  });
  assert(!insufficientStorage.eligible, 'insufficient storage must block model eligibility');

  const unknownCpu = evaluateLocalModel(capability({ cpuCores: null, architecture: null }), {
    supportedArchitectures: ['arm64-v8a'],
  });
  assert(!unknownCpu.eligible, 'unknown CPU architecture must be conservative');
  assert(
    unknownCpu.reasons.some((reason) => reason.includes('architecture is unknown')),
    'unknown architecture should be reported',
  );

  const unsupportedArchitecture = evaluateLocalModel(capability({ architecture: 'x86_64' }), {
    supportedArchitectures: ['arm64-v8a'],
  });
  assert(!unsupportedArchitecture.eligible, 'unsupported architecture must block eligibility');

  const optionalSignals = capability({ thermalState: 'unknown', batteryLevel: null, isCharging: null });
  assertEqual(optionalSignals.thermalState, 'unknown', 'thermal state must remain unknown');
  assertEqual(optionalSignals.batteryLevel, null, 'battery level must remain unknown');
  assertEqual(optionalSignals.isCharging, null, 'charging state must remain unknown');

  const webRuntime = evaluateLocalModel(capability({ platform: 'web', supported: false }), {
    requiredPlatform: 'android',
  });
  assert(!webRuntime.eligible, 'web runtime must not qualify as an Android local AI runtime');
}

runTests();
