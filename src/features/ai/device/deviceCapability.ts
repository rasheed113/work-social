export type DeviceCapabilityTier = 'LOW' | 'BASIC' | 'STANDARD' | 'HIGH' | 'UNKNOWN';

export type ThermalState = 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';

/**
 * Platform-neutral facts and conservative capability classification.
 * Memory and storage values are bytes when present; null means the runtime
 * cannot safely provide that value.
 */
export interface DeviceCapability {
  supported: boolean;
  tier: DeviceCapabilityTier;
  availableRam: number | null;
  totalRam: number | null;
  cpuCores: number | null;
  architecture: string | null;
  androidVersion: string | null;
  availableStorage: number | null;
  thermalState: ThermalState;
  batteryLevel: number | null;
  isCharging: boolean | null;
  reason: string | null;
  limitations: string[];
  platform: 'android' | 'web' | 'unknown';
}

export interface LocalModelRequirements {
  minimumTotalRam?: number;
  minimumAvailableRam?: number;
  minimumFreeStorage?: number;
  supportedArchitectures?: string[];
  requiredPlatform?: 'android' | 'any';
}

export interface ModelEligibility {
  eligible: boolean;
  reasons: string[];
  limitations: string[];
}

const GB = 1024 ** 3;

/** Conservative planning tiers. A 4 GiB boundary is STANDARD by policy. */
export function classifyRam(totalRam: number | null): DeviceCapabilityTier {
  if (totalRam === null || !Number.isFinite(totalRam) || totalRam < 0) return 'UNKNOWN';
  if (totalRam < 3 * GB) return 'LOW';
  if (totalRam < 4 * GB) return 'BASIC';
  if (totalRam < 6 * GB) return 'STANDARD';
  return 'HIGH';
}

export function evaluateLocalModel(
  capability: DeviceCapability,
  requirements: LocalModelRequirements,
): ModelEligibility {
  const reasons: string[] = [];
  const limitations = [...capability.limitations];

  if (requirements.requiredPlatform === 'android' && capability.platform !== 'android') {
    reasons.push('An Android/native runtime is required for local model execution.');
  }

  if (!capability.supported) {
    reasons.push(capability.reason ?? 'The current runtime does not support local AI execution.');
  }

  if (capability.tier === 'UNKNOWN') {
    reasons.push('Total RAM is unknown; local model eligibility cannot be determined conservatively.');
  }

  if (requirements.minimumTotalRam !== undefined) {
    if (capability.totalRam === null) {
      reasons.push('Total RAM is unknown.');
    } else if (capability.totalRam < requirements.minimumTotalRam) {
      reasons.push('Total RAM is below the model requirement.');
    }
  }

  if (requirements.minimumAvailableRam !== undefined) {
    if (capability.availableRam === null) {
      reasons.push('Available RAM is unknown.');
    } else if (capability.availableRam < requirements.minimumAvailableRam) {
      reasons.push('Available RAM is below the model requirement.');
    }
  }

  if (requirements.minimumFreeStorage !== undefined) {
    if (capability.availableStorage === null) {
      reasons.push('Available storage is unknown.');
    } else if (capability.availableStorage < requirements.minimumFreeStorage) {
      reasons.push('Available storage is below the model requirement.');
    }
  }

  if (requirements.supportedArchitectures !== undefined) {
    if (capability.architecture === null) {
      reasons.push('CPU architecture is unknown.');
    } else if (!requirements.supportedArchitectures.includes(capability.architecture)) {
      reasons.push(`CPU architecture ${capability.architecture} is not supported by the model/runtime.`);
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    limitations: [...new Set(limitations)],
  };
}

export const PRIMARY_TEXT_MODEL_PLANNING_REQUIREMENTS: LocalModelRequirements = {
  minimumTotalRam: 4 * GB,
  minimumFreeStorage: 2.5 * GB,
  requiredPlatform: 'android',
};

export const GIB = GB;
