import type {
  AssistantCommand,
  AssistantToolResult,
  CreateWorkEntryIntent,
  FinanceIntent,
  GetWorkHistoryIntent,
} from './contracts';

export interface WorkAssistantTool {
  execute(command: CreateWorkEntryIntent, signal?: AbortSignal): Promise<AssistantToolResult>;
}

export interface HistoryAssistantTool {
  execute(command: GetWorkHistoryIntent, signal?: AbortSignal): Promise<AssistantToolResult>;
}

export interface FinanceAssistantTool {
  execute(command: FinanceIntent, signal?: AbortSignal): Promise<AssistantToolResult>;
}

export interface OfflineWorkAssistantTools {
  readonly work: WorkAssistantTool;
  readonly history: HistoryAssistantTool;
  readonly finance: FinanceAssistantTool;
}

export function toolForCommand(tools: OfflineWorkAssistantTools, command: AssistantCommand): WorkAssistantTool | HistoryAssistantTool | FinanceAssistantTool {
  switch (command.intent) {
    case 'create_work_entry': return tools.work;
    case 'get_work_history': return tools.history;
    case 'finance': return tools.finance;
  }
}
