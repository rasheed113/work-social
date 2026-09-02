import { buildAiContext } from './contextBuilder';
import type { AiConversation } from '../history/contracts';

const conversation: AiConversation = {
  id: 'c', title: null, summary: null,
  createdAt: '2026-09-02T18:00:00.000Z', updatedAt: '2026-09-02T18:00:00.000Z',
  messages: [{
    id: 'old', role: 'user', content: 'previous', createdAt: '2026-09-02T18:00:00.000Z',
    attachments: [{ id: 'saved-image', mimeType: 'image/png', name: 'photo.png', size: 123, reference: 'local-ref' }],
  }],
};
const image = { id: 'current-image', kind: 'image' as const, mimeType: 'image/webp', name: 'current.webp', metadata: { reference: 'current-ref', declaredSizeBytes: 456 } };
const result = buildAiContext(conversation, { conversationId: 'c', id: 'current', content: 'What is in this image?', attachments: [image] }, { maxCharacters: 2_048, maxMessages: 16, includeSummary: true });

if (result.messages.at(-1)?.attachments?.[0]?.id !== 'current-image') throw new Error('Current image attachment was not preserved.');
if (result.messages[0]?.attachments?.[0]?.id !== 'saved-image') throw new Error('History image metadata was not preserved.');
if (result.messages.some((message) => message.content.toLowerCase().includes('photo.png') || message.content.toLowerCase().includes('local-ref'))) throw new Error('Image metadata was converted into fake textual context.');
if (result.estimatedCharacters !== result.messages.reduce((total, message) => total + message.content.length, 0)) throw new Error('Context character accounting changed.');
console.log('Phase 10 vision context tests passed: image metadata remains structured and context remains bounded.');
