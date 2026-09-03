import { supabase } from '../../../lib/supabase/client';
import { offlineAiTrace } from '../runtime/localAiDiagnostics';
import { detectLocalWorkAction, localWorkActionSummary, type LocalWorkActionDetection } from './localWorkActionIntent';

export interface LocalActionBridgeResult {
  conversationId: string;
  assistantMessage: string;
  pendingActions: Array<{ id: string; displaySummary: string; expiresAt: string }>;
}

async function authenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error('Your Work Social session has expired. Please sign in again.');
  return data.session.user.id;
}

async function ensureConversation(userId: string, requestedId: string | null, title: string): Promise<string> {
  if (requestedId) {
    const { data, error } = await supabase.from('ai_conversations').select('id').eq('id', requestedId).eq('user_id', userId).single();
    if (error || !data) throw new Error('Conversation not found.');
    return data.id as string;
  }
  const { data, error } = await supabase.from('ai_conversations').insert({ user_id: userId, title: title.slice(0, 80), status: 'active' }).select('id').single();
  if (error || !data) throw new Error(error?.message || 'Could not create AI conversation.');
  return data.id as string;
}

async function persistMessage(conversationId: string, userId: string, role: 'user' | 'assistant', content: string, metadata: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabase.from('ai_messages').insert({ conversation_id: conversationId, user_id: userId, role, content, metadata });
  if (error) throw new Error(error.message || 'Could not persist AI conversation message.');
}

async function createPendingAction(conversationId: string, userId: string, detection: Extract<LocalWorkActionDetection, { kind: 'action' }>): Promise<{ id: string; displaySummary: string; expiresAt: string }> {
  const { data: worker, error: workerError } = await supabase.from('worker_profiles').select('id').eq('profile_id', userId).maybeSingle();
  if (workerError) throw new Error(workerError.message || 'Could not resolve Work Identity.');
  if (!worker) throw new Error('Your Work Identity is not set up.');
  const args = { ...detection.intent.arguments, worker_profile_id: worker.id };
  const displaySummary = localWorkActionSummary(detection.intent, detection.total);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('ai_pending_actions').insert({ user_id: userId, conversation_id: conversationId, tool_name: 'create_work_entry', arguments: args, display_summary: displaySummary, status: 'pending', expires_at: expiresAt }).select('id,display_summary,expires_at').single();
  if (error || !data) throw new Error(error?.message || 'Could not create the pending Work Entry action.');
  await supabase.from('ai_tool_calls').insert({ user_id: userId, conversation_id: conversationId, message_id: null, tool_name: 'create_work_entry', arguments: args, result: { confirmation_required: true, id: data.id }, status: 'awaiting_confirmation' });
  offlineAiTrace('LOCAL_ACTION_PENDING_CREATED', { actionId: data.id, toolName: 'create_work_entry', conversationId });
  return { id: data.id as string, displaySummary: data.display_summary as string, expiresAt: data.expires_at as string };
}

export async function bridgeLocalAction(text: string, generatedResponse: string, conversationId: string | null): Promise<LocalActionBridgeResult> {
  const userId = await authenticatedUserId();
  const nextConversationId = await ensureConversation(userId, conversationId, text);
  const occurredAtIso = new Date().toISOString();
  const detection = detectLocalWorkAction(text, occurredAtIso);
  if (detection.kind === 'not_action') {
    await persistMessage(nextConversationId, userId, 'user', text);
    await persistMessage(nextConversationId, userId, generatedResponse, { provider: 'local', mode: 'offline' });
    await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', nextConversationId).eq('user_id', userId);
    return { conversationId: nextConversationId, assistantMessage: generatedResponse, pendingActions: [] };
  }
  if (detection.kind === 'missing') {
    offlineAiTrace('LOCAL_ACTION_INTENT_DETECTED', { toolName: 'create_work_entry', valid: false, missing: detection.missing });
    const message = detection.message;
    await persistMessage(nextConversationId, userId, 'user', text);
    await persistMessage(nextConversationId, userId, message, { provider: 'local', mode: 'offline', localAction: true, missing: detection.missing });
    await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', nextConversationId).eq('user_id', userId);
    return { conversationId: nextConversationId, assistantMessage: message, pendingActions: [] };
  }
  offlineAiTrace('LOCAL_ACTION_INTENT_DETECTED', { toolName: detection.intent.toolName, valid: true });
  offlineAiTrace('LOCAL_ACTION_VALIDATED', { toolName: detection.intent.toolName, itemName: detection.intent.arguments.item_name, quantity: detection.intent.arguments.quantity, rate: detection.intent.arguments.rate });
  const pending = await createPendingAction(nextConversationId, userId, detection);
  const assistantMessage = generatedResponse.trim() || `I’m ready to add this Work Entry.\n\n${pending.displaySummary}`;
  await persistMessage(nextConversationId, userId, 'user', text);
  await persistMessage(nextConversationId, userId, assistantMessage, { provider: 'local', mode: 'offline', pending_actions: [pending], localAction: true });
  await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', nextConversationId).eq('user_id', userId);
  return { conversationId: nextConversationId, assistantMessage, pendingActions: [pending] };
}
