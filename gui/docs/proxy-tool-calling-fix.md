# Fix AI Proxy to Support OpenAI Tool/Function Calling

## Problem
The proxy at `localhost:3003/v1/chat/completions` rejects requests containing a `tools` parameter with:
```json
{"error":{"message":"Internal server error"}}
```
This prevents Claude CLI from executing tools through Cleak, because the Anthropic shim translates tool_use blocks into OpenAI tool_calls, and the proxy doesn't know how to handle them.

## Requirements

### 1. Accept the `tools` parameter
The request body will include a `tools` array following OpenAI format:
```json
{
  "model": "qwen3.6-plus",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "Read",
        "description": "Read a file from the filesystem",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "Absolute path to the file" }
          },
          "required": ["path"]
        }
      }
    }
  ]
}
```
Pass these tools through to the upstream model — don't strip or reject them.

### 2. Accept `tool_choice`
Support the `tool_choice` parameter:
- `"auto"` — let the model decide whether to use tools
- `"required"` — force the model to use at least one tool
- `{"type":"function","function":{"name":"Read"}}` — force a specific tool

### 3. Streaming responses (`stream: true`)
When the model generates tool calls in streaming mode, emit SSE chunks with `tool_calls` in the delta:

**Tool call start:**
```json
data: {"choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_abc123","type":"function","function":{"name":"Read","arguments":""}}]},"finish_reason":null}]}
```

**Incremental arguments (streamed character by character or in small chunks):**
```json
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"path\":\""}}]},"finish_reason":null}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"/home/user/"}}]},"finish_reason":null}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"file.txt\"}"}}]},"finish_reason":null}]}
```

**End with finish_reason "tool_calls":**
```json
data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}
data: [DONE]
```

### 4. Non-streaming responses (`stream: false`)
Return the complete tool_calls array:
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "Read",
          "arguments": "{\"path\":\"/home/user/file.txt\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

### 5. Tool result continuation
After the model returns a tool_call, the client sends back a message with `role: "tool"` and `tool_call_id`:
```json
{
  "messages": [
    {"role": "assistant", "tool_calls": [...]},
    {"role": "tool", "tool_call_id": "call_abc123", "content": "File content here..."}
  ]
}
```
Process this normally and return the model's response based on the tool output.

### 6. Mixed content (text + tool calls)
If the model generates both text and tool calls in the same response, include both:
- `delta.content` for text
- `delta.tool_calls` for tool calls

## Notes
- The upstream model (qwen3.6-plus on DashScope) already supports function/tool calling natively.
- DashScope's OpenAI-compatible API endpoint already handles tool calls — the proxy just needs to pass them through instead of rejecting them.
- If using `openai-proxy` or similar, ensure the `tools` field is forwarded in the upstream request body.
