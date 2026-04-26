// src/stores/memory.ts
import { randomUUID } from "crypto";

// src/types.ts
var DEFAULT_TENANT_ID = "default";

// src/stores/memory.ts
var MemoryStore = class {
  agents = /* @__PURE__ */ new Map();
  runs = /* @__PURE__ */ new Map();
  taskSessions = /* @__PURE__ */ new Map();
  runtimeStates = /* @__PURE__ */ new Map();
  costEvents = [];
  wakeupRequests = /* @__PURE__ */ new Map();
  // --- Agent operations ---
  async getAgent(id) {
    return this.agents.get(id) ?? null;
  }
  async updateAgent(id, patch) {
    const agent = this.agents.get(id);
    if (!agent) return;
    Object.assign(agent, patch, { updatedAt: /* @__PURE__ */ new Date() });
  }
  async createAgent(agent) {
    const now = /* @__PURE__ */ new Date();
    const full = {
      ...agent,
      id: agent.id || randomUUID(),
      tenantId: agent.tenantId || DEFAULT_TENANT_ID,
      createdAt: now,
      updatedAt: now
    };
    this.agents.set(full.id, full);
    return full;
  }
  // --- Run operations ---
  async createRun(input) {
    const now = /* @__PURE__ */ new Date();
    const run = {
      id: randomUUID(),
      tenantId: input.tenantId,
      agentId: input.agentId,
      invocationSource: input.invocationSource,
      triggerDetail: input.triggerDetail ?? null,
      status: "queued",
      startedAt: null,
      finishedAt: null,
      error: null,
      wakeupRequestId: input.wakeupRequestId ?? null,
      exitCode: null,
      signal: null,
      usageJson: null,
      resultJson: null,
      sessionIdBefore: null,
      sessionIdAfter: null,
      logStore: null,
      logRef: null,
      logBytes: null,
      logSha256: null,
      logCompressed: false,
      stdoutExcerpt: null,
      stderrExcerpt: null,
      errorCode: null,
      externalRunId: null,
      contextSnapshot: input.contextSnapshot ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.runs.set(run.id, run);
    return run;
  }
  async claimRun(runId) {
    const run = this.runs.get(runId);
    if (!run || run.status !== "queued") return null;
    run.status = "running";
    run.startedAt = /* @__PURE__ */ new Date();
    run.updatedAt = /* @__PURE__ */ new Date();
    return { ...run };
  }
  async updateRun(runId, patch) {
    const run = this.runs.get(runId);
    if (!run) return;
    Object.assign(run, patch, { updatedAt: /* @__PURE__ */ new Date() });
  }
  async getRun(runId) {
    const run = this.runs.get(runId);
    return run ? { ...run } : null;
  }
  async getQueuedRuns(agentId, limit) {
    return Array.from(this.runs.values()).filter((r) => r.agentId === agentId && r.status === "queued").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, limit);
  }
  async getRunningCount(agentId) {
    return Array.from(this.runs.values()).filter(
      (r) => r.agentId === agentId && r.status === "running"
    ).length;
  }
  async getLatestRunForSession(agentId, sessionId, excludeRunId) {
    const runs = Array.from(this.runs.values()).filter(
      (r) => r.agentId === agentId && r.sessionIdAfter === sessionId && r.id !== excludeRunId
    ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return runs[0] ?? null;
  }
  async getOldestRunForSession(agentId, sessionId) {
    const runs = Array.from(this.runs.values()).filter(
      (r) => r.agentId === agentId && r.sessionIdAfter === sessionId
    ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return runs[0] ? { id: runs[0].id, createdAt: runs[0].createdAt } : null;
  }
  // --- Session operations ---
  sessionKey(tenantId, agentId, adapterType, taskKey) {
    return `${tenantId}:${agentId}:${adapterType}:${taskKey}`;
  }
  async getTaskSession(tenantId, agentId, adapterType, taskKey) {
    return this.taskSessions.get(
      this.sessionKey(tenantId, agentId, adapterType, taskKey)
    ) ?? null;
  }
  async upsertTaskSession(session) {
    const key = this.sessionKey(
      session.tenantId,
      session.agentId,
      session.adapterType,
      session.taskKey
    );
    const existing = this.taskSessions.get(key);
    const now = /* @__PURE__ */ new Date();
    if (existing) {
      Object.assign(existing, session, {
        updatedAt: now,
        runCount: (existing.runCount ?? 0) + 1
      });
    } else {
      this.taskSessions.set(key, {
        id: randomUUID(),
        tenantId: session.tenantId,
        agentId: session.agentId,
        adapterType: session.adapterType,
        taskKey: session.taskKey,
        sessionParamsJson: session.sessionParamsJson ?? null,
        sessionDisplayId: session.sessionDisplayId ?? null,
        runCount: 1,
        totalRawInputTokens: 0,
        lastRunId: session.lastRunId ?? null,
        lastError: session.lastError ?? null,
        createdAt: now,
        updatedAt: now
      });
    }
  }
  async clearTaskSession(agentId, taskKey) {
    for (const [key, session] of this.taskSessions) {
      if (session.agentId === agentId && session.taskKey === taskKey) {
        this.taskSessions.delete(key);
      }
    }
  }
  // --- Runtime state ---
  async ensureRuntimeState(agentId, tenantId, adapterType) {
    let state = this.runtimeStates.get(agentId);
    if (!state) {
      const now = /* @__PURE__ */ new Date();
      state = {
        agentId,
        tenantId,
        adapterType,
        sessionId: null,
        stateJson: {},
        lastRunId: null,
        lastRunStatus: null,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCachedInputTokens: 0,
        totalCostCents: 0,
        lastError: null,
        createdAt: now,
        updatedAt: now
      };
      this.runtimeStates.set(agentId, state);
    }
    return { ...state };
  }
  async updateRuntimeState(agentId, patch) {
    const state = this.runtimeStates.get(agentId);
    if (!state) return;
    Object.assign(state, patch, { updatedAt: /* @__PURE__ */ new Date() });
  }
  async accumulateUsage(agentId, usage) {
    const state = this.runtimeStates.get(agentId);
    if (!state) return;
    state.totalInputTokens += usage.inputTokens;
    state.totalOutputTokens += usage.outputTokens;
    state.totalCachedInputTokens += usage.cachedInputTokens;
    state.updatedAt = /* @__PURE__ */ new Date();
  }
  // --- Cost tracking ---
  async recordCost(event) {
    this.costEvents.push({ ...event, id: randomUUID(), createdAt: /* @__PURE__ */ new Date() });
  }
  // --- Wakeup requests ---
  async createWakeupRequest(request) {
    const now = /* @__PURE__ */ new Date();
    const wr = {
      ...request,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    this.wakeupRequests.set(wr.id, wr);
    return wr;
  }
  async getWakeupRequest(id) {
    return this.wakeupRequests.get(id) ?? null;
  }
  async updateWakeupRequest(id, patch) {
    const wr = this.wakeupRequests.get(id);
    if (!wr) return;
    Object.assign(wr, patch, { updatedAt: /* @__PURE__ */ new Date() });
  }
  async getPendingWakeupRequests(agentId) {
    return Array.from(this.wakeupRequests.values()).filter(
      (wr) => wr.agentId === agentId && wr.status === "queued"
    );
  }
  // --- Utility ---
  getCostEvents() {
    return [...this.costEvents];
  }
  clear() {
    this.agents.clear();
    this.runs.clear();
    this.taskSessions.clear();
    this.runtimeStates.clear();
    this.costEvents = [];
    this.wakeupRequests.clear();
  }
};

export {
  DEFAULT_TENANT_ID,
  MemoryStore
};
//# sourceMappingURL=chunk-E3ZFI637.js.map