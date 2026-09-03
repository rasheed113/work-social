import {
  GIB,
  classifyRam,
  evaluateLocalModel,
  type DeviceCapability,
} from './deviceCapability';
import { getBrowserDeviceCapability, normalizeArchitecture } from './deviceCapabilityEngine';

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

function browserNavigator(overrides: Record<string, unknown> = {}): Navigator {
  return {
    deviceMemory: 4,
    hardwareConcurrency: 8,
    platform: 'Linux armv8l',
    storage: { estimate: async () => ({ quota: 5 * GIB, usage: 1 * GIB }) },
    ...overrides,
  } as unknown as Navigator;
}

async function browserCapabilityTests(): Promise<void> {
  const capable = await getBrowserDeviceCapability(browserNavigator());
  assertEqual(capable.platform, 'web', 'browser execution must be classified as web');
  assertEqual(capable.totalRam, 4 * GIB, 'navigator.deviceMemory should provide approximate RAM');
  assertEqual(capable.tier, 'STANDARD', '4 GiB browser RAM should be STANDARD');
  assertEqual(capable.cpuCores, 8, 'navigator.hardwareConcurrency should provide CPU cores');
  assertEqual(capable.architecture, 'arm64-v8a', 'explicit navigator.platform architecture should be normalized');
  assertEqual(capable.availableStorage, 4 * GIB, 'browser storage estimate should calculate quota minus usage');
  assert(capable.supported, 'WebAssembly-capable browser should be supported');

  const noDeviceMemory = await getBrowserDeviceCapability(browserNavigator({ deviceMemory: undefined, platform: 'Linux armv81' }));
  assertEqual(noDeviceMemory.totalRam, null, 'missing deviceMemory must remain unknown');
  assertEqual(noDeviceMemory.tier, 'UNKNOWN', 'missing deviceMemory must produce UNKNOWN tier');
  assert(noDeviceMemory.limitations.some((item) => item.includes('deviceMemory is unavailable')), 'missing deviceMemory must be explicit');
  assertEqual(noDeviceMemory.architecture, null, 'reduced Android platform must not fabricate a physical ABI');

  const noCpu = await getBrowserDeviceCapability(browserNavigator({ hardwareConcurrency: undefined }));
  assertEqual(noCpu.cpuCores, null, 'missing hardwareConcurrency must remain unknown');
  assert(noCpu.limitations.some((item) => item.includes('hardwareConcurrency is unavailable')), 'missing CPU signal must be explicit');
}

assertEqual(classifyRam(2 * GIB), 'LOW', '2 GiB RAM should be LOW');
assertEqual(classifyRam(3 * GIB), 'BASIC', '3 GiB RAM should be BASIC');
assertEqual(classifyRam(4 * GIB), 'STANDARD', '4 GiB RAM should be STANDARD');
assertEqual(classifyRam(6 * GIB), 'HIGH', '6 GiB RAM should be HIGH');
assertEqual(classifyRam(8 * GIB), 'HIGH', '8 GiB RAM should be HIGH');
assertEqual(classifyRam(null), 'UNKNOWN', 'unknown RAM should be UNKNOWN');

assertEqual(normalizeArchitecture('aarch64'), 'arm64-v8a', 'aarch64 should normalize to arm64-v8a');
assertEqual(normalizeArchitecture('Linux armv8l'), 'arm64-v8a', 'explicit Linux armv8l should normalize to arm64-v8a');
assertEqual(normalizeArchitecture('Linux x86_64'), 'x86_64', 'explicit Linux x86_64 should normalize to x86_64');
assertEqual(normalizeArchitecture('Linux armv81'), null, 'reduced Android armv81 must not be treated as a physical ABI');
assertEqual(normalizeArchitecture('Win32'), null, 'Win32 must not be guessed as x86_64');
assertEqual(normalizeArchitecture(undefined), null, 'missing architecture must remain unknown');

const unknownStorage = evaluateLocalModel(capability({ availableStorage: null }), {
  minimumFreeStorage: 2.5 * GIB,
});
assert(!unknownStorage.eligible, 'unknown storage must block a storage-gated model');
assert(unknownStorage.reasons.some((reason) => reason.includes('storage is unknown')), 'unknown storage should explain the conservative rejection');

const insufficientStorage = evaluateLocalModel(capability({ availableStorage: 2 * GIB }), {
  minimumFreeStorage: 2.5 * GIB,
});
assert(!insufficientStorage.eligible, 'insufficient storage must block model eligibility');

const unknownCpu = evaluateLocalModel(capability({ cpuCores: null, architecture: null }), {
  supportedArchitectures: ['arm64-v8a'],
});
assert(!unknownCpu.eligible, 'unknown native CPU architecture must be conservative');
assert(unknownCpu.reasons.some((reason) => reason.includes('architecture is unknown')), 'unknown native architecture should be reported');

const unsupportedArchitecture = evaluateLocalModel(capability({ architecture: 'x86_64' }), {
  supportedArchitectures: ['arm64-v8a'],
});
assert(!unsupportedArchitecture.eligible, 'unsupported native architecture must block eligibility');

const webUnknownArchitecture = evaluateLocalModel(capability({ platform: 'web', architecture: null }), {
  minimumTotalRam: 2 * GIB,
  minimumFreeStorage: 700 * 1024 ** 2,
  supportedArchitectures: ['arm64-v8a', 'x86_64'],
  requiredPlatform: 'any',
});
assert(webUnknownArchitecture.eligible, 'browser WASM eligibility must not require a host ABI');
assert(webUnknownArchitecture.limitations.some((limitation) => limitation.includes('Host CPU architecture')), 'browser ABI bypass should remain explicit in capability limitations');

const webUnknownRam = evaluateLocalModel(capability({ platform: 'web', totalRam: null, tier: 'UNKNOWN', architecture: null }), {
  minimumTotalRam: 2 * GIB,
  supportedArchitectures: ['arm64-v8a'],
  requiredPlatform: 'any',
});
assert(!webUnknownRam.eligible, 'missing browser RAM must remain conservatively ineligible');
assert(webUnknownRam.reasons.some((reason) => reason.includes('RAM is unknown')), 'missing browser RAM must remain visible');

const optionalSignals = capability({ thermalState: 'unknown', batteryLevel: null, isCharging: null });
assertEqual(optionalSignals.thermalState, 'unknown', 'thermal state must remain unknown');
assertEqual(optionalSignals.batteryLevel, null, 'battery level must remain unknown');
assertEqual(optionalSignals.isCharging, null, 'charging state must remain unknown');

const webRuntime = evaluateLocalModel(capability({ platform: 'web', supported: false }), {
  requiredPlatform: 'android',
});
assert(!webRuntime.eligible, 'web runtime must not qualify as an Android local AI runtime');

browserCapabilityTests().catch((error: unknown) => { console.error(error); throw error; });
