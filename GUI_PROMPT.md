# Build a Full-Featured Desktop GUI for Cleak (Claude Code Fork)

You are tasked with building a complete desktop GUI application that provides a graphical interface for the Cleak codebase located at `D:\cleak2\cleak\src`. Your GUI must expose **every feature** of the backend through a polished, modern desktop interface.

## API Configuration

The GUI will communicate with the AI backend via OpenAI-compatible completions:

```
API Base URL: http://localhost:3003/v1
Model: qwen3.6-plus
API Key: pk_f160feb169e64ddfae00879e90c7a32a
```

Use the OpenAI Chat Completions API format (`POST /chat/completions`) for all AI interactions. Support streaming via Server-Sent Events (SSE).

## Project Location

Backend source: `D:\cleak2\cleak\src`

Study every file in the source tree to understand the full feature set. The key directories are:

```
src/
├── tools/                    # All tool implementations
│   ├── BashTool/             # Terminal command execution (bash & PowerShell)
│   ├── FileEditTool/         # File editing (search/replace, line-based)
│   ├── FileReadTool/         # File reading with syntax highlighting
│   ├── FileWriteTool/        # File creation/writing
│   ├── GrepTool/             # Grep search
│   ├── GlobTool/             # Glob pattern matching
│   ├── WebFetchTool/         # Web content fetching
│   ├── WebSearchTool/        # Web search
│   ├── TaskTool/             # Sub-task delegation (sub-agents)
│   ├── TaskOutputTool/       # Task output retrieval
│   ├── TaskStopTool/         # Task cancellation
│   ├── AgentTool/            # Multi-agent system (custom agents, agent swarms)
│   ├── MCPClientTool/        # MCP (Model Context Protocol) client
│   ├── ListMcpResourcesTool/ # MCP resource listing
│   ├── ReadMcpResourceTool/  # MCP resource reading
│   ├── ToolSearchTool/       # Dynamic tool discovery
│   ├── TodoWriteTool/        # Todo/task list management
│   ├── PlanMode/             # Plan mode tools (EnterPlanMode, ExitPlanModeV2)
│   ├── LSPTool/              # Language Server Protocol integration
│   ├── NotebookEditTool/     # Jupyter notebook editing
│   ├── AskUserQuestionTool/  # Interactive user questions
│   ├── BriefTool/            # Project briefing
│   ├── KillProcessTool/      # Process management
│   ├── BashHistoryTool/      # Command history
│   ├── BashOutputTool/       # Bash output viewing
│   ├── KillBashTool/         # Kill running processes
│   ├── PatchApplyTool/       # Git patch application
│   ├── SummarizeTool/        # Code summarization
│   ├── DevTool/              # Development tools
│   ├── SkillTool/            # Skill system
│   ├── SlashCommandTool/     # Slash commands
│   ├── PowerShellTool/       # PowerShell execution
│   ├── WindowsDefenderTool/  # Windows Defender integration
│   ├── WingetTool/           # Winget package manager
│   ├── TungstenTool/         # Internal tool
│   ├── TeamCreateTool/       # Team creation (agent swarms)
│   ├── TeamDeleteTool/       # Team deletion
│   ├── SendMessageTool/      # Inter-agent messaging
│   ├── EnterWorktreeTool/    # Git worktree management
│   ├── ExitWorktreeTool/     # Exit worktree mode
│   ├── TestingPermissionTool/# Testing permissions
│   ├── ScheduleCronTool/     # Cron scheduling (CronCreate, CronDelete, CronList)
│   ├── RemoteTriggerTool/    # Remote triggers
│   ├── MonitorTool/          # Monitoring
│   ├── PushNotificationTool/ # Push notifications
│   ├── SendUserFileTool/     # File sharing
│   ├── SubscribePRTool/      # GitHub PR subscriptions
│   └── SleepTool/            # Agent sleep/pause
├── skills/bundled/           # Bundled skills (git, react-bc, python, mcp-sdk, etc.)
├── hooks/                    # React hooks for UI features (~80 hooks)
├── components/               # TUI components (convert to desktop GUI components)
├── services/
│   ├── mcp/                  # MCP server/client management
│   ├── analytics/            # Analytics & GrowthBook feature flags
│   ├── api/                  # API client (claude.ts - adapt to OpenAI)
│   ├── policyLimits/         # Policy limits
│   └── remoteManagedSettings/
├── permissions/              # Permission system (trust levels, allow/deny)
├── keybindings/              # Keyboard shortcut system
├── vim/                      # Vim mode emulation
├── voice/                    # Voice mode (STT/TTS)
├── state/                    # Zustand state management
├── daemon/                   # Background daemon (sessions, workers)
├── bridge/                   # Remote control / bridge mode
├── coordinator/              # Coordinator mode
├── assistant/                # Assistant mode (KAIROS)
├── self-hosted-runner/       # Self-hosted runner
├── environment-runner/       # BYOC environment runner
├── upstreamproxy/            # Upstream proxy
├── utils/                    # Utilities (config, auth, models, etc.)
├── entrypoints/              # CLI, MCP, daemon, SDK entrypoints
├── constants/                # Prompts, system constants, betas
├── context/                  # React context providers
├── dialogLaunchers.js        # Dialog management
├── interactiveHelpers.js     # Interactive UI helpers
├── commands.js               # Slash commands system
├── history.js                # Input history
├── Tool.js                   # Tool base class & permission system
├── tools.js                  # Tool registry
├── main.tsx                  # Main entry (Commander CLI - replace with GUI)
└── entrypoints/init.ts       # Initialization system
```

## Required GUI Features

### 1. Main Chat Interface
- **Conversation panel** with message bubbles (user/assistant/system)
- **Streaming response display** with real-time token rendering
- **Markdown rendering** for code blocks, tables, lists
- **Syntax-highlighted code blocks** with copy button
- **Thinking process display** (expandable thinking blocks, group collapsable when reached 3 blocks)
- **Tool call visualization** — show each tool being invoked with params and results
- **Token usage display** (input, output, cache read, cache creation, cost)
- **Message timestamps** and request IDs
- **Multi-turn conversation** with full context management

### 2. All Tools — Full GUI Integration

Every tool from `src/tools/` must have a GUI representation:

#### File Operations
- **File Browser** — project file tree with search, filtering, icons
- **File Editor** — integrated code editor with:
  - Syntax highlighting for all languages
  - Search & replace (global and per-file)
  - Line-based editing
  - Diff view for changes
  - Save/discard changes
  - File creation, deletion, rename
  - Multi-tab support
- **File Read** — view file contents with syntax highlighting
- **Notebook Editor** — Jupyter notebook viewer/editor

#### Terminal/Shell
- **Integrated Terminal** — full terminal emulator (xterm.js)
  - Bash and PowerShell support
  - Process management (start, stop, view output)
  - Command history with search
  - Background task monitoring
  - Multiple terminal tabs
  - Real-time output streaming

#### Search & Navigation
- **Global Search** — grep-like search across project
- **File Search** — glob pattern matching with fuzzy search
- **Quick Open** — file quick-open (Cmd/Ctrl+P style)

#### Web Tools
- **Web Search** — search results panel with clickable links
- **Web Fetch** — URL content preview panel
- **lightpanda** — use lightpanda browser at http:\\localhost:9222

#### Task & Agent Management
- **Task Panel** — sub-task list with status indicators
  - Create sub-tasks, monitor progress, view results
  - Cancel running tasks
  - Task output viewer
- **Multi-Agent Dashboard** — agent swarm management
  - View active agents, their status, colors
  - Create/delete agents
  - Agent-to-agent messaging
  - Agent permissions
  - Custom agent configuration (JSON editor)

#### MCP (Model Context Protocol)
- **MCP Server Manager** — add, remove, configure MCP servers
  - stdio and SSE transport support
  - Server connection status
  - Tool/resource browser per server
- **MCP Resource Viewer** — browse and view MCP server resources
- **MCP Tool Browser** — discover and invoke MCP tools

#### Planning Mode
- **Plan Mode** — visual planning interface
  - Toggle plan/act mode
  - Plan review and approval workflow
  - Plan history

#### Todo/Task List
- **Todo Panel** — collapsible todo list
  - Add, check, edit, delete todos
  - Status tracking (pending, in_progress, completed)

#### LSP Integration
- **LSP Status** — language server connection status
  - Go to definition, find references
  - Hover tooltips
  - Diagnostics/problems panel
  - Auto-completion integration

#### Git/Version Control
- **Git Panel** — full git integration
  - Status, diff, commit, push, pull
  - Branch management
  - Worktree management (create, switch, exit)
  - Patch application
  - Git history/log viewer
  - PR status display

#### Process Management
- **Process Manager** — view and manage running processes
  - Kill processes
  - View process output
  - Process status indicators

#### Brief & Summarize
- **Project Brief** — auto-generate project briefs
- **Code Summarizer** — summarize selected code/files

#### Cron/Scheduling
- **Scheduler** — create, list, delete cron jobs
- **Remote Triggers** — manage remote triggers

#### Skills System
- **Skill Manager** — view and activate skills
  - Built-in skills (git, react, python, etc.)
  - Custom skill loading from `.claude/skills/`
  - Skill documentation viewer

#### Windows-Specific
- **PowerShell** — dedicated PowerShell tab
- **Windows Defender** — security scan integration
- **Winget** — package manager UI

#### Communication
- **Inter-agent Messaging** — send messages between agents
- **Push Notifications** — notification center
- **User Question Dialogs** — modal dialogs for agent questions with:
  - Multiple choice
  - Text input
  - File selection

### 3. Slash Commands

Implement all slash commands as GUI actions:

- `/help` — help panel
- `/clear` — clear conversation
- `/compact` — compact context
- `/config` — settings editor
- `/cost` — cost dashboard
- `/doctor` — system health check
- `/export` — export conversation
- `/model` — model selector
- `/agents` — agent management
- `/advisor` — advisor toggle
- `/brief` — project briefing
- `/approve` — approve pending actions
- `/plan` — enter plan mode
- `/todos` — todo panel
- `/skills` — skill management
- `/mcp` — MCP server management
- `/ps` — process list
- `/terminal` — open terminal
- `/voice` — voice mode toggle
- `/vim` — vim mode toggle
- `/theme` — theme selector
- `/keybindings` — keybinding editor
- `/plugins` — plugin marketplace
- `/worktree` — worktree management
- `/teammate` — teammate mode
- `/daemon` — daemon management
- `/remote` — remote/bridge mode
- `/stats` — usage statistics
- `/share` — share session
- `/resume` — resume session
- `/teleport` — teleport session

### 4. Settings & Configuration

- **Settings Panel** — comprehensive settings UI
  - API configuration (base URL, model, API key with secure storage)
  - Model selection and parameters (temperature, max tokens, thinking budget)
  - Prompt caching settings
  - Fast mode toggle
  - Effort level selector
  - Permission defaults (allow/deny/ask)
  - Trust level management
  - MCP server configuration
  - Agent configuration
  - Skill configuration
  - Theme customization (light/dark/high-contrast)
  - Keybinding editor
  - Plugin management
  - Proxy/MTLS settings
  - Environment variable management

### 5. Permission System

- **Permission Manager** — granular tool permission control
  - Allow / Deny / Ask per tool
  - Session-level and permanent permissions
  - Trust level indicators
  - Auto-mode state management
  - Security scan integration (secret detection)
  - Risk assessment display

### 6. Session Management

- **Session Manager** — conversation session management
  - List, load, delete sessions
  - Session search
  - Session export/import
  - Background sessions (Ctrl+B equivalent)
  - Session resume
  - Teleport (remote session sync)
  - Session sharing

### 7. Voice Mode

- **Voice Interface** — speech-to-text and text-to-speech
  - Voice input with real-time transcription
  - Voice response playback
  - Voice settings (language, speed, voice selection)
  - Push-to-talk and continuous mode

### 8. Vim Mode

- **Vim Emulation** — vim keybindings in the editor
  - Normal, insert, visual modes
  - Command line mode
  - Custom vimrc support

### 9. Keyboard Shortcuts

- **Keybinding System** — customizable keyboard shortcuts
  - Default keybindings (based on existing keybindings system)
  - Custom keybinding editor
  - Conflict detection
  - Platform-specific bindings (Windows/Mac/Linux)



### 10. Panel Layout

Design a VS Code-like layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Menu Bar  File  Edit  View  Terminal  Tools  Help                  │
├──────┬──────────────────────────────────────────────┬──────────────┤
│      │                                              │              │
│ Act  │          Main Chat / Editor Area             │ Right        │
│      │                                              │ Panel        │
│  📁  │  [Conversation messages with streaming]      │ (contextual) │
│  🔍  │  [File editor with tabs]                    │              │
│  🤖  │  [Terminal emulator]                        │ • File tree  │
│  ⚙️  │  [Plan mode view]                           │ • Todos      │
│  🔌  │                                              │ • Tasks      │
│      │                                              │ • MCP        │
│      │                                              │ • Agents     │
│      │                                              │ • Git        │
│      │                                              │ • Search     │
│      │                                              │ • Settings   │
├──────┴──────────────────────────────────────────────┴──────────────┤
│ Status Bar: Model: qwen3.6-plus | Tokens: 12.4K | Cost: $0.03 | 🔴●│
└─────────────────────────────────────────────────────────────────────┘
```

### 11. API Integration Details

```typescript
// API Configuration
const API_CONFIG = {
  baseURL: "http://localhost:3003/v1",
  model: "qwen3.6-plus",
  apiKey: "pk_f160feb169e64ddfae00879e90c7a32a", 
};

// Use OpenAI Chat Completions format
// POST /chat/completions
// Support streaming with stream: true
// Support tools array for function calling
// Support thinking parameters if the model supports it
```

The system prompt should be constructed to match Claude Code's behavior — instructing the model to act as an expert coding assistant with file editing, terminal, search, and tool-use capabilities.

### 12. Tool Schema for OpenAI Function Calling

Convert all tools from the codebase into OpenAI function calling format. Each tool needs:
- Name and description
- JSON Schema for input parameters
- Handler function that calls the actual backend implementation

### 13. Security Considerations

- API key stored securely (electron-safe-store or OS keychain)
- Command execution sandboxing
- File system permission prompts
- No automatic execution of untrusted code
- Secret detection in diffs/edits
- CORS/proxy handling for local API

### 14. Build & Distribution

- Windows .exe installer (primary target since backend runs on Windows)
- Auto-update mechanism
- Portable mode option

## Deliverables

2. **Source code** organized in a clean project structure
3. **Build scripts** for development and production
5. **README** with setup instructions
6. **API key placeholder** clearly marked for user to fill in

## Technical Approach

1. **Study the backend** thoroughly — understand every tool, hook, skill, and feature
2. **Design the architecture** — component hierarchy, state management, API layer
3. **Implement the core** — chat interface, streaming, tool execution
4. **Build all panels** — file browser, terminal, tasks, agents, MCP, etc.
5. **Implement settings** — comprehensive configuration UI
6. **Add polish** — themes, animations, keyboard shortcuts, notifications
7. **Test & package** — build for distribution

## Notes

- The backend is written in TypeScript and uses Bun as the runtime
- Many features are gated behind feature flags (feature('...')) — implement them all
- The existing TUI uses Ink (React for terminal) — reuse the component logic where possible
- The permission system is sophisticated — replicate it faithfully
- MCP support is critical — full server management and tool discovery
- Agent/swarm system is a unique feature — give it proper UI treatment
- Windows is the primary platform but design for cross-platform

**IMPORTANT**: This is a FULL replacement GUI for the terminal interface. Every feature accessible via the CLI must have an equivalent (or better) GUI representation. Do not skip any tools, hooks, skills, or features. The goal is to make the AI coding assistant fully accessible through a beautiful, intuitive desktop application.
