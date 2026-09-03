import type { AssistantCommand, AssistantContext, AssistantToolResult } from './contracts';
import type { AudioInput } from './audio';
import type { OfflineSpeechToTextProvider, SpeechToTextOptions } from './stt';
import { validateAssistantCommand } from './validation';
import { toolForCommand, type OfflineWorkAssistantTools } from './tools';

export interface LocalTextIntentExtractor {
  extract(text: string, context: AssistantContext): Promise<unknown>;
}

export interface OfflineVoiceAssistantPipeline {
  transcribeAndExecute(
    audio: AudioInput,
    context: AssistantContext,
    sttOptions?: SpeechToTextOptions,
  ): Promise<AssistantToolResult>;
}

export function createOfflineVoiceAssistantPipeline(
  stt: OfflineSpeechToTextProvider,
  extractor: LocalTextIntentExtractor,
  tools: OfflineWorkAssistantTools,
): OfflineVoiceAssistantPipeline {
  return {
    async transcribeAndExecute(audio, context, sttOptions) {
      if (context.signal?.aborted) throw new DOMException('The assistant operation was cancelled.', 'AbortError');
      const transcript = await stt.transcribe(audio, { ...sttOptions, signal: context.signal });
      if (context.signal?.aborted) throw new DOMException('The assistant operation was cancelled.', 'AbortError');
      const rawCommand = await extractor.extract(transcript.text, {
        ...context,
        language: {
          inputLanguage: transcript.language ?? context.language.inputLanguage,
          responseLanguage: context.language.responseLanguage,
        },
      });
      if (context.signal?.aborted) throw new DOMException('The assistant operation was cancelled.', 'AbortError');
      const command: AssistantCommand = validateAssistantCommand(rawCommand);
      return toolForCommand(tools, command).execute(command as never, context.signal);
    },
  };
}
