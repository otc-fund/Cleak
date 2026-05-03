// src/main/cleakProtocol.ts
import { z } from 'zod';

const TextBlock = z.object({ type: z.literal('text'), text: z.string() });
const ThinkingBlock = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
});
const ToolUseBlock = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});
const ToolResultBlock = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  tool_name: z.string().optional(),
  content: z.unknown(),
  is_error: z.boolean().optional(),
});

const ContentBlock = z.discriminatedUnion('type', [
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  ToolResultBlock,
]);

export const SystemFrame = z.object({
  type: z.literal('system'),
  subtype: z.string(),
  session_id: z.string().optional(),
  tools: z.array(z.unknown()).optional(),
  mcp_servers: z.array(z.unknown()).optional(),
}).passthrough();

export const AssistantFrame = z.object({
  type: z.literal('assistant'),
  session_id: z.string().optional(),
  message: z.object({
    role: z.literal('assistant'),
    content: z.union([z.string(), z.array(ContentBlock)]),
    model: z.string().optional(),
  }).passthrough(),
  error: z.union([z.object({ type: z.string() }).passthrough(), z.string()]).optional(),
}).passthrough();

export const UserFrame = z.object({
  type: z.literal('user'),
  session_id: z.string().optional(),
  message: z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(ContentBlock)]),
  }).passthrough(),
}).passthrough();

export const ResultFrame = z.object({
  type: z.literal('result'),
  subtype: z.string(),
  is_error: z.boolean(),
  session_id: z.string().optional(),
  duration_ms: z.number().nullish(),
  duration_api_ms: z.number().nullish(),
  total_cost_usd: z.number().nullish(),
  num_turns: z.number().nullish(),
  api_error_status: z.number().nullish(),
  terminal_reason: z.string().optional(),
  modelUsage: z.record(z.unknown()).optional(),
  permission_denials: z.array(z.unknown()).optional(),
  fast_mode_state: z.unknown().optional(),
  result: z.string().optional(),
}).passthrough();

export const CleakInboundFrame = z.discriminatedUnion('type', [
  SystemFrame,
  AssistantFrame,
  UserFrame,
  ResultFrame,
]);
export type CleakInboundFrame = z.infer<typeof CleakInboundFrame>;

export interface OutboundUserFrame {
  type: 'user';
  message: { role: 'user'; content: string };
}

export function buildUserFrame(text: string): OutboundUserFrame {
  return { type: 'user', message: { role: 'user', content: text } };
}
