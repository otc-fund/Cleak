# Sprint 1 Wire-Format Reference

Source: Task 0 spike against `claude.exe` with `--print --verbose --bare --input-format stream-json --output-format stream-json --permission-mode bypassPermissions`.

## System init frame (first frame emitted on startup)

```json
{"type":"system","subtype":"init","session_id":"<uuid>","tools":[...],"mcp_servers":[...]}
```

Key fields:
- `subtype`: one of `init`, `hook_started`, `hook_response` (with `--bare`, only `init` is emitted)
- `session_id`: used to correlate all subsequent frames

## Assistant frame

```json
{"type":"assistant","session_id":"<uuid>","message":{"role":"assistant","content":[{"type":"text","text":"<streamed token>"}],"model":"<model or '<synthetic>' on errors>"}}
```

On auth failure, also includes:
```json
{"error":{"type":"authentication_error",...}}
```

## Result frame

```json
{"type":"result","subtype":"success","is_error":false,"session_id":"<uuid>","duration_ms":1234,"duration_api_ms":1200,"total_cost_usd":0.001,"num_turns":1,"result":"<final text>","terminal_reason":"end_turn","api_error_status":null,"modelUsage":{...},"permission_denials":[],"fast_mode_state":null}
```

## Outbound user frame

```json
{"type":"user","message":{"role":"user","content":"<text>"}}
```

## Zod schema location

`gui/src/main/cleakProtocol.ts` — `CleakInboundFrame` discriminated union. All frames use `.passthrough()` for forward compatibility.

## Known quirks

- `--verbose` is required alongside `--output-format stream-json` (omitting it causes an error exit)
- `--bare` prevents hook frames from polluting the stream
- The bare `claude` command on Windows PATH is a WindowsApps shim that swallows stdout under pipe redirection. Use the explicit binary path (e.g. `C:\Users\<user>\.local\bin\claude.exe`) or set `CLAUDE_BIN`.
- A non-zero exit code does NOT mean the protocol failed — always read the `result` frame
- Model may be `<synthetic>` when auth fails
