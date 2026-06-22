import { O as OrchestratorStore } from './memory-qQKMy3N_.js';
export { M as MemoryStore } from './memory-qQKMy3N_.js';
import { R as Run, A as AdapterExecutionResult, I as InvocationSource, T as TriggerDetail, a as Agent, b as ResolvedWorkspace, S as ServerAdapterModule, c as AdapterModel, d as AdapterSessionCodec, U as UsageSummary, e as SessionCompactionPolicy } from './types-BaqRpRtt.js';
export { f as AdapterAgent, g as AdapterBillingType, h as AdapterEnvironmentCheck, i as AdapterEnvironmentCheckLevel, j as AdapterEnvironmentTestContext, k as AdapterEnvironmentTestResult, l as AdapterEnvironmentTestStatus, m as AdapterExecutionContext, n as AdapterInvocationMeta, o as AdapterRuntime, p as AdapterRuntimeServiceReport, C as CostEvent, D as DEFAULT_TENANT_ID, N as NewRun, q as RunStatus, r as RuntimeState, s as StdoutLineParser, t as TaskSession, u as TranscriptEntry, v as UsageDelta, W as WakeupRequest, w as WakeupRequestStatus } from './types-BaqRpRtt.js';
import { ChildProcess } from 'node:child_process';
export { claudeLocalAdapter } from './adapters/claude-local/index.js';
export { codexLocalAdapter } from './adapters/codex-local/index.js';
export { cursorLocalAdapter } from './adapters/cursor-local/index.js';
export { default as geminiLocalAdapter } from './adapters/gemini-local/index.js';
export { default as opencodeLocalAdapter } from './adapters/opencode-local/index.js';
export { default as piLocalAdapter } from './adapters/pi-local/index.js';
export { default as openclawGatewayAdapter } from './adapters/openclaw-gateway/index.js';

interface OrchestratorEventMap {
    "run.queued": [run: Run];
    "run.started": [run: Run];
    "run.completed": [run: Run, result: AdapterExecutionResult];
    "run.failed": [run: Run, error: Error];
    "run.cancelled": [run: Run];
    "session.rotated": [agentId: string, taskKey: string, reason: string];
    "agent.status": [agentId: string, status: string];
}
type OrchestratorEventName = keyof OrchestratorEventMap;
/**
 * Typed event emitter for orchestrator lifecycle events.
 */
interface OrchestratorEventEmitter {
    on<E extends OrchestratorEventName>(event: E, listener: (...args: OrchestratorEventMap[E]) => void): void;
    off<E extends OrchestratorEventName>(event: E, listener: (...args: OrchestratorEventMap[E]) => void): void;
    emit<E extends OrchestratorEventName>(event: E, ...args: OrchestratorEventMap[E]): void;
}

/**
 * Run log handle — pointer to a log file/stream for a specific run.
 */
interface RunLogHandle {
    store: string;
    logRef: string;
}
interface RunLogReadOptions {
    offset?: number;
    limitBytes?: number;
}
interface RunLogReadResult {
    content: string;
    nextOffset?: number;
}
interface RunLogFinalizeSummary {
    bytes: number;
    sha256?: string;
    compressed: boolean;
}
/**
 * Run log storage interface.
 * Handles NDJSON log files for individual agent runs.
 */
interface RunLogger {
    begin(input: {
        tenantId: string;
        agentId: string;
        runId: string;
    }): Promise<RunLogHandle>;
    append(handle: RunLogHandle, event: {
        stream: "stdout" | "stderr" | "system";
        chunk: string;
        ts: string;
    }): Promise<void>;
    finalize(handle: RunLogHandle): Promise<RunLogFinalizeSummary>;
    read(handle: RunLogHandle, opts?: RunLogReadOptions): Promise<RunLogReadResult>;
}
/**
 * Structured logger interface (compatible with pino, console, etc.)
 */
interface Logger {
    info(msg: string): void;
    info(obj: Record<string, unknown>, msg: string): void;
    warn(msg: string): void;
    warn(obj: Record<string, unknown>, msg: string): void;
    error(msg: string): void;
    error(obj: Record<string, unknown>, msg: string): void;
    debug(msg: string): void;
    debug(obj: Record<string, unknown>, msg: string): void;
}

interface WakeupOptions {
    source?: InvocationSource;
    triggerDetail?: TriggerDetail;
    reason?: string | null;
    payload?: Record<string, unknown> | null;
    idempotencyKey?: string | null;
    requestedByActorType?: "user" | "agent" | "system";
    requestedByActorId?: string | null;
    contextSnapshot?: Record<string, unknown>;
}
interface SchedulerDeps {
    store: OrchestratorStore;
    events: OrchestratorEventEmitter;
    logger: Logger;
    executeRun: (runId: string) => Promise<void>;
}
/**
 * Create the scheduler — handles wakeup queuing, timer ticks, and concurrency control.
 * Adapted from Paperclip's heartbeat.ts enqueueWakeup/tickTimers/startNextQueuedRunForAgent.
 */
declare function createScheduler(deps: SchedulerDeps): {
    invoke: (agentId: string, opts?: WakeupOptions) => Promise<Run | null>;
    cancelRun: (runId: string) => Promise<boolean>;
    startNextQueuedRunForAgent: (agentId: string) => Promise<void>;
    start: (intervalMs?: number) => void;
    stop: () => void;
    tickTimers: () => Promise<void>;
};

interface RunContext {
    taskKey: string | null;
    contextSnapshot: Record<string, unknown> | null;
    sessionCwd?: string | null;
}
/**
 * Pluggable workspace resolution strategy.
 * Determines the working directory for agent runs.
 */
interface WorkspaceResolver {
    /**
     * Resolve the workspace for a given agent and run context.
     * Returns the resolved workspace metadata including the CWD path.
     */
    resolve(agent: Agent, context: RunContext): Promise<ResolvedWorkspace>;
    /**
     * Ensure the workspace directory exists and is ready for use.
     * Called after resolve() to materialize the workspace (create dirs, clone repos, etc.).
     * Returns the absolute path to the working directory.
     */
    realize(workspace: ResolvedWorkspace): Promise<string>;
}

interface TokenClaims {
    sub: string;
    tenant_id: string;
    adapter_type: string;
    run_id: string;
    iat: number;
    exp: number;
    iss?: string;
    aud?: string;
}
/**
 * Pluggable authentication provider for agent runs.
 * Generates short-lived JWT tokens that agents can use to call back into APIs.
 */
interface AuthProvider {
    createToken(agent: Agent, runId: string): string | null;
    verifyToken(token: string): TokenClaims | null;
}

interface DefaultAuthOptions {
    secret: string;
    ttlSeconds?: number;
    issuer?: string;
    audience?: string;
}
/**
 * Default HS256 JWT auth provider.
 * Adapted from Paperclip's agent-auth-jwt.ts.
 */
declare class DefaultAuth implements AuthProvider {
    private secret;
    private ttlSeconds;
    private issuer;
    private audience;
    constructor(opts: DefaultAuthOptions);
    createToken(agent: Agent, runId: string): string | null;
    verifyToken(token: string): TokenClaims | null;
}
/**
 * No-op auth provider that never generates tokens.
 */
declare class NoAuth implements AuthProvider {
    createToken(): string | null;
    verifyToken(): TokenClaims | null;
}

/**
 * Default NDJSON run log writer — stores logs as files on local disk.
 * Adapted from Paperclip's run-log-store.ts.
 */
declare class DefaultRunLogger implements RunLogger {
    private basePath;
    constructor(basePath: string);
    begin(input: {
        tenantId: string;
        agentId: string;
        runId: string;
    }): Promise<RunLogHandle>;
    append(handle: RunLogHandle, event: {
        stream: "stdout" | "stderr" | "system";
        chunk: string;
        ts: string;
    }): Promise<void>;
    finalize(handle: RunLogHandle): Promise<RunLogFinalizeSummary>;
    read(handle: RunLogHandle, opts?: RunLogReadOptions): Promise<RunLogReadResult>;
}
/**
 * No-op run logger that discards all log output.
 */
declare class NullRunLogger implements RunLogger {
    begin(input: {
        tenantId: string;
        agentId: string;
        runId: string;
    }): Promise<RunLogHandle>;
    append(): Promise<void>;
    finalize(): Promise<RunLogFinalizeSummary>;
    read(): Promise<RunLogReadResult>;
}

/**
 * Simple workspace resolver — uses a configured default CWD.
 * For more complex logic (project workspaces, git worktrees), implement WorkspaceResolver.
 */
declare class SimpleWorkspaceResolver implements WorkspaceResolver {
    private defaultCwd;
    private agentWorkspaceBase?;
    constructor(opts: {
        defaultCwd: string;
        agentWorkspaceBase?: string;
    });
    resolve(agent: Agent, context: RunContext): Promise<ResolvedWorkspace>;
    realize(workspace: ResolvedWorkspace): Promise<string>;
}

/**
 * Simple typed event emitter for orchestrator lifecycle events.
 */
declare class EventEmitter implements OrchestratorEventEmitter {
    private listeners;
    on<E extends OrchestratorEventName>(event: E, listener: (...args: OrchestratorEventMap[E]) => void): void;
    off<E extends OrchestratorEventName>(event: E, listener: (...args: OrchestratorEventMap[E]) => void): void;
    emit<E extends OrchestratorEventName>(event: E, ...args: OrchestratorEventMap[E]): void;
}

/**
 * Adapter registry — maps adapter type strings to adapter modules.
 * Adapted from Paperclip's server/src/adapters/registry.ts.
 */
declare class AdapterRegistry {
    private adaptersByType;
    constructor(adapters?: ServerAdapterModule[]);
    /**
     * Register an adapter module.
     */
    register(adapter: ServerAdapterModule): void;
    /**
     * Get an adapter by type. Throws if not found.
     */
    get(type: string): ServerAdapterModule;
    /**
     * Find an adapter by type. Returns null if not found.
     */
    find(type: string): ServerAdapterModule | null;
    /**
     * List all registered adapter types.
     */
    listTypes(): string[];
    /**
     * List all registered adapter modules.
     */
    listAll(): ServerAdapterModule[];
    /**
     * List models for a given adapter type.
     */
    listModels(type: string): Promise<AdapterModel[]>;
    /**
     * List models for all registered adapters.
     */
    listAllModels(): Promise<Array<{
        adapterType: string;
        models: AdapterModel[];
    }>>;
}

interface ExecutorDeps {
    store: OrchestratorStore;
    getAdapter: (type: string) => ServerAdapterModule;
    workspace: WorkspaceResolver;
    auth: AuthProvider;
    runLogger: RunLogger;
    logger: Logger;
    events: OrchestratorEventEmitter;
}
/**
 * Core run executor — the 15-step orchestration flow.
 * Adapted from Paperclip's heartbeat.ts executeRun().
 *
 * Steps:
 * 1. Claim run (queued → running)
 * 2. Resolve agent
 * 3. Resolve task key
 * 4. Resolve workspace
 * 5. Resolve session (load previous, check compaction)
 * 6. Resolve adapter config
 * 7. Realize workspace (create dirs)
 * 8. Generate auth token
 * 9. Dispatch to adapter
 * 10. Process result
 * 11. Persist session
 * 12. Record costs
 * 13. Update runtime state
 * 14. Release locks
 * 15. Finalize
 */
declare function executeRun(runId: string, deps: ExecutorDeps): Promise<AdapterExecutionResult | null>;

/**
 * Default session codec — passthrough with sessionId extraction.
 */
declare const defaultSessionCodec: AdapterSessionCodec;
/**
 * Parse session compaction policy from agent runtime config.
 */
declare function parseSessionCompactionPolicy(adapterType: string, runtimeConfig: Record<string, unknown> | null | undefined): SessionCompactionPolicy;
/**
 * Determine if a wake context should force a fresh session.
 */
declare function shouldResetTaskSessionForWake(contextSnapshot: Record<string, unknown> | null | undefined): boolean;
/**
 * Derive a task key from context or payload.
 */
declare function deriveTaskKey(contextSnapshot: Record<string, unknown> | null | undefined, payload: Record<string, unknown> | null | undefined): string | null;
/**
 * Resolve next session state from adapter execution result.
 */
declare function resolveNextSessionState(input: {
    codec: AdapterSessionCodec;
    adapterResult: AdapterExecutionResult;
    previousParams: Record<string, unknown> | null;
    previousDisplayId: string | null;
    previousLegacySessionId: string | null;
}): {
    params: Record<string, unknown> | null;
    displayId: string | null;
    legacySessionId: string | null;
};
/**
 * Normalize raw usage totals from a run result.
 */
declare function normalizeUsageTotals(usage: UsageSummary | null | undefined): {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
} | null;
/**
 * Enrich a wake context snapshot with additional fields from payload.
 */
declare function enrichWakeContextSnapshot(input: {
    contextSnapshot: Record<string, unknown>;
    reason: string | null;
    source: string | undefined;
    triggerDetail: string | null;
    payload: Record<string, unknown> | null;
}): {
    contextSnapshot: Record<string, unknown>;
    taskKey: string | null;
};

interface RunProcessResult {
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    stdout: string;
    stderr: string;
}
interface RunningProcess {
    child: ChildProcess;
    graceSec: number;
}
declare const runningProcesses: Map<string, RunningProcess>;
declare function runChildProcess(runId: string, command: string, args: string[], opts: {
    cwd: string;
    env: Record<string, string>;
    timeoutSec: number;
    graceSec: number;
    onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
    onLogError?: (err: unknown, runId: string, message: string) => void;
    stdin?: string;
}): Promise<RunProcessResult>;

declare function defaultPathForPlatform(): "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem" | "/usr/local/bin:/opt/homebrew/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin";
declare function ensurePathInEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
/**
 * Build environment variables for agent runs.
 * Configurable prefix (defaults to "ORCHESTRATOR").
 */
declare function buildAgentEnv(agent: {
    id: string;
    tenantId: string;
}, opts?: {
    envPrefix?: string;
    apiUrl?: string;
    listenHost?: string;
    listenPort?: string;
}): Record<string, string>;
declare function ensureAbsoluteDirectory(cwd: string, opts?: {
    createIfMissing?: boolean;
}): Promise<void>;
declare function ensureCommandResolvable(command: string, cwd: string, env: NodeJS.ProcessEnv): Promise<void>;

declare function resolvePathValue(obj: Record<string, unknown>, dottedPath: string): string;
declare function renderTemplate(template: string, data: Record<string, unknown>): string;
declare function joinPromptSections(sections: Array<string | null | undefined>, separator?: string): string;
declare function redactEnvForLogs(env: Record<string, string>): Record<string, string>;

interface SkillEntry {
    name: string;
    source: string;
}
declare function resolveSkillsDir(moduleDir: string, additionalCandidates?: string[]): Promise<string | null>;
declare function listSkillEntries(moduleDir: string, additionalCandidates?: string[]): Promise<SkillEntry[]>;
declare function readSkillMarkdown(moduleDir: string, skillName: string): Promise<string | null>;
declare function ensureSkillSymlink(source: string, target: string, linkSkill?: (source: string, target: string) => Promise<void>): Promise<"created" | "repaired" | "skipped">;
declare function removeMaintainerOnlySkillSymlinks(skillsHome: string, allowedSkillNames: Iterable<string>): Promise<string[]>;

declare const MAX_CAPTURE_BYTES: number;
declare const MAX_EXCERPT_BYTES: number;
declare function parseObject(value: unknown): Record<string, unknown>;
declare function asString(value: unknown, fallback: string): string;
declare function asNumber(value: unknown, fallback: number): number;
declare function asBoolean(value: unknown, fallback: boolean): boolean;
declare function asStringArray(value: unknown): string[];
declare function parseJson(value: string): Record<string, unknown> | null;
declare function appendWithCap(prev: string, chunk: string, cap?: number): string;

/**
 * All bundled adapter modules, keyed by their type string.
 *
 * @example
 * ```ts
 * import { adapters } from 'agent-orchestrator';
 * const orchestrator = createOrchestrator({
 *   adapters: Object.values(adapters),
 * });
 * ```
 */
declare const adapters: {
    readonly claudeLocal: ServerAdapterModule;
    readonly codexLocal: ServerAdapterModule;
    readonly cursorLocal: ServerAdapterModule;
    readonly geminiLocal: ServerAdapterModule;
    readonly opencodeLocal: ServerAdapterModule;
    readonly piLocal: ServerAdapterModule;
    readonly openclawGateway: ServerAdapterModule;
};

interface OrchestratorOptions {
    /** Storage backend (required). Use MemoryStore for testing. */
    store?: OrchestratorStore;
    /** Registered adapter modules. */
    adapters?: ServerAdapterModule[];
    /** Workspace resolution strategy. */
    workspace?: WorkspaceResolver | {
        defaultCwd: string;
        agentWorkspaceBase?: string;
    };
    /** Authentication provider for agent JWT tokens. */
    auth?: AuthProvider | {
        secret: string;
        ttlSeconds?: number;
    };
    /** Run log storage. */
    runLogger?: RunLogger;
    /** Structured logger. */
    logger?: Logger;
}
interface Orchestrator {
    /** Execute a run by ID. */
    executeRun(runId: string): Promise<AdapterExecutionResult | null>;
    /** Invoke an agent — queue a run and start it. */
    invoke(agentId: string, opts?: WakeupOptions): Promise<Run | null>;
    /** Register a new agent. tenantId defaults to "default" if omitted. */
    registerAgent(agent: Omit<Agent, "id" | "tenantId" | "createdAt" | "updatedAt"> & {
        id?: string;
        tenantId?: string;
    }): Promise<Agent>;
    /** Cancel a run. */
    cancelRun(runId: string): Promise<boolean>;
    /** Start the scheduler timer. */
    start(intervalMs?: number): void;
    /** Stop the scheduler timer. */
    stop(): void;
    /** Tick timers manually. */
    tickTimers(): Promise<void>;
    /** List models across all adapters. */
    listModels(): Promise<Array<{
        adapterType: string;
        models: AdapterModel[];
    }>>;
    /** Subscribe to events. */
    on: EventEmitter["on"];
    /** Unsubscribe from events. */
    off: EventEmitter["off"];
    /** The underlying store. */
    readonly store: OrchestratorStore;
    /** The adapter registry. */
    readonly registry: AdapterRegistry;
    /** The event emitter. */
    readonly events: EventEmitter;
}
/**
 * Create a fully-wired orchestrator instance.
 *
 * @example
 * ```typescript
 * import { createOrchestrator, MemoryStore } from 'agent-orchestrator';
 *
 * const orchestrator = createOrchestrator({
 *   store: new MemoryStore(),
 *   adapters: [myClaudeAdapter],
 *   workspace: { defaultCwd: '/workspace' },
 * });
 *
 * const agent = await orchestrator.registerAgent({
 *   name: 'my-agent',
 *   tenantId: 'company-1',
 *   adapterType: 'claude_local',
 *   adapterConfig: { model: 'opus' },
 * });
 *
 * const run = await orchestrator.invoke(agent.id);
 * ```
 */
declare function createOrchestrator(opts?: OrchestratorOptions): Orchestrator;

export { AdapterExecutionResult, AdapterModel, AdapterRegistry, AdapterSessionCodec, Agent, type AuthProvider, DefaultAuth, type DefaultAuthOptions, DefaultRunLogger, EventEmitter, type ExecutorDeps, InvocationSource, type Logger, MAX_CAPTURE_BYTES, MAX_EXCERPT_BYTES, NoAuth, NullRunLogger, type Orchestrator, type OrchestratorEventEmitter, type OrchestratorEventMap, type OrchestratorEventName, type OrchestratorOptions, OrchestratorStore, ResolvedWorkspace, Run, type RunContext, type RunLogFinalizeSummary, type RunLogHandle, type RunLogReadOptions, type RunLogReadResult, type RunLogger, type RunProcessResult, type SchedulerDeps, ServerAdapterModule, SessionCompactionPolicy, SimpleWorkspaceResolver, type SkillEntry, type TokenClaims, TriggerDetail, UsageSummary, type WakeupOptions, type WorkspaceResolver, adapters, appendWithCap, asBoolean, asNumber, asString, asStringArray, buildAgentEnv, createOrchestrator, createScheduler, defaultPathForPlatform, defaultSessionCodec, deriveTaskKey, enrichWakeContextSnapshot, ensureAbsoluteDirectory, ensureCommandResolvable, ensurePathInEnv, ensureSkillSymlink, executeRun, joinPromptSections, listSkillEntries, normalizeUsageTotals, parseJson, parseObject, parseSessionCompactionPolicy, readSkillMarkdown, redactEnvForLogs, removeMaintainerOnlySkillSymlinks, renderTemplate, resolveNextSessionState, resolvePathValue, resolveSkillsDir, runChildProcess, runningProcesses, shouldResetTaskSessionForWake };
