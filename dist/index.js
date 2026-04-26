import {
  piLocalAdapter
} from "./chunk-TUCEHFAT.js";
import {
  DEFAULT_TENANT_ID,
  MemoryStore
} from "./chunk-E3ZFI637.js";
import {
  claudeLocalAdapter
} from "./chunk-SJV32BCH.js";
import {
  codexLocalAdapter
} from "./chunk-RUJBTHTG.js";
import {
  cursorLocalAdapter
} from "./chunk-OP6G2H2C.js";
import {
  geminiLocalAdapter
} from "./chunk-5IPQRQ2X.js";
import {
  openclawGatewayAdapter
} from "./chunk-RRD33L5L.js";
import {
  opencodeLocalAdapter
} from "./chunk-FJ7EPP36.js";
import {
  MAX_CAPTURE_BYTES,
  MAX_EXCERPT_BYTES,
  appendWithCap,
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  buildAgentEnv,
  defaultPathForPlatform,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  ensureSkillSymlink,
  joinPromptSections,
  listSkillEntries,
  parseJson,
  parseObject,
  readSkillMarkdown,
  redactEnvForLogs,
  removeMaintainerOnlySkillSymlinks,
  renderTemplate,
  resolvePathValue,
  resolveSkillsDir,
  runChildProcess,
  runningProcesses
} from "./chunk-Z6GQFNVV.js";

// src/auth.ts
import { createHmac, timingSafeEqual } from "crypto";
var JWT_ALGORITHM = "HS256";
function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}
function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}
function signPayload(secret, signingInput) {
  return createHmac("sha256", secret).update(signingInput).digest("base64url");
}
function parseJsonSafe(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function safeCompare(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
var DefaultAuth = class {
  secret;
  ttlSeconds;
  issuer;
  audience;
  constructor(opts) {
    this.secret = opts.secret;
    this.ttlSeconds = opts.ttlSeconds ?? 60 * 60 * 48;
    this.issuer = opts.issuer ?? "agent-orchestrator";
    this.audience = opts.audience ?? "agent-orchestrator-api";
  }
  createToken(agent, runId) {
    if (!this.secret) return null;
    const now = Math.floor(Date.now() / 1e3);
    const claims = {
      sub: agent.id,
      tenant_id: agent.tenantId,
      adapter_type: agent.adapterType,
      run_id: runId,
      iat: now,
      exp: now + this.ttlSeconds,
      iss: this.issuer,
      aud: this.audience
    };
    const header = { alg: JWT_ALGORITHM, typ: "JWT" };
    const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;
    const signature = signPayload(this.secret, signingInput);
    return `${signingInput}.${signature}`;
  }
  verifyToken(token) {
    if (!token || !this.secret) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, claimsB64, signature] = parts;
    const header = parseJsonSafe(base64UrlDecode(headerB64));
    if (!header || header.alg !== JWT_ALGORITHM) return null;
    const signingInput = `${headerB64}.${claimsB64}`;
    const expectedSig = signPayload(this.secret, signingInput);
    if (!safeCompare(signature, expectedSig)) return null;
    const claims = parseJsonSafe(base64UrlDecode(claimsB64));
    if (!claims) return null;
    const sub = typeof claims.sub === "string" ? claims.sub : null;
    const tenantId = typeof claims.tenant_id === "string" ? claims.tenant_id : null;
    const adapterType = typeof claims.adapter_type === "string" ? claims.adapter_type : null;
    const runId = typeof claims.run_id === "string" ? claims.run_id : null;
    const iat = typeof claims.iat === "number" ? claims.iat : null;
    const exp = typeof claims.exp === "number" ? claims.exp : null;
    if (!sub || !tenantId || !adapterType || !runId || !iat || !exp)
      return null;
    const now = Math.floor(Date.now() / 1e3);
    if (exp < now) return null;
    const issuer = typeof claims.iss === "string" ? claims.iss : void 0;
    const audience = typeof claims.aud === "string" ? claims.aud : void 0;
    if (issuer && issuer !== this.issuer) return null;
    if (audience && audience !== this.audience) return null;
    return {
      sub,
      tenant_id: tenantId,
      adapter_type: adapterType,
      run_id: runId,
      iat,
      exp,
      ...issuer ? { iss: issuer } : {},
      ...audience ? { aud: audience } : {}
    };
  }
};
var NoAuth = class {
  createToken() {
    return null;
  }
  verifyToken() {
    return null;
  }
};

// src/run-log.ts
import { createReadStream, promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
function safeSegments(...segments) {
  return segments.map(
    (segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "_")
  );
}
function resolveWithin(basePath, relativePath) {
  const resolved = path.resolve(basePath, relativePath);
  const base = path.resolve(basePath) + path.sep;
  if (!resolved.startsWith(base) && resolved !== path.resolve(basePath)) {
    throw new Error("Invalid log path");
  }
  return resolved;
}
var DefaultRunLogger = class {
  basePath;
  constructor(basePath) {
    this.basePath = basePath;
  }
  async begin(input) {
    const [tenantId, agentId] = safeSegments(input.tenantId, input.agentId);
    const runId = safeSegments(input.runId)[0];
    const relDir = path.join(tenantId, agentId);
    const relPath = path.join(relDir, `${runId}.ndjson`);
    const dir = resolveWithin(this.basePath, relDir);
    await fs.mkdir(dir, { recursive: true });
    const absPath = resolveWithin(this.basePath, relPath);
    await fs.writeFile(absPath, "", "utf8");
    return { store: "local_file", logRef: relPath };
  }
  async append(handle, event) {
    if (handle.store !== "local_file") return;
    const absPath = resolveWithin(this.basePath, handle.logRef);
    const line = JSON.stringify({
      ts: event.ts,
      stream: event.stream,
      chunk: event.chunk
    });
    await fs.appendFile(absPath, `${line}
`, "utf8");
  }
  async finalize(handle) {
    if (handle.store !== "local_file") {
      return { bytes: 0, compressed: false };
    }
    const absPath = resolveWithin(this.basePath, handle.logRef);
    const stat = await fs.stat(absPath).catch(() => null);
    if (!stat) throw new Error("Run log not found");
    const hash = await new Promise((resolve, reject) => {
      const h = createHash("sha256");
      const stream = createReadStream(absPath);
      stream.on("data", (chunk) => h.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(h.digest("hex")));
    });
    return {
      bytes: stat.size,
      sha256: hash,
      compressed: false
    };
  }
  async read(handle, opts) {
    if (handle.store !== "local_file") {
      throw new Error("Run log not found");
    }
    const absPath = resolveWithin(this.basePath, handle.logRef);
    const offset = opts?.offset ?? 0;
    const limitBytes = opts?.limitBytes ?? 256e3;
    const stat = await fs.stat(absPath).catch(() => null);
    if (!stat) throw new Error("Run log not found");
    const start = Math.max(0, Math.min(offset, stat.size));
    const end = Math.max(start, Math.min(start + limitBytes - 1, stat.size - 1));
    if (start > end) {
      return { content: "", nextOffset: start };
    }
    const chunks = [];
    await new Promise((resolve, reject) => {
      const stream = createReadStream(absPath, { start, end });
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("error", reject);
      stream.on("end", () => resolve());
    });
    const content = Buffer.concat(chunks).toString("utf8");
    const nextOffset = end + 1 < stat.size ? end + 1 : void 0;
    return { content, nextOffset };
  }
};
var NullRunLogger = class {
  async begin(input) {
    return { store: "null", logRef: `${input.tenantId}/${input.agentId}/${input.runId}` };
  }
  async append() {
  }
  async finalize() {
    return { bytes: 0, compressed: false };
  }
  async read() {
    return { content: "" };
  }
};

// src/workspace.ts
import path2 from "path";
import { promises as fs2 } from "fs";
var SimpleWorkspaceResolver = class {
  defaultCwd;
  agentWorkspaceBase;
  constructor(opts) {
    this.defaultCwd = opts.defaultCwd;
    this.agentWorkspaceBase = opts.agentWorkspaceBase;
  }
  async resolve(agent, context) {
    if (context.sessionCwd) {
      return {
        cwd: context.sessionCwd,
        source: "task_session",
        warnings: []
      };
    }
    if (this.agentWorkspaceBase) {
      const agentDir = path2.join(this.agentWorkspaceBase, agent.id);
      return {
        cwd: agentDir,
        source: "agent_home",
        warnings: []
      };
    }
    return {
      cwd: this.defaultCwd,
      source: "configured",
      warnings: []
    };
  }
  async realize(workspace) {
    const cwd = workspace.cwd;
    try {
      const stats = await fs2.stat(cwd);
      if (!stats.isDirectory()) {
        throw new Error(`Workspace path is not a directory: "${cwd}"`);
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        await fs2.mkdir(cwd, { recursive: true });
      } else {
        throw err;
      }
    }
    return cwd;
  }
};

// src/events.ts
var EventEmitter = class {
  listeners = /* @__PURE__ */ new Map();
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(listener);
  }
  off(event, listener) {
    this.listeners.get(event)?.delete(listener);
  }
  emit(event, ...args) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch {
      }
    }
  }
};

// src/adapters/registry.ts
var AdapterRegistry = class {
  adaptersByType = /* @__PURE__ */ new Map();
  constructor(adapters2 = []) {
    for (const adapter of adapters2) {
      this.adaptersByType.set(adapter.type, adapter);
    }
  }
  /**
   * Register an adapter module.
   */
  register(adapter) {
    this.adaptersByType.set(adapter.type, adapter);
  }
  /**
   * Get an adapter by type. Throws if not found.
   */
  get(type) {
    const adapter = this.adaptersByType.get(type);
    if (!adapter) {
      throw new Error(`Unknown adapter type: "${type}". Available: ${this.listTypes().join(", ")}`);
    }
    return adapter;
  }
  /**
   * Find an adapter by type. Returns null if not found.
   */
  find(type) {
    return this.adaptersByType.get(type) ?? null;
  }
  /**
   * List all registered adapter types.
   */
  listTypes() {
    return Array.from(this.adaptersByType.keys());
  }
  /**
   * List all registered adapter modules.
   */
  listAll() {
    return Array.from(this.adaptersByType.values());
  }
  /**
   * List models for a given adapter type.
   */
  async listModels(type) {
    const adapter = this.adaptersByType.get(type);
    if (!adapter) return [];
    if (adapter.listModels) {
      const discovered = await adapter.listModels();
      if (discovered.length > 0) return discovered;
    }
    return adapter.models ?? [];
  }
  /**
   * List models for all registered adapters.
   */
  async listAllModels() {
    const results = [];
    for (const adapter of this.adaptersByType.values()) {
      const models = await this.listModels(adapter.type);
      results.push({ adapterType: adapter.type, models });
    }
    return results;
  }
};

// src/session.ts
function readNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function truncateDisplayId(value, max = 128) {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}
function normalizeSessionParams(params) {
  if (!params) return null;
  return Object.keys(params).length > 0 ? params : null;
}
var SESSIONED_LOCAL_ADAPTERS = /* @__PURE__ */ new Set([
  "claude_local",
  "codex_local",
  "cursor",
  "gemini_local",
  "opencode_local",
  "pi_local"
]);
var defaultSessionCodec = {
  deserialize(raw) {
    const asObj = parseObject(raw);
    if (Object.keys(asObj).length > 0) return asObj;
    const sessionId = readNonEmptyString(
      raw?.sessionId
    );
    if (sessionId) return { sessionId };
    return null;
  },
  serialize(params) {
    if (!params || Object.keys(params).length === 0) return null;
    return params;
  },
  getDisplayId(params) {
    return readNonEmptyString(params?.sessionId);
  }
};
function parseSessionCompactionPolicy(adapterType, runtimeConfig) {
  const rc = parseObject(runtimeConfig);
  const heartbeat = parseObject(rc.heartbeat);
  const compaction = parseObject(
    heartbeat.sessionCompaction ?? heartbeat.sessionRotation ?? rc.sessionCompaction
  );
  const supportsSessions = SESSIONED_LOCAL_ADAPTERS.has(adapterType);
  const enabled = compaction.enabled === void 0 ? supportsSessions : asBoolean(compaction.enabled, supportsSessions);
  return {
    enabled,
    maxSessionRuns: Math.max(
      0,
      Math.floor(asNumber(compaction.maxSessionRuns, 200))
    ),
    maxRawInputTokens: Math.max(
      0,
      Math.floor(asNumber(compaction.maxRawInputTokens, 2e6))
    ),
    maxSessionAgeHours: Math.max(
      0,
      Math.floor(asNumber(compaction.maxSessionAgeHours, 72))
    )
  };
}
function shouldResetTaskSessionForWake(contextSnapshot) {
  if (contextSnapshot?.forceFreshSession === true) return true;
  const wakeReason = readNonEmptyString(contextSnapshot?.wakeReason);
  if (wakeReason === "issue_assigned") return true;
  return false;
}
function deriveTaskKey(contextSnapshot, payload) {
  return readNonEmptyString(contextSnapshot?.taskKey) ?? readNonEmptyString(contextSnapshot?.taskId) ?? readNonEmptyString(contextSnapshot?.issueId) ?? readNonEmptyString(payload?.taskKey) ?? readNonEmptyString(payload?.taskId) ?? readNonEmptyString(payload?.issueId) ?? null;
}
function resolveNextSessionState(input) {
  const {
    codec,
    adapterResult,
    previousParams,
    previousDisplayId,
    previousLegacySessionId
  } = input;
  if (adapterResult.clearSession) {
    return {
      params: null,
      displayId: null,
      legacySessionId: null
    };
  }
  const explicitParams = adapterResult.sessionParams;
  const hasExplicitParams = adapterResult.sessionParams !== void 0;
  const hasExplicitSessionId = adapterResult.sessionId !== void 0;
  const explicitSessionId = readNonEmptyString(adapterResult.sessionId);
  const hasExplicitDisplay = adapterResult.sessionDisplayId !== void 0;
  const explicitDisplayId = readNonEmptyString(adapterResult.sessionDisplayId);
  const shouldUsePrevious = !hasExplicitParams && !hasExplicitSessionId && !hasExplicitDisplay;
  const candidateParams = hasExplicitParams ? explicitParams : hasExplicitSessionId ? explicitSessionId ? { sessionId: explicitSessionId } : null : previousParams;
  const serialized = normalizeSessionParams(
    codec.serialize(normalizeSessionParams(candidateParams) ?? null)
  );
  const deserialized = normalizeSessionParams(codec.deserialize(serialized));
  const displayId = truncateDisplayId(
    explicitDisplayId ?? (codec.getDisplayId ? codec.getDisplayId(deserialized) : null) ?? readNonEmptyString(deserialized?.sessionId) ?? (shouldUsePrevious ? previousDisplayId : null) ?? explicitSessionId ?? (shouldUsePrevious ? previousLegacySessionId : null)
  );
  const legacySessionId = explicitSessionId ?? readNonEmptyString(deserialized?.sessionId) ?? displayId ?? (shouldUsePrevious ? previousLegacySessionId : null);
  return {
    params: serialized,
    displayId,
    legacySessionId
  };
}
function normalizeUsageTotals(usage) {
  if (!usage) return null;
  return {
    inputTokens: Math.max(0, Math.floor(asNumber(usage.inputTokens, 0))),
    cachedInputTokens: Math.max(
      0,
      Math.floor(asNumber(usage.cachedInputTokens, 0))
    ),
    outputTokens: Math.max(0, Math.floor(asNumber(usage.outputTokens, 0)))
  };
}
function enrichWakeContextSnapshot(input) {
  const { contextSnapshot, reason, source, triggerDetail, payload } = input;
  const taskKey = deriveTaskKey(contextSnapshot, payload);
  if (!readNonEmptyString(contextSnapshot["wakeReason"]) && reason) {
    contextSnapshot.wakeReason = reason;
  }
  const issueId = readNonEmptyString(payload?.issueId);
  if (!readNonEmptyString(contextSnapshot["issueId"]) && issueId) {
    contextSnapshot.issueId = issueId;
  }
  if (!readNonEmptyString(contextSnapshot["taskKey"]) && taskKey) {
    contextSnapshot.taskKey = taskKey;
  }
  if (!readNonEmptyString(contextSnapshot["wakeSource"]) && source) {
    contextSnapshot.wakeSource = source;
  }
  if (!readNonEmptyString(contextSnapshot["wakeTriggerDetail"]) && triggerDetail) {
    contextSnapshot.wakeTriggerDetail = triggerDetail;
  }
  return { contextSnapshot, taskKey };
}

// src/executor.ts
var MAX_LIVE_LOG_CHUNK_BYTES = 8 * 1024;
function readNonEmptyString2(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function appendExcerpt(prev, chunk) {
  return appendWithCap(prev, chunk, MAX_EXCERPT_BYTES);
}
async function executeRun(runId, deps) {
  const { store, getAdapter, workspace, auth, runLogger, logger, events } = deps;
  let run = await store.getRun(runId);
  if (!run) return null;
  if (run.status !== "queued" && run.status !== "running") return null;
  if (run.status === "queued") {
    const claimed = await store.claimRun(runId);
    if (!claimed) return null;
    run = claimed;
  }
  events.emit("run.started", run);
  let handle = null;
  let stdoutExcerpt = "";
  let stderrExcerpt = "";
  try {
    const agent = await store.getAgent(run.agentId);
    if (!agent) {
      await store.updateRun(runId, {
        status: "failed",
        error: "Agent not found",
        errorCode: "agent_not_found",
        finishedAt: /* @__PURE__ */ new Date()
      });
      return null;
    }
    await store.ensureRuntimeState(agent.id, agent.tenantId, agent.adapterType);
    const context = parseObject(run.contextSnapshot);
    const taskKey = deriveTaskKey(context, null);
    const adapter = getAdapter(agent.adapterType);
    const sessionCodec = adapter.sessionCodec ?? defaultSessionCodec;
    const resetSession = shouldResetTaskSessionForWake(context);
    const taskSession = taskKey && !resetSession ? await store.getTaskSession(
      agent.tenantId,
      agent.id,
      agent.adapterType,
      taskKey
    ) : null;
    const previousSessionParams = taskSession?.sessionParamsJson ? sessionCodec.deserialize(taskSession.sessionParamsJson) : null;
    const compactionPolicy = parseSessionCompactionPolicy(
      agent.adapterType,
      agent.runtimeConfig
    );
    const previousSessionDisplayId = taskSession?.sessionDisplayId ?? null;
    let runtimeSessionId = readNonEmptyString2(previousSessionParams?.sessionId);
    let runtimeSessionParams = previousSessionParams;
    let sessionRotated = false;
    let sessionRotationReason = null;
    if (compactionPolicy.enabled && taskSession && runtimeSessionId) {
      const shouldRotate = taskSession.runCount >= compactionPolicy.maxSessionRuns || taskSession.totalRawInputTokens >= compactionPolicy.maxRawInputTokens;
      if (shouldRotate) {
        sessionRotated = true;
        sessionRotationReason = taskSession.runCount >= compactionPolicy.maxSessionRuns ? `session run count (${taskSession.runCount}) exceeds limit (${compactionPolicy.maxSessionRuns})` : `session token usage (${taskSession.totalRawInputTokens}) exceeds limit (${compactionPolicy.maxRawInputTokens})`;
        runtimeSessionId = null;
        runtimeSessionParams = null;
        events.emit("session.rotated", agent.id, taskKey ?? "", sessionRotationReason);
      }
    }
    const resolvedConfig = parseObject(agent.adapterConfig);
    const resolvedWorkspace = await workspace.resolve(agent, {
      taskKey,
      contextSnapshot: context,
      sessionCwd: readNonEmptyString2(previousSessionParams?.cwd)
    });
    const cwd = await workspace.realize(resolvedWorkspace);
    context.workspace = {
      cwd,
      source: resolvedWorkspace.source,
      projectId: resolvedWorkspace.projectId,
      workspaceId: resolvedWorkspace.workspaceId,
      repoUrl: resolvedWorkspace.repoUrl,
      repoRef: resolvedWorkspace.repoRef
    };
    const authToken = adapter.supportsLocalAgentJwt ? auth.createToken(agent, run.id) : null;
    const runtimeForAdapter = {
      sessionId: runtimeSessionId,
      sessionParams: runtimeSessionParams,
      sessionDisplayId: previousSessionDisplayId,
      taskKey
    };
    await store.updateRun(run.id, {
      startedAt: run.startedAt ?? /* @__PURE__ */ new Date(),
      sessionIdBefore: runtimeForAdapter.sessionDisplayId ?? runtimeForAdapter.sessionId,
      contextSnapshot: context
    });
    handle = await runLogger.begin({
      tenantId: run.tenantId,
      agentId: run.agentId,
      runId
    });
    await store.updateRun(run.id, {
      logStore: handle.store,
      logRef: handle.logRef
    });
    const onLog = async (stream, chunk) => {
      if (stream === "stdout")
        stdoutExcerpt = appendExcerpt(stdoutExcerpt, chunk);
      if (stream === "stderr")
        stderrExcerpt = appendExcerpt(stderrExcerpt, chunk);
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      if (handle) {
        await runLogger.append(handle, { stream, chunk, ts });
      }
    };
    for (const warning of resolvedWorkspace.warnings) {
      await onLog("stderr", `[orchestrator] ${warning}
`);
    }
    if (resetSession) {
      await onLog(
        "stderr",
        `[orchestrator] Starting fresh session (reset requested)
`
      );
    }
    if (sessionRotated && sessionRotationReason) {
      await onLog(
        "stderr",
        `[orchestrator] Starting fresh session: ${sessionRotationReason}
`
      );
    }
    const onAdapterMeta = async (_meta) => {
    };
    logger.info(
      { runId, agentId: agent.id, adapter: agent.adapterType },
      "dispatching run to adapter"
    );
    const adapterResult = await adapter.execute({
      runId: run.id,
      agent: {
        id: agent.id,
        tenantId: agent.tenantId,
        name: agent.name,
        adapterType: agent.adapterType,
        adapterConfig: agent.adapterConfig
      },
      runtime: runtimeForAdapter,
      config: resolvedConfig,
      context,
      onLog,
      onMeta: onAdapterMeta,
      authToken: authToken ?? void 0
    });
    const nextSessionState = resolveNextSessionState({
      codec: sessionCodec,
      adapterResult,
      previousParams: previousSessionParams,
      previousDisplayId: runtimeForAdapter.sessionDisplayId,
      previousLegacySessionId: runtimeForAdapter.sessionId
    });
    const rawUsage = normalizeUsageTotals(adapterResult.usage);
    let outcome;
    const latestRun = await store.getRun(run.id);
    if (latestRun?.status === "cancelled") {
      outcome = "cancelled";
    } else if (adapterResult.timedOut) {
      outcome = "timed_out";
    } else if ((adapterResult.exitCode ?? 0) === 0 && !adapterResult.errorMessage) {
      outcome = "succeeded";
    } else {
      outcome = "failed";
    }
    let logSummary = null;
    if (handle) {
      logSummary = await runLogger.finalize(handle);
    }
    const usageJson = rawUsage || adapterResult.costUsd != null ? {
      ...rawUsage ?? {},
      sessionRotated,
      sessionRotationReason,
      ...adapterResult.costUsd != null ? { costUsd: adapterResult.costUsd } : {},
      ...adapterResult.billingType ? { billingType: adapterResult.billingType } : {}
    } : null;
    await store.updateRun(run.id, {
      status: outcome === "succeeded" ? "succeeded" : outcome === "cancelled" ? "cancelled" : outcome === "timed_out" ? "timed_out" : "failed",
      finishedAt: /* @__PURE__ */ new Date(),
      error: outcome === "succeeded" ? null : adapterResult.errorMessage ?? (outcome === "timed_out" ? "Timed out" : "Adapter failed"),
      errorCode: outcome === "timed_out" ? "timeout" : outcome === "cancelled" ? "cancelled" : outcome === "failed" ? adapterResult.errorCode ?? "adapter_failed" : null,
      exitCode: adapterResult.exitCode,
      signal: adapterResult.signal,
      usageJson,
      resultJson: adapterResult.resultJson ?? null,
      sessionIdAfter: nextSessionState.displayId ?? nextSessionState.legacySessionId,
      stdoutExcerpt,
      stderrExcerpt,
      logBytes: logSummary?.bytes ?? null,
      logSha256: logSummary?.sha256 ?? null,
      logCompressed: logSummary?.compressed ?? false
    });
    if (taskKey) {
      if (adapterResult.clearSession || !nextSessionState.params && !nextSessionState.displayId) {
        await store.clearTaskSession(agent.id, taskKey);
      } else {
        await store.upsertTaskSession({
          tenantId: agent.tenantId,
          agentId: agent.id,
          adapterType: agent.adapterType,
          taskKey,
          sessionParamsJson: nextSessionState.params,
          sessionDisplayId: nextSessionState.displayId,
          lastRunId: run.id,
          lastError: outcome === "succeeded" ? null : adapterResult.errorMessage ?? "run_failed"
        });
      }
    }
    if (rawUsage || adapterResult.costUsd != null) {
      const costCents = adapterResult.costUsd ? Math.round(adapterResult.costUsd * 100) : 0;
      await store.recordCost({
        tenantId: agent.tenantId,
        agentId: agent.id,
        runId: run.id,
        adapterType: agent.adapterType,
        provider: adapterResult.provider ?? null,
        model: adapterResult.model ?? null,
        billingType: adapterResult.billingType ?? null,
        inputTokens: rawUsage?.inputTokens ?? 0,
        outputTokens: rawUsage?.outputTokens ?? 0,
        cachedInputTokens: rawUsage?.cachedInputTokens ?? 0,
        costUsd: adapterResult.costUsd ?? null,
        costCents
      });
    }
    if (rawUsage) {
      await store.accumulateUsage(agent.id, {
        inputTokens: rawUsage.inputTokens,
        outputTokens: rawUsage.outputTokens,
        cachedInputTokens: rawUsage.cachedInputTokens
      });
    }
    await store.updateRuntimeState(agent.id, {
      lastRunId: run.id,
      lastRunStatus: outcome,
      sessionId: nextSessionState.legacySessionId,
      sessionDisplayId: nextSessionState.displayId,
      sessionParamsJson: nextSessionState.params,
      lastError: outcome === "succeeded" ? null : adapterResult.errorMessage ?? "run_failed"
    });
    const finalRun = await store.getRun(run.id);
    if (finalRun) {
      if (outcome === "succeeded" || outcome === "failed") {
        events.emit(
          outcome === "succeeded" ? "run.completed" : "run.failed",
          finalRun,
          outcome === "succeeded" ? adapterResult : new Error(adapterResult.errorMessage ?? "Adapter failed")
        );
      } else if (outcome === "cancelled") {
        events.emit("run.cancelled", finalRun);
      }
    }
    return adapterResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown execution failure";
    logger.error({ err, runId }, "run execution failed");
    if (handle) {
      try {
        await runLogger.finalize(handle);
      } catch {
      }
    }
    await store.updateRun(runId, {
      status: "failed",
      error: message,
      errorCode: "adapter_failed",
      finishedAt: /* @__PURE__ */ new Date(),
      stdoutExcerpt,
      stderrExcerpt
    }).catch(() => void 0);
    const failedRun = await store.getRun(runId).catch(() => null);
    if (failedRun) {
      events.emit("run.failed", failedRun, err instanceof Error ? err : new Error(message));
    }
    return null;
  }
}

// src/scheduler.ts
var DEFAULT_MAX_CONCURRENT_RUNS = 1;
var MAX_CONCURRENT_RUNS_LIMIT = 10;
var startLocksByAgent = /* @__PURE__ */ new Map();
function normalizeMaxConcurrentRuns(value) {
  const parsed = Math.floor(asNumber(value, DEFAULT_MAX_CONCURRENT_RUNS));
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_CONCURRENT_RUNS;
  return Math.max(
    DEFAULT_MAX_CONCURRENT_RUNS,
    Math.min(MAX_CONCURRENT_RUNS_LIMIT, parsed)
  );
}
async function withAgentStartLock(agentId, fn) {
  const previous = startLocksByAgent.get(agentId) ?? Promise.resolve();
  const run = previous.then(fn);
  const marker = run.then(
    () => void 0,
    () => void 0
  );
  startLocksByAgent.set(agentId, marker);
  try {
    return await run;
  } finally {
    if (startLocksByAgent.get(agentId) === marker) {
      startLocksByAgent.delete(agentId);
    }
  }
}
function createScheduler(deps) {
  const { store, events, logger, executeRun: executeRun2 } = deps;
  let timerInterval = null;
  const activeExecutions = /* @__PURE__ */ new Set();
  async function invoke(agentId, opts = {}) {
    const agent = await store.getAgent(agentId);
    if (!agent) {
      logger.warn({ agentId }, "cannot invoke: agent not found");
      return null;
    }
    const source = opts.source ?? "on_demand";
    const triggerDetail = opts.triggerDetail ?? "manual";
    const contextSnapshot = opts.contextSnapshot ?? {};
    enrichWakeContextSnapshot({
      contextSnapshot,
      reason: opts.reason ?? null,
      source,
      triggerDetail,
      payload: opts.payload ?? null
    });
    const run = await store.createRun({
      tenantId: agent.tenantId,
      agentId: agent.id,
      invocationSource: source,
      triggerDetail,
      contextSnapshot
    });
    events.emit("run.queued", run);
    void startNextQueuedRunForAgent(agentId);
    return run;
  }
  async function startNextQueuedRunForAgent(agentId) {
    await withAgentStartLock(agentId, async () => {
      const agent = await store.getAgent(agentId);
      if (!agent) return;
      const maxConcurrent = normalizeMaxConcurrentRuns(
        parseObject(agent.runtimeConfig).maxConcurrentRuns ?? parseObject(agent.metadata).maxConcurrentRuns
      );
      const runningCount = await store.getRunningCount(agentId);
      if (runningCount >= maxConcurrent) return;
      const queuedRuns = await store.getQueuedRuns(agentId, 1);
      if (queuedRuns.length === 0) return;
      const nextRun = queuedRuns[0];
      if (activeExecutions.has(nextRun.id)) return;
      activeExecutions.add(nextRun.id);
      void executeRun2(nextRun.id).catch((err) => {
        logger.error(
          { err, runId: nextRun.id, agentId },
          "failed to execute queued run"
        );
      }).finally(() => {
        activeExecutions.delete(nextRun.id);
        void startNextQueuedRunForAgent(agentId);
      });
    });
  }
  async function cancelRun(runId) {
    const run = await store.getRun(runId);
    if (!run) return false;
    if (run.status !== "queued" && run.status !== "running") return false;
    await store.updateRun(runId, {
      status: "cancelled",
      finishedAt: /* @__PURE__ */ new Date(),
      errorCode: "cancelled"
    });
    const cancelledRun = await store.getRun(runId);
    if (cancelledRun) {
      events.emit("run.cancelled", cancelledRun);
    }
    return true;
  }
  function start(intervalMs = 6e4) {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      void tickTimers().catch((err) => {
        logger.error({ err }, "timer tick failed");
      });
    }, intervalMs);
    logger.info("scheduler started");
  }
  function stop() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      logger.info("scheduler stopped");
    }
  }
  async function tickTimers() {
  }
  return {
    invoke,
    cancelRun,
    startNextQueuedRunForAgent,
    start,
    stop,
    tickTimers
  };
}

// src/adapters/all.ts
var adapters = {
  claudeLocal: claudeLocalAdapter,
  codexLocal: codexLocalAdapter,
  cursorLocal: cursorLocalAdapter,
  geminiLocal: geminiLocalAdapter,
  opencodeLocal: opencodeLocalAdapter,
  piLocal: piLocalAdapter,
  openclawGateway: openclawGatewayAdapter
};

// src/index.ts
var consoleLogger = {
  info: (...args) => console.log("[orchestrator]", ...args),
  warn: (...args) => console.warn("[orchestrator]", ...args),
  error: (...args) => console.error("[orchestrator]", ...args),
  debug: (...args) => console.debug("[orchestrator]", ...args)
};
function createOrchestrator(opts = {}) {
  const store = opts.store ?? new MemoryStore();
  const registry = new AdapterRegistry(opts.adapters);
  const events = new EventEmitter();
  const logger = opts.logger ?? consoleLogger;
  const runLogger = opts.runLogger ?? new NullRunLogger();
  let workspaceResolver;
  if (opts.workspace && "resolve" in opts.workspace) {
    workspaceResolver = opts.workspace;
  } else if (opts.workspace && "defaultCwd" in opts.workspace) {
    workspaceResolver = new SimpleWorkspaceResolver(opts.workspace);
  } else {
    workspaceResolver = new SimpleWorkspaceResolver({
      defaultCwd: process.cwd()
    });
  }
  let authProvider;
  if (opts.auth && "createToken" in opts.auth) {
    authProvider = opts.auth;
  } else if (opts.auth && "secret" in opts.auth) {
    authProvider = new DefaultAuth(opts.auth);
  } else {
    authProvider = new NoAuth();
  }
  const executorDeps = {
    store,
    getAdapter: (type) => registry.get(type),
    workspace: workspaceResolver,
    auth: authProvider,
    runLogger,
    logger,
    events
  };
  const scheduler = createScheduler({
    store,
    events,
    logger,
    executeRun: (runId) => executeRun(runId, executorDeps).then(() => void 0)
  });
  return {
    async executeRun(runId) {
      return executeRun(runId, executorDeps);
    },
    async invoke(agentId, invokeOpts) {
      return scheduler.invoke(agentId, invokeOpts);
    },
    async registerAgent(agent) {
      return store.createAgent({
        id: agent.id ?? "",
        tenantId: agent.tenantId ?? DEFAULT_TENANT_ID,
        name: agent.name,
        adapterType: agent.adapterType,
        adapterConfig: agent.adapterConfig,
        role: agent.role,
        status: agent.status ?? "active",
        runtimeConfig: agent.runtimeConfig,
        metadata: agent.metadata,
        budgetMonthlyCents: agent.budgetMonthlyCents
      });
    },
    async cancelRun(runId) {
      return scheduler.cancelRun(runId);
    },
    start(intervalMs) {
      scheduler.start(intervalMs);
    },
    stop() {
      scheduler.stop();
    },
    async tickTimers() {
      await scheduler.tickTimers();
    },
    async listModels() {
      return registry.listAllModels();
    },
    on: events.on.bind(events),
    off: events.off.bind(events),
    store,
    registry,
    events
  };
}
export {
  AdapterRegistry,
  DEFAULT_TENANT_ID,
  DefaultAuth,
  DefaultRunLogger,
  EventEmitter,
  MAX_CAPTURE_BYTES,
  MAX_EXCERPT_BYTES,
  MemoryStore,
  NoAuth,
  NullRunLogger,
  SimpleWorkspaceResolver,
  adapters,
  appendWithCap,
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  buildAgentEnv,
  claudeLocalAdapter,
  codexLocalAdapter,
  createOrchestrator,
  createScheduler,
  cursorLocalAdapter,
  defaultPathForPlatform,
  defaultSessionCodec,
  deriveTaskKey,
  enrichWakeContextSnapshot,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  ensureSkillSymlink,
  executeRun,
  geminiLocalAdapter,
  joinPromptSections,
  listSkillEntries,
  normalizeUsageTotals,
  openclawGatewayAdapter,
  opencodeLocalAdapter,
  parseJson,
  parseObject,
  parseSessionCompactionPolicy,
  piLocalAdapter,
  readSkillMarkdown,
  redactEnvForLogs,
  removeMaintainerOnlySkillSymlinks,
  renderTemplate,
  resolveNextSessionState,
  resolvePathValue,
  resolveSkillsDir,
  runChildProcess,
  runningProcesses,
  shouldResetTaskSessionForWake
};
//# sourceMappingURL=index.js.map