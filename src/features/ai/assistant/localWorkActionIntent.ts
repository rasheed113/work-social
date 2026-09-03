export interface LocalCreateWorkEntryIntent {
  readonly toolName: 'create_work_entry';
  readonly arguments: { readonly item_name: string; readonly size: string[] | null; readonly quantity: string; readonly rate: string; readonly special_note: string | null; readonly occurred_at_iso: string; };
}
export type LocalWorkActionDetection = { readonly kind: 'not_action' } | { readonly kind: 'missing'; readonly missing: 'item_name' | 'quantity' | 'rate'; readonly message: string } | { readonly kind: 'action'; readonly intent: LocalCreateWorkEntryIntent; readonly total: number };
const ACTION_PATTERN = /(?:\badd\b|\bcreate\b|\bnew\b|\bmake\b|\bbana(?:o|do)?\b|\bbna(?:o|do)?\b|\bdaal(?:o|do)?\b|\bentry\s+(?:bana|add|create)\b|\bentry\s+add\b|نئی|نیا|بنائیں|بناؤ|بناو)/iu;
const ENTRY_PATTERN = /(?:\b(?:work\s+entry|workentry|entry)\b|ورک\s*انٹری|کام\s*(?:کی\s*)?انٹری|انٹری)/iu;
const ITEM_MARKER = /(?:\bitem(?:\s+name)?\b|آئٹم(?:\s*کا\s*نام)?|چیز(?:\s*کا\s*نام)?)/iu;
const SIZE_MARKER = /(?:\b(?:size|siz)\b|سائز|سایز)/iu;
const RATE_MARKER = /(?:\b(?:rate|price|dar|daam)\b|ریٹ|قیمت|دام)/iu;
const QUANTITY_MARKER = /(?:\b(?:pieces?|pcs?|quantity|qty|count|numbers?|num)\b|پیس(?:ز)?|ٹکڑے|تعداد|مقدار)/iu;
const NOTE_MARKER = /(?:\b(?:special\s+note|note|remark|remarks?)\b|خصوصی\s*نوٹ|نوٹ|ریمارک)/iu;
const NEXT_MARKER = /(?:\b(?:item(?:\s+name)?|size|siz|rate|price|dar|daam|pieces?|pcs?|quantity|qty|count|numbers?|num|special\s+note|note|remark|remarks?)\b|آئٹم(?:\s*کا\s*نام)?|چیز(?:\s*کا\s*نام)?|سائز|سایز|ریٹ|قیمت|دام|پیس(?:ز)?|ٹکڑے|تعداد|مقدار|خصوصی\s*نوٹ|نوٹ|ریمارک)/iu;
function clean(value: string): string { return value.replace(/[,:;،؛]+/gu, ' ').replace(/\s+/gu, ' ').trim(); }
function segment(body: string, marker: RegExp): string | null { const match = marker.exec(body); if (!match) return null; const rest = body.slice(match.index + match[0].length); const next = NEXT_MARKER.exec(rest); return clean(next ? rest.slice(0, next.index) : rest) || null; }
function parseNumeric(value: string | null): string | null { if (!value) return null; const normalized = value.replace(/,/g, '').trim(); if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null; const number = Number(normalized); return Number.isFinite(number) && number > 0 ? normalized : null; }
function parseNumericPrefix(value: string | null): string | null { if (!value) return null; const match = value.trim().match(/^\d+(?:\.\d+)?(?=\s|$)/); return parseNumeric(match?.[0] ?? null); }
function parseQuantity(body: string): string | null { const afterMarker = parseNumeric(segment(body, QUANTITY_MARKER)); if (afterMarker) return afterMarker; const beforeMarker = body.match(/(\d+(?:\.\d+)?)\s*(?:pieces?|pcs?|quantity|qty|count|numbers?|num|پیس(?:ز)?|ٹکڑے|تعداد|مقدار)/iu); return parseNumeric(beforeMarker?.[1] ?? null); }
function hasCreateIntent(text: string): boolean { const normalized = text.trim(); if (!normalized || (!ACTION_PATTERN.test(normalized) && !ENTRY_PATTERN.test(normalized))) return false; return ENTRY_PATTERN.test(normalized) || /\b(?:add|create|new)\b.{0,40}\b(?:work|entry|shirt|item)\b/i.test(normalized) || /\b(?:work|entry)\b.{0,40}\b(?:bana|banao|bna|bn[aá]o|add|create|kar(?:o|do))\b/i.test(normalized) || /(?:نئی|نیا)\s+(?:ورک\s*)?انٹری.{0,40}(?:بنائیں|بناؤ|بناو)/iu.test(normalized) || /(?:ورک\s*)?انٹری.{0,40}(?:بنائیں|بناؤ|بناو)/iu.test(normalized); }
function stripActionPrefix(value: string): string { return clean(value.replace(/^.*?(?:\b(?:work\s+entry|workentry|entry)\b|ورک\s*انٹری|کام\s*(?:کی\s*)?انٹری|انٹری)\s*(?:\b(?:bana|banao|bnao|create|add|new)\b|بنائیں|بناؤ|بناو|بنا دیں|بنا)?\s*/iu, '')); }
function stripCommandPrefix(value: string): string { return clean(value.replace(/^(?:(?:add|create|new|make)\s+|(?:bana(?:o|do)?|bna(?:o|do)?|daal(?:o|do)?)\s+|(?:nayi|naya)\s+|نئی\s+|نیا\s+|بنائیں\s+|بناؤ\s+|بناو\s+)/iu, '')); }
export function detectLocalWorkAction(text: string, occurredAtIso: string): LocalWorkActionDetection {
  if (!hasCreateIntent(text)) return { kind: 'not_action' };
  const body = clean(text); let item = segment(body, ITEM_MARKER); const firstMarker = NEXT_MARKER.exec(body);
  if (!item && firstMarker && firstMarker.index > 0) {
    const candidate = stripCommandPrefix(stripActionPrefix(body.slice(0, firstMarker.index)));
    item = candidate || null;
  }
  if (!item) { const prefixRemoved = stripActionPrefix(body); const beforeMarker = NEXT_MARKER.exec(prefixRemoved); item = clean(beforeMarker ? beforeMarker.index > 0 ? prefixRemoved.slice(0, beforeMarker.index) : '' : prefixRemoved) || null; }
  const quantity = parseQuantity(body); const rate = parseNumericPrefix(segment(body, RATE_MARKER));
  if (!item) return { kind: 'missing', missing: 'item_name', message: 'Please provide the item name.' };
  if (!quantity) return { kind: 'missing', missing: 'quantity', message: 'Please provide the pieces/quantity.' };
  if (!rate) return { kind: 'missing', missing: 'rate', message: 'Please provide the rate.' };
  const sizeValue = segment(body, SIZE_MARKER); const size = sizeValue ? sizeValue.split(/\s*(?:,|and|&)\s*/iu).map(clean).filter(Boolean) : null; const specialNote = segment(body, NOTE_MARKER); const total = Number(quantity) * Number(rate);
  if (!Number.isFinite(total)) return { kind: 'missing', missing: 'quantity', message: 'The quantity and rate must be valid positive numbers.' };
  return { kind: 'action', total, intent: { toolName: 'create_work_entry', arguments: { item_name: item, size, quantity, rate, special_note: specialNote, occurred_at_iso: occurredAtIso } } };
}
export function localWorkActionSummary(intent: LocalCreateWorkEntryIntent, total: number): string { const a = intent.arguments; return `Work Entry\nItem: ${a.item_name}\nSize: ${a.size?.join(', ') ?? '—'}\nPieces: ${a.quantity}\nRate: ${a.rate}\nTotal: ${total.toString()}`; }
