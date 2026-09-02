import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase/client';

export interface AiConversation {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_call_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AiPendingAction {
  id: string;
  display_summary: string;
  expires_at: string;
}

export interface AiReply {
  conversation_id: string;
  message: string;
  pending_actions: AiPendingAction[];
}

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Work Social AI could not complete that request.';
}

async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    const sbErrorCode = error.context.headers.get('sb-error-code');
    let payload: Record<string, unknown> = {};
    try {
      const parsed = await error.context.clone().json();
      if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
    } catch {
      // Keep the diagnostic safe even if the function did not return JSON.
    }

    const code = typeof payload.code === 'string' ? payload.code : null;
    const message = typeof payload.error === 'string' ? payload.error : null;
    const upstreamStatus = typeof payload.upstream_status === 'number' ? payload.upstream_status : null;
    const parts = [`HTTP ${status}`];
    if (sbErrorCode) parts.push(`sb-error-code ${sbErrorCode}`);
    if (code) parts.push(`server ${code}`);
    if (upstreamStatus) parts.push(`upstream HTTP ${upstreamStatus}`);
    if (message) parts.push(message);
    return parts.join(' — ');
  }

  if (error instanceof FunctionsRelayError) return `Supabase Functions relay error — ${readableError(error)}`;
  if (error instanceof FunctionsFetchError) return `Supabase Functions fetch error — ${readableError(error)}`;
  return readableError(error) || fallback;
}

export async function sendAiMessage(message: string, conversationId: string | null): Promise<AiReply> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > 12000) throw new Error('Message must be 12,000 characters or fewer.');

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error('Your Work Social session has expired. Please sign in again.');

  const { data, error } = await supabase.functions.invoke('work-social-ai', {
    body: { message: trimmed, conversation_id: conversationId },
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });

  if (error) throw new Error(await functionErrorMessage(error, 'Work Social AI could not complete that request.'));
  if (!data || typeof data !== 'object') throw new Error('The AI service returned an invalid response.');
  if ('error' in data && typeof data.error === 'string') throw new Error(data.error);

  const reply = data as Partial<AiReply>;
  if (typeof reply.conversation_id !== 'string' || typeof reply.message !== 'string') {
    throw new Error('The AI service returned an incomplete response.');
  }

  return {
    conversation_id: reply.conversation_id,
    message: reply.message,
    pending_actions: Array.isArray(reply.pending_actions) ? reply.pending_actions : [],
  };
}

export async function confirmAiAction(actionId: string): Promise<{ success: boolean; entry?: Record<string, unknown> }> {
  if (!actionId) throw new Error('The action is missing its confirmation id.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error('Your Work Social session has expired. Please sign in again.');

  const { data, error } = await supabase.functions.invoke('work-social-ai', {
    body: { action: 'confirm', action_id: actionId },
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Work Social AI could not complete that confirmation.'));
  if (!data || typeof data !== 'object') throw new Error('The AI service returned an invalid confirmation response.');
  if ('error' in data && typeof data.error === 'string') throw new Error(data.error);
  return data as { success: boolean; entry?: Record<string, unknown> };
}

export async function listAiConversations(): Promise<AiConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id,title,status,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(30);
  if (error) throw new Error((error as PostgrestError).message || 'Could not load AI conversations.');
  return (data ?? []) as AiConversation[];
}

export async function listAiMessages(conversationId: string): Promise<AiMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('id,conversation_id,role,content,tool_name,tool_call_id,metadata,created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error((error as PostgrestError).message || 'Could not load AI messages.');
  return (data ?? []) as AiMessage[];
}
