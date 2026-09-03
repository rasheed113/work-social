import type { DeviceCapability } from '../device/deviceCapability';
import { classifyRam } from '../device/deviceCapability';

type BrowserNavigator = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
  };
};

type BatteryManager = EventTarget & { level: number; charging: boolean };
type NavigatorWithGpu = Navigator & { gpu?: unknown };

/**
 * Browser capability engine for the real WASM local inference boundary.
 * WASM is the mandatory execution capability; WebGPU is an optional accelerator
 * selected by wllama when available. Native-only signals remain unknown.
 */
export async function getDeviceCapability(): Promise<DeviceCapability> {
  if (typeof navigator === 'undefined') return unknownCapability('Device runtime is unavailable.');
  return getBrowserDeviceCapability(navigator as BrowserNavigator);
}

/**
 * Purely browser-facing capability detection used by the runtime and focused tests.
 * Browser APIs are feature-detected; missing hardware facts remain unknown.
 */
export async function getBrowserDeviceCapability(browserNavigator: BrowserNavigator): Promise<DeviceCapability> {
  const limitations: string[] = [
    'Browser memory information is approximate and does not expose free device RAM.',
    'Browser storage is origin quota, not physical device free space.',
  ];
  const wasmAvailable = typeof WebAssembly !== 'undefined';
  const webGpuAvailable = 'gpu' in (browserNavigator as NavigatorWithGpu);
  if (webGpuAvailable) limitations.push('WebGPU availability was detected; the local engine may use it as an accelerator.');
  else limitations.push('WebGPU is unavailable; the local engine will use WebAssembly CPU execution.');

  const totalRam = typeof browserNavigator.deviceMemory === 'number' && Number.isFinite(browserNavigator.deviceMemory) && browserNavigator.deviceMemory > 0
    ? browserNavigator.deviceMemory * 1024 ** 3 : null;
  if (totalRam === null) limitations.push('Browser deviceMemory is unavailable; RAM remains unknown and is not inferred from unrelated signals.');

  const cpuCores = typeof browserNavigator.hardwareConcurrency === 'number' && Number.isInteger(browserNavigator.hardwareConcurrency) && browserNavigator.hardwareConcurrency > 0
    ? browserNavigator.hardwareConcurrency : null;
  if (cpuCores === null) limitations.push('Browser hardwareConcurrency is unavailable; CPU core count remains unknown.');

  const architecture = await detectBrowserArchitecture(browserNavigator, limitations);

  let availableStorage: number | null = null;
  if (browserNavigator.storage?.estimate) {
    try {
      const estimate = await browserNavigator.storage.estimate();
      if (typeof estimate.quota === 'number' && typeof estimate.usage === 'number' && Number.isFinite(estimate.quota) && Number.isFinite(estimate.usage) && estimate.quota >= estimate.usage) {
        availableStorage = estimate.quota - estimate.usage;
      } else limitations.push('Browser storage estimate was incomplete.');
    } catch { limitations.push('Browser storage estimate failed.'); }
  } else limitations.push('Browser storage estimation is not available.');

  let batteryLevel: number | null = null;
  let isCharging: boolean | null = null;
  const getBattery = (browserNavigator as Navigator & { getBattery?: () => Promise<BatteryManager> }).getBattery;
  if (typeof getBattery === 'function') {
    try {
      const battery = await getBattery.call(browserNavigator);
      batteryLevel = Number.isFinite(battery.level) ? battery.level : null;
      isCharging = typeof battery.charging === 'boolean' ? battery.charging : null;
    } catch { limitations.push('Battery information could not be read.'); }
  }

  if (!wasmAvailable) return unknownCapability('WebAssembly is unavailable in this browser.');
  return {
    supported: true,
    tier: classifyRam(totalRam),
    availableRam: null,
    totalRam,
    cpuCores,
    architecture,
    androidVersion: null,
    availableStorage,
    thermalState: 'unknown',
    batteryLevel,
    isCharging,
    reason: null,
    limitations: [...new Set(limitations)],
    platform: 'web',
  };
}

async function detectBrowserArchitecture(browserNavigator: BrowserNavigator, limitations: string[]): Promise<string | null> {
  if (browserNavigator.userAgentData?.getHighEntropyValues) {
    try {
      const values = await browserNavigator.userAgentData.getHighEntropyValues(['architecture']);
      const normalized = normalizeArchitecture(values.architecture);
      if (normalized) return normalized;
    } catch { limitations.push('Browser architecture information was not available from User-Agent Client Hints.'); }
  }

  // navigator.platform is only used when it exposes an explicit CPU architecture.
  // Reduced Android values such as "Linux armv81" are deliberately not mapped to
  // arm64 because they identify a platform family, not the physical ABI.
  const normalizedPlatform = normalizeArchitecture(browserNavigator.platform);
  if (normalizedPlatform) return normalizedPlatform;
  limitations.push('Browser architecture information is not exposed by this runtime.');
  return null;
}

export function normalizeArchitecture(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/^(arm64-v8a|arm64|aarch64|armv8l)$/.test(normalized)) return 'arm64-v8a';
  if (/^(arm|armv7|armv7l|arm32)$/.test(normalized)) return 'arm';
  if (/^(x86_64|x86-64|amd64|x64)$/.test(normalized)) return 'x86_64';
  if (/^(x86|i[3-6]86)$/.test(normalized)) return 'x86';
  if (/linux\s+(arm64-v8a|arm64|aarch64|armv8l)\b/.test(normalized)) return 'arm64-v8a';
  if (/linux\s+(x86_64|x86-64|amd64|x64)\b/.test(normalized)) return 'x86_64';
  if (/linux\s+(armv7l|armv7)\b/.test(normalized)) return 'arm';
  if (/linux\s+(x86|i[3-6]86)\b/.test(normalized)) return 'x86';
  return null;
}

function unknownCapability(reason: string): DeviceCapability {
  return {
    supported: false,
    tier: 'UNKNOWN',
    availableRam: null,
    totalRam: null,
    cpuCores: null,
    architecture: null,
    androidVersion: null,
    availableStorage: null,
    thermalState: 'unknown',
    batteryLevel: null,
    isCharging: null,
    reason,
    limitations: [reason],
    platform: 'unknown',
  };
}
