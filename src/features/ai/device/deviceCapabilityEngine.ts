import type { DeviceCapability, ThermalState } from './deviceCapability';
import { classifyRam } from './deviceCapability';

type NavigatorWithDeviceMemory = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
  };
};

type BatteryManager = EventTarget & {
  level: number;
  charging: boolean;
};

/**
 * Browser runtimes expose only a subset of the signals needed by the future
 * Android implementation. This engine reports those real signals and leaves
 * native-only fields unknown instead of inventing Android data.
 */
export async function getDeviceCapability(): Promise<DeviceCapability> {
  if (typeof navigator === 'undefined') {
    return unknownCapability('Device runtime is unavailable.');
  }

  const browserNavigator = navigator as NavigatorWithDeviceMemory;
  const limitations: string[] = [
    'No Android/native capability bridge is present in this web application.',
    'Browser memory information is approximate and does not expose free device RAM.',
  ];

  const totalRam =
    typeof browserNavigator.deviceMemory === 'number' &&
    Number.isFinite(browserNavigator.deviceMemory) &&
    browserNavigator.deviceMemory > 0
      ? browserNavigator.deviceMemory * 1024 ** 3
      : null;

  const cpuCores =
    typeof browserNavigator.hardwareConcurrency === 'number' &&
    Number.isInteger(browserNavigator.hardwareConcurrency) &&
    browserNavigator.hardwareConcurrency > 0
      ? browserNavigator.hardwareConcurrency
      : null;

  let architecture: string | null = null;
  if (browserNavigator.userAgentData?.getHighEntropyValues) {
    try {
      const values = await browserNavigator.userAgentData.getHighEntropyValues(['architecture']);
      architecture = typeof values.architecture === 'string' && values.architecture.length > 0
        ? values.architecture
        : null;
    } catch {
      limitations.push('Browser architecture information was not available.');
    }
  } else {
    limitations.push('Browser architecture information is not exposed by this runtime.');
  }

  let availableStorage: number | null = null;
  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (
        typeof estimate.quota === 'number' &&
        typeof estimate.usage === 'number' &&
        Number.isFinite(estimate.quota) &&
        Number.isFinite(estimate.usage) &&
        estimate.quota >= estimate.usage
      ) {
        // This is origin storage quota remaining, not total device free space.
        availableStorage = estimate.quota - estimate.usage;
        limitations.push('Storage is browser-origin quota, not Android device free space.');
      } else {
        limitations.push('Browser storage estimate was incomplete.');
      }
    } catch {
      limitations.push('Browser storage estimate failed.');
    }
  } else {
    limitations.push('Browser storage estimation is not available.');
  }

  let batteryLevel: number | null = null;
  let isCharging: boolean | null = null;
  const getBattery = (navigator as Navigator & {
    getBattery?: () => Promise<BatteryManager>;
  }).getBattery;

  if (typeof getBattery === 'function') {
    try {
      const battery = await getBattery.call(navigator);
      batteryLevel = Number.isFinite(battery.level) ? battery.level : null;
      isCharging = typeof battery.charging === 'boolean' ? battery.charging : null;
    } catch {
      limitations.push('Battery information could not be read.');
    }
  } else {
    limitations.push('Battery information is not exposed by this browser runtime.');
  }

  limitations.push('Android version and native thermal state require a future Android bridge.');

  return {
    supported: false,
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
    reason: 'Local AI execution is not available from the current web runtime; Android/native integration is required.',
    limitations: [...new Set(limitations)],
    platform: 'web',
  };
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
    thermalState: 'unknown' as ThermalState,
    batteryLevel: null,
    isCharging: null,
    reason,
    limitations: [reason],
    platform: 'unknown',
  };
}
