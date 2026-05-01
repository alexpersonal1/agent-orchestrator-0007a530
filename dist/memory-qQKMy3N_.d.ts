import { a as Agent, N as NewRun, R as Run, t as TaskSession, r as RuntimeState, v as UsageDelta, C as CostEvent, W as WakeupRequest } from './types-BaqRpRtt.js';

/**
 * Storage abstraction for the orchestrator.
 * Implement this interface to back the orchestrator with any database.
 */
interface OrchestratorStore {
    getAgent(id: string): Promise<Agent | null>;
    updateAgent(id: string, patch: Partial<Agent>): Promise<void>;
    createAgent(agent: Omit<Agent, "createdAt" | "updatedAt">): Promise<Agent>;
    createRun(run: NewRun): Promise<Run>;
    /** Atomically transition run from queued → running. Returns null if already claimed. */
    claimRun(runId: string): Promise<Run | null>;
    updateRun(runId: string, patch: Partial<Run>): Promise<void>;
    getRun(runId: string): Promise<Run | null>;
    getQueuedRuns(agentId: string, limit: number): Promise<Run[]>;
    getRunningCount(agentId: string): Promise<number>;
    getLatestRunForSession(agentId: string, sessionId: string, excludeRunId?: string): Promise<Run | null>;
    getOldestRunForSession(agentId: string, sessionId: string): Promise<{
        id: string;
        createdAt: Date;
    } | null>;
    getTaskSession(tenantId: string, agentId: string, adapterType: string, taskKey: string): Promise<TaskSession | null>;
    upsertTaskSession(session: Partial<TaskSession> & {
        tenantId: string;
        agentId: string;
        adapterType: string;
        taskKey: string;
    }): Promise<void>;
    clearTaskSession(agentId: string, taskKey: string): Promise<void>;
    ensureRuntimeState(agentId: string, tenantId: string, adapterType: string): Promise<RuntimeState>;
    updateRuntimeState(agentId: string, patch: Partial<RuntimeState>): Promise<void>;
    accumulateUsage(agentId: string, usage: UsageDelta): Promise<void>;
    recordCost(event: CostEvent): Promise<void>;
    createWakeupRequest(request: Omit<WakeupRequest, "id" | "createdAt" | "updatedAt">): Promise<WakeupRequest>;
    getWakeupRequest(id: string): Promise<WakeupRequest | null>;
    updateWakeupRequest(id: string, patch: Partial<WakeupRequest>): Promise<void>;
    getPendingWakeupRequests(agentId: string): Promise<WakeupRequest[]>;
}

/**
 * In-memory store for testing and simple use cases.
 * Not suitable for production — all data is lost on process exit.
 */
declare class MemoryStore implements OrchestratorStore {
    private agents;
    private runs;
    private taskSessions;
    private runtimeStates;
    private costEvents;
    private wakeupRequests;
    getAgent(id: string): Promise<Agent | null>;
    updateAgent(id: string, patch: Partial<Agent>): Promise<void>;
    createAgent(agent: Omit<Agent, "createdAt" | "updatedAt">): Promise<Agent>;
    createRun(input: NewRun): Promise<Run>;
    claimRun(runId: string): Promise<Run | null>;
    updateRun(runId: string, patch: Partial<Run>): Promise<void>;
    getRun(runId: string): Promise<Run | null>;
    getQueuedRuns(agentId: string, limit: number): Promise<Run[]>;
    getRunningCount(agentId: string): Promise<number>;
    getLatestRunForSession(agentId: string, sessionId: string, excludeRunId?: string): Promise<Run | null>;
    getOldestRunForSession(agentId: string, sessionId: string): Promise<{
        id: string;
        createdAt: Date;
    } | null>;
    private sessionKey;
    getTaskSession(tenantId: string, agentId: string, adapterType: string, taskKey: string): Promise<TaskSession | null>;
    upsertTaskSession(session: Partial<TaskSession> & {
        tenantId: string;
        agentId: string;
        adapterType: string;
        taskKey: string;
    }): Promise<void>;
    clearTaskSession(agentId: string, taskKey: string): Promise<void>;
    ensureRuntimeState(agentId: string, tenantId: string, adapterType: string): Promise<RuntimeState>;
    updateRuntimeState(agentId: string, patch: Partial<RuntimeState>): Promise<void>;
    accumulateUsage(agentId: string, usage: UsageDelta): Promise<void>;
    recordCost(event: CostEvent): Promise<void>;
    createWakeupRequest(request: Omit<WakeupRequest, "id" | "createdAt" | "updatedAt">): Promise<WakeupRequest>;
    getWakeupRequest(id: string): Promise<WakeupRequest | null>;
    updateWakeupRequest(id: string, patch: Partial<WakeupRequest>): Promise<void>;
    getPendingWakeupRequests(agentId: string): Promise<WakeupRequest[]>;
    getCostEvents(): CostEvent[];
    clear(): void;
}

export { MemoryStore as M, type OrchestratorStore as O };
