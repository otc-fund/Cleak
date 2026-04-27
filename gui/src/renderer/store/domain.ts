import { create } from 'zustand';

// ── Files (S4) ──────────────────────────────────────────────────────
interface FilesState {
  cwd: string;
}
export const useFiles = create<FilesState>(() => ({
  cwd: '',
}));

// ── Todos (S7) ──────────────────────────────────────────────────────
interface TodosState {
  count: number;
}
export const useTodos = create<TodosState>(() => ({
  count: 0,
}));

// ── Tasks / sub-agents (S7) ──────────────────────────────────────────
interface TasksState {
  activeCount: number;
}
export const useTasks = create<TasksState>(() => ({
  activeCount: 0,
}));

// ── Agents / swarms (S8) ────────────────────────────────────────────
interface AgentsState {
  activeCount: number;
}
export const useAgents = create<AgentsState>(() => ({
  activeCount: 0,
}));

// ── MCP (S9) ────────────────────────────────────────────────────────
interface McpState {
  connectedCount: number;
}
export const useMcp = create<McpState>(() => ({
  connectedCount: 0,
}));

// ── Git (S12) ───────────────────────────────────────────────────────
interface GitState {
  branch: string;
  changedFiles: number;
}
export const useGit = create<GitState>(() => ({
  branch: '',
  changedFiles: 0,
}));

// ── Permissions (S10) ───────────────────────────────────────────────
interface PermsState {
  pendingCount: number;
}
export const usePerms = create<PermsState>(() => ({
  pendingCount: 0,
}));
