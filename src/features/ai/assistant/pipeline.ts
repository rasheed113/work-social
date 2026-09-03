import type { AssistantContext, AssistantToolResult } from './contracts';
import type { AudioInput } from './audio';
import type { SpeechToTextOptions, OfflineSpeechToTextProvider } from './stt';
import { validateAssistantCommand } from './validation';
import type { OfflineWorkAssistantTools } from './tools';

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
      const command = validateAssistantCommand(rawCommand);
      switch (command.intent) {
        case 'create_work_entry':
          return tools.work.execute(command, context.signal);
        case 'get_work_history':
          return tools.history.execute(command, context.signal);
        case 'finance':
          return tools.finance.execute(command, context.signal);
      }
    },
  };
}
