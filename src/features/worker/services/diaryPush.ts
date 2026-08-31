import { saveWorkerDiaryPushSubscription } from '../api/diary';

export const DIARY_VAPID_PUBLIC_KEY = 'BOQVmOlZERK3UNbyn11QFWnA0LW3pVbBe9I45iKAp9WqBsCBCsHsDd3oThVhj9D_9blgjsNGmccx3KNeQRqSqPQ';

export type DiaryNotificationCapability = { supported: boolean; permission: NotificationPermission | 'unsupported'; reason: string };

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export function getDiaryNotificationCapability(): DiaryNotificationCapability {
  if (typeof window === 'undefined') return { supported: false, permission: 'unsupported', reason: 'Notifications are unavailable during server rendering.' };
  if (!window.isSecureContext) return { supported: false, permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission, reason: 'Reminders require a secure HTTPS context.' };
  if (!('serviceWorker' in navigator)) return { supported: false, permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission, reason: 'This browser does not support service workers.' };
  if (!('PushManager' in window)) return { supported: false, permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission, reason: 'This browser does not support push reminders.' };
  if (typeof Notification === 'undefined') return { supported: false, permission: 'unsupported', reason: 'System notifications are unavailable.' };
  return { supported: true, permission: Notification.permission, reason: '' };
}

export async function registerDiaryServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers are unsupported.');
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function getDiaryPushSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration('/') ?? await registerDiaryServiceWorker();
  return registration.pushManager.getSubscription();
}

export async function subscribeDiaryPush() {
  const capability = getDiaryNotificationCapability();
  if (!capability.supported) return { subscription: null, error: capability.reason };
  if (Notification.permission === 'denied') return { subscription: null, error: 'Notification permission was previously denied. Enable it in your browser/site settings first.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { subscription: null, error: permission === 'denied' ? 'Notification permission was denied.' : 'Notification permission was not granted.' };
  try {
    const registration = await registerDiaryServiceWorker();
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(DIARY_VAPID_PUBLIC_KEY) });
    return { subscription, error: null };
  } catch (error) {
    return { subscription: null, error: error instanceof Error ? error.message : 'Push subscription could not be created.' };
  }
}

export async function unsubscribeDiaryPush() {
  const subscription = await getDiaryPushSubscription();
  if (!subscription) return { error: null };
  try { await subscription.unsubscribe(); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : 'Push subscription could not be removed.' }; }
}

export async function syncCurrentDiaryPushSubscription() {
  const subscription = await getDiaryPushSubscription();
  if (!subscription) return { error: null };
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return { error: new Error('Push subscription payload is incomplete.') };
  return saveWorkerDiaryPushSubscription({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, expiration_time: json.expirationTime ? new Date(json.expirationTime).toISOString() : null });
}
