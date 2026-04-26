import {
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  buildAgentEnv,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  ensureSkillSymlink,
  joinPromptSections,
  listSkillEntries,
  parseJson,
  parseObject,
  redactEnvForLogs,
  removeMaintainerOnlySkillSymlinks,
  renderTemplate,
  runChildProcess
} from "./chunk-Z6GQFNVV.js";

// src/adapters/codex-local/index.ts
import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
var __moduleDir = path.dirname(fileURLToPath(import.meta.url));
function parseCodexJsonl(stdout) {
  let sessionId = null;
  const messages = [];
  let errorMessage = null;
  const usage = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0
  };
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = parseJson(line);
    if (!event) continue;
    const type = asString(event.type, "");
    if (type === "thread.started") {
      sessionId = asString(event.thread_id, sessionId ?? "") || sessionId;
      continue;
    }
    if (type === "error") {
      const msg = asString(event.message, "").trim();
      if (msg) errorMessage = msg;
      continue;
    }
    if (type === "item.completed") {
      const item = parseObject(event.item);
      if (asString(item.type, "") === "agent_message") {
        const text = asString(item.text, "");
        if (text) messages.push(text);
      }
      continue;
    }
    if (type === "turn.completed") {
      const usageObj = parseObject(event.usage);
      usage.inputTokens = asNumber(usageObj.input_tokens, usage.inputTokens);
      usage.cachedInputTokens = asNumber(usageObj.cached_input_tokens, usage.cachedInputTokens ?? 0);
      usage.outputTokens = asNumber(usageObj.output_tokens, usage.outputTokens);
      continue;
    }
    if (type === "turn.failed") {
      const err = parseObject(event.error);
      const msg = asString(err.message, "").trim();
      if (msg) errorMessage = msg;
    }
  }
  return {
    sessionId,
    summary: messages.join("\n\n").trim(),
    usage,
    errorMessage
  };
}
function isCodexUnknownSessionError(stdout, stderr) {
  const haystack = `${stdout}
${stderr}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join("\n");
  return /unknown (session|thread)|session .* not found|thread .* not found|conversation .* not found|missing rollout path for thread|state db missing rollout path/i.test(
    haystack
  );
}
var TRUTHY_ENV_RE = /^(1|true|yes|on)$/i;
var COPIED_SHARED_FILES = ["config.json", "config.toml", "instructions.md"];
var SYMLINKED_SHARED_FILES = ["auth.json"];
function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
async function pathExists(candidate) {
  return fs.access(candidate).then(() => true).catch(() => false);
}
function resolveCodexHomeDir(env = process.env) {
  const fromEnv = nonEmpty(env.CODEX_HOME);
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(os.homedir(), ".codex");
}
function isWorktreeMode(env) {
  return TRUTHY_ENV_RE.test(env.PAPERCLIP_IN_WORKTREE ?? "");
}
function resolveWorktreeCodexHomeDir(env) {
  if (!isWorktreeMode(env)) return null;
  const agentOrcHome = nonEmpty(env.PAPERCLIP_HOME);
  if (!agentOrcHome) return null;
  const instanceId = nonEmpty(env.PAPERCLIP_INSTANCE_ID);
  if (instanceId) {
    return path.resolve(agentOrcHome, "instances", instanceId, "codex-home");
  }
  return path.resolve(agentOrcHome, "codex-home");
}
async function ensureParentDir(target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
}
async function ensureSymlinkFile(target, source) {
  const existing = await fs.lstat(target).catch(() => null);
  if (!existing) {
    await ensureParentDir(target);
    await fs.symlink(source, target);
    return;
  }
  if (!existing.isSymbolicLink()) {
    return;
  }
  const linkedPath = await fs.readlink(target).catch(() => null);
  if (!linkedPath) return;
  const resolvedLinkedPath = path.resolve(path.dirname(target), linkedPath);
  if (resolvedLinkedPath === source) return;
  await fs.unlink(target);
  await fs.symlink(source, target);
}
async function ensureCopiedFile(target, source) {
  const existing = await fs.lstat(target).catch(() => null);
  if (existing) return;
  await ensureParentDir(target);
  await fs.copyFile(source, target);
}
async function prepareWorktreeCodexHome(env, onLog) {
  const targetHome = resolveWorktreeCodexHomeDir(env);
  if (!targetHome) return null;
  const sourceHome = resolveCodexHomeDir(env);
  if (path.resolve(sourceHome) === path.resolve(targetHome)) return targetHome;
  await fs.mkdir(targetHome, { recursive: true });
  for (const name of SYMLINKED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!await pathExists(source)) continue;
    await ensureSymlinkFile(path.join(targetHome, name), source);
  }
  for (const name of COPIED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!await pathExists(source)) continue;
    await ensureCopiedFile(path.join(targetHome, name), source);
  }
  await onLog(
    "stderr",
    `[agent-orchestrator] Using worktree-isolated Codex home "${targetHome}" (seeded from "${sourceHome}").
`
  );
  return targetHome;
}
var CODEX_ROLLOUT_NOISE_RE = /^\d{4}-\d{2}-\d{2}T[^\s]+\s+ERROR\s+codex_core::rollout::list:\s+state db missing rollout path for thread\s+[a-z0-9-]+$/i;
function stripCodexRolloutNoise(text) {
  const parts = text.split(/\r?\n/);
  const kept = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      kept.push(part);
      continue;
    }
    if (CODEX_ROLLOUT_NOISE_RE.test(trimmed)) continue;
    kept.push(part);
  }
  return kept.join("\n");
}
function firstNonEmptyLine(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}
function hasNonEmptyEnvValue(env, key) {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}
function resolveCodexBillingType(env) {
  return hasNonEmptyEnvValue(env, "OPENAI_API_KEY") ? "api" : "subscription";
}
async function isLikelyRepoRoot(candidate) {
  const [hasWorkspace, hasPackageJson, hasServerDir] = await Promise.all([
    pathExists(path.join(candidate, "pnpm-workspace.yaml")),
    pathExists(path.join(candidate, "package.json")),
    pathExists(path.join(candidate, "server"))
  ]);
  return hasWorkspace && hasPackageJson && hasServerDir;
}
async function isLikelyRuntimeSkillSource(candidate, skillName) {
  if (path.basename(candidate) !== skillName) return false;
  const skillsRoot = path.dirname(candidate);
  if (path.basename(skillsRoot) !== "skills") return false;
  if (!await pathExists(path.join(candidate, "SKILL.md"))) return false;
  let cursor = path.dirname(skillsRoot);
  for (let depth = 0; depth < 6; depth += 1) {
    if (await isLikelyRepoRoot(cursor)) return true;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return false;
}
async function ensureCodexSkillsInjected(onLog, options = {}) {
  const skillsEntries = options.skillsEntries ?? await listSkillEntries(__moduleDir);
  if (skillsEntries.length === 0) return;
  const skillsHome = options.skillsHome ?? path.join(resolveCodexHomeDir(process.env), "skills");
  await fs.mkdir(skillsHome, { recursive: true });
  const removedSkills = await removeMaintainerOnlySkillSymlinks(
    skillsHome,
    skillsEntries.map((entry) => entry.name)
  );
  for (const skillName of removedSkills) {
    await onLog(
      "stderr",
      `[agent-orchestrator] Removed maintainer-only Codex skill "${skillName}" from ${skillsHome}
`
    );
  }
  const linkSkill = options.linkSkill;
  for (const entry of skillsEntries) {
    const target = path.join(skillsHome, entry.name);
    try {
      const existing = await fs.lstat(target).catch(() => null);
      if (existing?.isSymbolicLink()) {
        const linkedPath = await fs.readlink(target).catch(() => null);
        const resolvedLinkedPath = linkedPath ? path.resolve(path.dirname(target), linkedPath) : null;
        if (resolvedLinkedPath && resolvedLinkedPath !== entry.source && await isLikelyRuntimeSkillSource(resolvedLinkedPath, entry.name)) {
          await fs.unlink(target);
          if (linkSkill) {
            await linkSkill(entry.source, target);
          } else {
            await fs.symlink(entry.source, target);
          }
          await onLog(
            "stderr",
            `[agent-orchestrator] Repaired Codex skill "${entry.name}" into ${skillsHome}
`
          );
          continue;
        }
      }
      const result = await ensureSkillSymlink(entry.source, target, linkSkill);
      if (result === "skipped") continue;
      await onLog(
        "stderr",
        `[agent-orchestrator] ${result === "repaired" ? "Repaired" : "Injected"} Codex skill "${entry.name}" into ${skillsHome}
`
      );
    } catch (err) {
      await onLog(
        "stderr",
        `[agent-orchestrator] Failed to inject Codex skill "${entry.name}" into ${skillsHome}: ${err instanceof Error ? err.message : String(err)}
`
      );
    }
  }
}
function readNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
var sessionCodec = {
  deserialize(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const record = raw;
    const sessionId = readNonEmptyString(record.sessionId) ?? readNonEmptyString(record.session_id);
    if (!sessionId) return null;
    const cwd = readNonEmptyString(record.cwd) ?? readNonEmptyString(record.workdir) ?? readNonEmptyString(record.folder);
    const workspaceId = readNonEmptyString(record.workspaceId) ?? readNonEmptyString(record.workspace_id);
    const repoUrl = readNonEmptyString(record.repoUrl) ?? readNonEmptyString(record.repo_url);
    const repoRef = readNonEmptyString(record.repoRef) ?? readNonEmptyString(record.repo_ref);
    return {
      sessionId,
      ...cwd ? { cwd } : {},
      ...workspaceId ? { workspaceId } : {},
      ...repoUrl ? { repoUrl } : {},
      ...repoRef ? { repoRef } : {}
    };
  },
  serialize(params) {
    if (!params) return null;
    const sessionId = readNonEmptyString(params.sessionId) ?? readNonEmptyString(params.session_id);
    if (!sessionId) return null;
    const cwd = readNonEmptyString(params.cwd) ?? readNonEmptyString(params.workdir) ?? readNonEmptyString(params.folder);
    const workspaceId = readNonEmptyString(params.workspaceId) ?? readNonEmptyString(params.workspace_id);
    const repoUrl = readNonEmptyString(params.repoUrl) ?? readNonEmptyString(params.repo_url);
    const repoRef = readNonEmptyString(params.repoRef) ?? readNonEmptyString(params.repo_ref);
    return {
      sessionId,
      ...cwd ? { cwd } : {},
      ...workspaceId ? { workspaceId } : {},
      ...repoUrl ? { repoUrl } : {},
      ...repoRef ? { repoRef } : {}
    };
  },
  getDisplayId(params) {
    if (!params) return null;
    return readNonEmptyString(params.sessionId) ?? readNonEmptyString(params.session_id);
  }
};
async function execute(ctx) {
  const { runId, agent, runtime, config, context, onLog, onMeta, authToken } = ctx;
  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your work."
  );
  const command = asString(config.command, "codex");
  const model = asString(config.model, "");
  const modelReasoningEffort = asString(
    config.modelReasoningEffort,
    asString(config.reasoningEffort, "")
  );
  const search = asBoolean(config.search, false);
  const bypass = asBoolean(
    config.dangerouslyBypassApprovalsAndSandbox,
    asBoolean(config.dangerouslyBypassSandbox, false)
  );
  const workspaceContext = parseObject(context.paperclipWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceStrategy = asString(workspaceContext.strategy, "");
  const workspaceId = asString(workspaceContext.workspaceId, "");
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "");
  const workspaceRepoRef = asString(workspaceContext.repoRef, "");
  const workspaceBranch = asString(workspaceContext.branchName, "");
  const workspaceWorktreePath = asString(workspaceContext.worktreePath, "");
  const agentHome = asString(workspaceContext.agentHome, "");
  const workspaceHints = Array.isArray(context.paperclipWorkspaces) ? context.paperclipWorkspaces.filter(
    (value) => typeof value === "object" && value !== null
  ) : [];
  const runtimeServiceIntents = Array.isArray(context.paperclipRuntimeServiceIntents) ? context.paperclipRuntimeServiceIntents.filter(
    (value) => typeof value === "object" && value !== null
  ) : [];
  const runtimeServices = Array.isArray(context.paperclipRuntimeServices) ? context.paperclipRuntimeServices.filter(
    (value) => typeof value === "object" && value !== null
  ) : [];
  const runtimePrimaryUrl = asString(context.paperclipRuntimePrimaryUrl, "");
  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  const envConfig = parseObject(config.env);
  const configuredCodexHome = typeof envConfig.CODEX_HOME === "string" && envConfig.CODEX_HOME.trim().length > 0 ? path.resolve(envConfig.CODEX_HOME.trim()) : null;
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
  const preparedWorktreeCodexHome = configuredCodexHome ? null : await prepareWorktreeCodexHome(process.env, onLog);
  const effectiveCodexHome = configuredCodexHome ?? preparedWorktreeCodexHome;
  await ensureCodexSkillsInjected(
    onLog,
    effectiveCodexHome ? { skillsHome: path.join(effectiveCodexHome, "skills") } : {}
  );
  const hasExplicitApiKey = typeof envConfig.PAPERCLIP_API_KEY === "string" && envConfig.PAPERCLIP_API_KEY.trim().length > 0;
  const env = { ...buildAgentEnv(agent) };
  if (effectiveCodexHome) {
    env.CODEX_HOME = effectiveCodexHome;
  }
  env.PAPERCLIP_RUN_ID = runId;
  const wakeTaskId = typeof context.taskId === "string" && context.taskId.trim().length > 0 && context.taskId.trim() || typeof context.issueId === "string" && context.issueId.trim().length > 0 && context.issueId.trim() || null;
  const wakeReason = typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0 ? context.wakeReason.trim() : null;
  const wakeCommentId = typeof context.wakeCommentId === "string" && context.wakeCommentId.trim().length > 0 && context.wakeCommentId.trim() || typeof context.commentId === "string" && context.commentId.trim().length > 0 && context.commentId.trim() || null;
  const approvalId = typeof context.approvalId === "string" && context.approvalId.trim().length > 0 ? context.approvalId.trim() : null;
  const approvalStatus = typeof context.approvalStatus === "string" && context.approvalStatus.trim().length > 0 ? context.approvalStatus.trim() : null;
  const linkedIssueIds = Array.isArray(context.issueIds) ? context.issueIds.filter((value) => typeof value === "string" && value.trim().length > 0) : [];
  if (wakeTaskId) {
    env.PAPERCLIP_TASK_ID = wakeTaskId;
  }
  if (wakeReason) {
    env.PAPERCLIP_WAKE_REASON = wakeReason;
  }
  if (wakeCommentId) {
    env.PAPERCLIP_WAKE_COMMENT_ID = wakeCommentId;
  }
  if (approvalId) {
    env.PAPERCLIP_APPROVAL_ID = approvalId;
  }
  if (approvalStatus) {
    env.PAPERCLIP_APPROVAL_STATUS = approvalStatus;
  }
  if (linkedIssueIds.length > 0) {
    env.PAPERCLIP_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  }
  if (effectiveWorkspaceCwd) {
    env.PAPERCLIP_WORKSPACE_CWD = effectiveWorkspaceCwd;
  }
  if (workspaceSource) {
    env.PAPERCLIP_WORKSPACE_SOURCE = workspaceSource;
  }
  if (workspaceStrategy) {
    env.PAPERCLIP_WORKSPACE_STRATEGY = workspaceStrategy;
  }
  if (workspaceId) {
    env.PAPERCLIP_WORKSPACE_ID = workspaceId;
  }
  if (workspaceRepoUrl) {
    env.PAPERCLIP_WORKSPACE_REPO_URL = workspaceRepoUrl;
  }
  if (workspaceRepoRef) {
    env.PAPERCLIP_WORKSPACE_REPO_REF = workspaceRepoRef;
  }
  if (workspaceBranch) {
    env.PAPERCLIP_WORKSPACE_BRANCH = workspaceBranch;
  }
  if (workspaceWorktreePath) {
    env.PAPERCLIP_WORKSPACE_WORKTREE_PATH = workspaceWorktreePath;
  }
  if (agentHome) {
    env.AGENT_HOME = agentHome;
  }
  if (workspaceHints.length > 0) {
    env.PAPERCLIP_WORKSPACES_JSON = JSON.stringify(workspaceHints);
  }
  if (runtimeServiceIntents.length > 0) {
    env.PAPERCLIP_RUNTIME_SERVICE_INTENTS_JSON = JSON.stringify(runtimeServiceIntents);
  }
  if (runtimeServices.length > 0) {
    env.PAPERCLIP_RUNTIME_SERVICES_JSON = JSON.stringify(runtimeServices);
  }
  if (runtimePrimaryUrl) {
    env.PAPERCLIP_RUNTIME_PRIMARY_URL = runtimePrimaryUrl;
  }
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  if (!hasExplicitApiKey && authToken) {
    env.PAPERCLIP_API_KEY = authToken;
  }
  const billingType = resolveCodexBillingType(env);
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);
  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();
  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");
  const runtimeSessionCwd = asString(runtimeSessionParams.cwd, "");
  const canResumeSession = runtimeSessionId.length > 0 && (runtimeSessionCwd.length === 0 || path.resolve(runtimeSessionCwd) === path.resolve(cwd));
  const sessionId = canResumeSession ? runtimeSessionId : null;
  if (runtimeSessionId && !canResumeSession) {
    await onLog(
      "stderr",
      `[agent-orchestrator] Codex session "${runtimeSessionId}" was saved for cwd "${runtimeSessionCwd}" and will not be resumed in "${cwd}".
`
    );
  }
  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();
  const instructionsDir = instructionsFilePath ? `${path.dirname(instructionsFilePath)}/` : "";
  let instructionsPrefix = "";
  let instructionsChars = 0;
  if (instructionsFilePath) {
    try {
      const instructionsContents = await fs.readFile(instructionsFilePath, "utf8");
      instructionsPrefix = `${instructionsContents}

The above agent instructions were loaded from ${instructionsFilePath}. Resolve any relative file references from ${instructionsDir}.

`;
      instructionsChars = instructionsPrefix.length;
      await onLog(
        "stderr",
        `[agent-orchestrator] Loaded agent instructions file: ${instructionsFilePath}
`
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await onLog(
        "stderr",
        `[agent-orchestrator] Warning: could not read agent instructions file "${instructionsFilePath}": ${reason}
`
      );
    }
  }
  const commandNotes = (() => {
    if (!instructionsFilePath) return [];
    if (instructionsPrefix.length > 0) {
      return [
        `Loaded agent instructions from ${instructionsFilePath}`,
        `Prepended instructions + path directive to stdin prompt (relative references from ${instructionsDir}).`
      ];
    }
    return [
      `Configured instructionsFilePath ${instructionsFilePath}, but file could not be read; continuing without injected instructions.`
    ];
  })();
  const bootstrapPromptTemplate = asString(config.bootstrapPromptTemplate, "");
  const templateData = {
    agentId: agent.id,
    tenantId: agent.tenantId,
    runId,
    company: { id: agent.tenantId },
    agent,
    run: { id: runId, source: "on_demand" },
    context
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const renderedBootstrapPrompt = !sessionId && bootstrapPromptTemplate.trim().length > 0 ? renderTemplate(bootstrapPromptTemplate, templateData).trim() : "";
  const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();
  const prompt = joinPromptSections([
    instructionsPrefix,
    renderedBootstrapPrompt,
    sessionHandoffNote,
    renderedPrompt
  ]);
  const promptMetrics = {
    promptChars: prompt.length,
    instructionsChars,
    bootstrapPromptChars: renderedBootstrapPrompt.length,
    sessionHandoffChars: sessionHandoffNote.length,
    heartbeatPromptChars: renderedPrompt.length
  };
  const buildArgs = (resumeSessionId) => {
    const args = ["exec", "--json"];
    if (search) args.unshift("--search");
    if (bypass) args.push("--dangerously-bypass-approvals-and-sandbox");
    if (model) args.push("--model", model);
    if (modelReasoningEffort) args.push("-c", `model_reasoning_effort=${JSON.stringify(modelReasoningEffort)}`);
    if (extraArgs.length > 0) args.push(...extraArgs);
    if (resumeSessionId) args.push("resume", resumeSessionId, "-");
    else args.push("-");
    return args;
  };
  const runAttempt = async (resumeSessionId) => {
    const args = buildArgs(resumeSessionId);
    if (onMeta) {
      await onMeta({
        adapterType: "codex_local",
        command,
        cwd,
        commandNotes,
        commandArgs: args.map((value, idx) => {
          if (idx === args.length - 1 && value !== "-") return `<prompt ${prompt.length} chars>`;
          return value;
        }),
        env: redactEnvForLogs(env),
        prompt,
        promptMetrics,
        context
      });
    }
    const proc = await runChildProcess(runId, command, args, {
      cwd,
      env,
      stdin: prompt,
      timeoutSec,
      graceSec,
      onLog: async (stream, chunk) => {
        if (stream !== "stderr") {
          await onLog(stream, chunk);
          return;
        }
        const cleaned = stripCodexRolloutNoise(chunk);
        if (!cleaned.trim()) return;
        await onLog(stream, cleaned);
      }
    });
    const cleanedStderr = stripCodexRolloutNoise(proc.stderr);
    return {
      proc: {
        ...proc,
        stderr: cleanedStderr
      },
      rawStderr: proc.stderr,
      parsed: parseCodexJsonl(proc.stdout)
    };
  };
  const toResult = (attempt, clearSessionOnMissingSession = false) => {
    if (attempt.proc.timedOut) {
      return {
        exitCode: attempt.proc.exitCode,
        signal: attempt.proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${timeoutSec}s`,
        clearSession: clearSessionOnMissingSession
      };
    }
    const resolvedSessionId = attempt.parsed.sessionId ?? runtimeSessionId ?? runtime.sessionId ?? null;
    const resolvedSessionParams = resolvedSessionId ? {
      sessionId: resolvedSessionId,
      cwd,
      ...workspaceId ? { workspaceId } : {},
      ...workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {},
      ...workspaceRepoRef ? { repoRef: workspaceRepoRef } : {}
    } : null;
    const parsedError = typeof attempt.parsed.errorMessage === "string" ? attempt.parsed.errorMessage.trim() : "";
    const stderrLine = firstNonEmptyLine(attempt.proc.stderr);
    const fallbackErrorMessage = parsedError || stderrLine || `Codex exited with code ${attempt.proc.exitCode ?? -1}`;
    return {
      exitCode: attempt.proc.exitCode,
      signal: attempt.proc.signal,
      timedOut: false,
      errorMessage: (attempt.proc.exitCode ?? 0) === 0 ? null : fallbackErrorMessage,
      usage: attempt.parsed.usage,
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: "openai",
      model,
      billingType,
      costUsd: null,
      resultJson: {
        stdout: attempt.proc.stdout,
        stderr: attempt.proc.stderr
      },
      summary: attempt.parsed.summary,
      clearSession: Boolean(clearSessionOnMissingSession && !resolvedSessionId)
    };
  };
  const initial = await runAttempt(sessionId);
  if (sessionId && !initial.proc.timedOut && (initial.proc.exitCode ?? 0) !== 0 && isCodexUnknownSessionError(initial.proc.stdout, initial.rawStderr)) {
    await onLog(
      "stderr",
      `[agent-orchestrator] Codex resume session "${sessionId}" is unavailable; retrying with a fresh session.
`
    );
    const retry = await runAttempt(null);
    return toResult(retry, true);
  }
  return toResult(initial);
}
function summarizeStatus(checks) {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}
function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function commandLooksLike(command, expected) {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}
function summarizeProbeDetail(stdout, stderr, parsedError) {
  const raw = parsedError?.trim() || firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}\u2026` : clean;
}
var CODEX_AUTH_REQUIRED_RE = /(?:not\s+logged\s+in|login\s+required|authentication\s+required|unauthorized|invalid(?:\s+or\s+missing)?\s+api(?:[_\s-]?key)?|openai[_\s-]?api[_\s-]?key|api[_\s-]?key.*required|please\s+run\s+`?codex\s+login`?)/i;
async function testEnvironment(ctx) {
  const checks = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "codex");
  const cwd = asString(config.cwd, process.cwd());
  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "codex_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`
    });
  } catch (err) {
    checks.push({
      code: "codex_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd
    });
  }
  const envConfig = parseObject(config.env);
  const env = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "codex_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`
    });
  } catch (err) {
    checks.push({
      code: "codex_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command
    });
  }
  const configOpenAiKey = env.OPENAI_API_KEY;
  const hostOpenAiKey = process.env.OPENAI_API_KEY;
  if (isNonEmpty(configOpenAiKey) || isNonEmpty(hostOpenAiKey)) {
    const source = isNonEmpty(configOpenAiKey) ? "adapter config env" : "server environment";
    checks.push({
      code: "codex_openai_api_key_present",
      level: "info",
      message: "OPENAI_API_KEY is set for Codex authentication.",
      detail: `Detected in ${source}.`
    });
  } else {
    checks.push({
      code: "codex_openai_api_key_missing",
      level: "warn",
      message: "OPENAI_API_KEY is not set. Codex runs may fail until authentication is configured.",
      hint: "Set OPENAI_API_KEY in adapter env, shell environment, or Codex auth configuration."
    });
  }
  const canRunProbe = checks.every((check) => check.code !== "codex_cwd_invalid" && check.code !== "codex_command_unresolvable");
  if (canRunProbe) {
    if (!commandLooksLike(command, "codex")) {
      checks.push({
        code: "codex_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `codex`.",
        detail: command,
        hint: "Use the `codex` CLI command to run the automatic login and installation probe."
      });
    } else {
      const model = asString(config.model, "").trim();
      const modelReasoningEffort = asString(
        config.modelReasoningEffort,
        asString(config.reasoningEffort, "")
      ).trim();
      const search = asBoolean(config.search, false);
      const bypass = asBoolean(
        config.dangerouslyBypassApprovalsAndSandbox,
        asBoolean(config.dangerouslyBypassSandbox, false)
      );
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();
      const args = ["exec", "--json"];
      if (search) args.unshift("--search");
      if (bypass) args.push("--dangerously-bypass-approvals-and-sandbox");
      if (model) args.push("--model", model);
      if (modelReasoningEffort) {
        args.push("-c", `model_reasoning_effort=${JSON.stringify(modelReasoningEffort)}`);
      }
      if (extraArgs.length > 0) args.push(...extraArgs);
      args.push("-");
      const probe = await runChildProcess(
        `codex-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env,
          timeoutSec: 45,
          graceSec: 5,
          stdin: "Respond with hello.",
          onLog: async () => {
          }
        }
      );
      const parsed = parseCodexJsonl(probe.stdout);
      const detail = summarizeProbeDetail(probe.stdout, probe.stderr, parsed.errorMessage);
      const authEvidence = `${parsed.errorMessage ?? ""}
${probe.stdout}
${probe.stderr}`.trim();
      if (probe.timedOut) {
        checks.push({
          code: "codex_hello_probe_timed_out",
          level: "warn",
          message: "Codex hello probe timed out.",
          hint: "Retry the probe. If this persists, verify Codex can run `Respond with hello` from this directory manually."
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const summary = parsed.summary.trim();
        const hasHello = /\bhello\b/i.test(summary);
        checks.push({
          code: hasHello ? "codex_hello_probe_passed" : "codex_hello_probe_unexpected_output",
          level: hasHello ? "info" : "warn",
          message: hasHello ? "Codex hello probe succeeded." : "Codex probe ran but did not return `hello` as expected.",
          ...summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {},
          ...hasHello ? {} : {
            hint: "Try the probe manually (`codex exec --json -` then prompt: Respond with hello) to inspect full output."
          }
        });
      } else if (CODEX_AUTH_REQUIRED_RE.test(authEvidence)) {
        checks.push({
          code: "codex_hello_probe_auth_required",
          level: "warn",
          message: "Codex CLI is installed, but authentication is not ready.",
          ...detail ? { detail } : {},
          hint: "Configure OPENAI_API_KEY in adapter env/shell or run `codex login`, then retry the probe."
        });
      } else {
        checks.push({
          code: "codex_hello_probe_failed",
          level: "error",
          message: "Codex hello probe failed.",
          ...detail ? { detail } : {},
          hint: "Run `codex exec --json -` manually in this working directory and prompt `Respond with hello` to debug."
        });
      }
    }
  }
  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var codexLocalAdapter = {
  type: "codex_local",
  execute,
  testEnvironment,
  sessionCodec
};
var codex_local_default = codexLocalAdapter;

export {
  codexLocalAdapter,
  codex_local_default
};
//# sourceMappingURL=chunk-RUJBTHTG.js.map