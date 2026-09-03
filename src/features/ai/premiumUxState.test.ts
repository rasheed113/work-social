import { buildAiPremiumStatus, friendlyAiError } from './premiumUxState';

function expect(condition: boolean, message: string): void { if (!condition) throw new Error(message); }

const autoOnline = buildAiPremiumStatus({ requestedMode: 'auto', provider: 'gemini', routeMode: 'online', reasonCode: 'AUTO_ONLINE_SELECTED', localAvailable: false });
expect(autoOnline.modeLabel === 'AUTO', 'AUTO mode must be displayed as AUTO.');
expect(autoOnline.providerLabel === 'Gemini', 'Gemini must be displayed when AUTO routes online.');
expect(autoOnline.routeLabel === 'Online', 'AUTO online route must be displayed as Online.');
expect(autoOnline.detail.includes('Local AI unavailable'), 'AUTO must explain that local AI is unavailable.');

const offlineUnavailable = buildAiPremiumStatus({ requestedMode: 'offline', provider: null, routeMode: null, reasonCode: 'OFFLINE_TEXT_AI_UNAVAILABLE', localAvailable: false });
expect(offlineUnavailable.modeLabel === 'OFFLINE', 'OFFLINE mode must be displayed as OFFLINE.');
expect(offlineUnavailable.localLabel.includes('Unavailable'), 'Local unavailable state must remain honest.');
expect(offlineUnavailable.processingLabel === 'Not sent online', 'Explicit offline failure must say the request was not sent online.');
expect(offlineUnavailable.modelLabel !== 'Local Model · Ready', 'Unavailable local model must never be shown as ready.');

const online = buildAiPremiumStatus({ requestedMode: 'online', provider: 'gemini', routeMode: 'online', reasonCode: 'ONLINE_EXPLICIT', localAvailable: false });
expect(online.providerLabel === 'Gemini', 'ONLINE must display Gemini.');
expect(online.processingLabel === 'Processed online', 'ONLINE processing must be labeled online.');

const offlineError = friendlyAiError({ code: 'OFFLINE_TEXT_AI_UNAVAILABLE' }, 'offline');
expect(offlineError.includes('not sent online'), 'Offline error must explicitly prevent an online fallback.');

const visionUnavailable = buildAiPremiumStatus({ requestedMode: 'auto', provider: 'gemini', routeMode: 'online', reasonCode: 'VISION_RUNTIME_UNAVAILABLE', localAvailable: false });
expect(visionUnavailable.visionLabel.includes('Unavailable'), 'Vision runtime unavailability must be visible.');

console.log('premium UX state tests passed');
