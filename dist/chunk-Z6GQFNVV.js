// src/adapters/_shared/utils.ts
var MAX_CAPTURE_BYTES = 4 * 1024 * 1024;
var MAX_EXCERPT_BYTES = 32 * 1024;
function parseObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value;
}
function asString(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
function asNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function asBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function asStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
function appendWithCap(prev, chunk, cap = MAX_CAPTURE_BYTES) {
  const combined = prev + chunk;
  return combined.length > cap ? combined.slice(combined.length - cap) : combined;
}

// src/adapters/_shared/env.ts
import { constants as fsConstants, promises as fs } from "fs";
import path from "path";
function defaultPathForPlatform() {
  if (process.platform === "win32") {
    return "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem";
  }
  return "/usr/local/bin:/opt/homebrew/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin";
}
function ensurePathInEnv(env) {
  if (typeof env.PATH === "string" && env.PATH.length > 0) return env;
  if (typeof env.Path === "string" && env.Path.length > 0) return env;
  return { ...env, PATH: defaultPathForPlatform() };
}
function buildAgentEnv(agent, opts) {
  const prefix = opts?.envPrefix ?? "ORCHESTRATOR";
  const resolveHostForUrl = (rawHost) => {
    const host = rawHost.trim();
    if (!host || host === "0.0.0.0" || host === "::") return "localhost";
    if (host.includes(":") && !host.startsWith("[") && !host.endsWith("]"))
      return `[${host}]`;
    return host;
  };
  const vars = {
    [`${prefix}_AGENT_ID`]: agent.id,
    [`${prefix}_COMPANY_ID`]: agent.tenantId
  };
  const runtimeHost = resolveHostForUrl(
    opts?.listenHost ?? process.env.HOST ?? "localhost"
  );
  const runtimePort = opts?.listenPort ?? process.env.PORT ?? "3100";
  const apiUrl = opts?.apiUrl ?? `http://${runtimeHost}:${runtimePort}`;
  vars[`${prefix}_API_URL`] = apiUrl;
  return vars;
}
async function ensureAbsoluteDirectory(cwd, opts = {}) {
  if (!path.isAbsolute(cwd)) {
    throw new Error(`Working directory must be an absolute path: "${cwd}"`);
  }
  const assertDirectory = async () => {
    const stats = await fs.stat(cwd);
    if (!stats.isDirectory()) {
      throw new Error(`Working directory is not a directory: "${cwd}"`);
    }
  };
  try {
    await assertDirectory();
    return;
  } catch (err) {
    const code = err.code;
    if (!opts.createIfMissing || code !== "ENOENT") {
      if (code === "ENOENT") {
        throw new Error(`Working directory does not exist: "${cwd}"`);
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
  try {
    await fs.mkdir(cwd, { recursive: true });
    await assertDirectory();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not create working directory "${cwd}": ${reason}`);
  }
}
async function pathExists(candidate) {
  try {
    await fs.access(
      candidate,
      process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK
    );
    return true;
  } catch {
    return false;
  }
}
async function resolveCommandPath(command, cwd, env) {
  const hasPathSeparator = command.includes("/") || command.includes("\\");
  if (hasPathSeparator) {
    const absolute = path.isAbsolute(command) ? command : path.resolve(cwd, command);
    return await pathExists(absolute) ? absolute : null;
  }
  const pathValue = env.PATH ?? env.Path ?? "";
  const delimiter = process.platform === "win32" ? ";" : ":";
  const dirs = pathValue.split(delimiter).filter(Boolean);
  const exts = process.platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean) : [""];
  const hasExtension = process.platform === "win32" && path.extname(command).length > 0;
  for (const dir of dirs) {
    const candidates = process.platform === "win32" ? hasExtension ? [path.join(dir, command)] : exts.map((ext) => path.join(dir, `${command}${ext}`)) : [path.join(dir, command)];
    for (const candidate of candidates) {
      if (await pathExists(candidate)) return candidate;
    }
  }
  return null;
}
async function ensureCommandResolvable(command, cwd, env) {
  const resolved = await resolveCommandPath(command, cwd, env);
  if (resolved) return;
  if (command.includes("/") || command.includes("\\")) {
    const absolute = path.isAbsolute(command) ? command : path.resolve(cwd, command);
    throw new Error(
      `Command is not executable: "${command}" (resolved: "${absolute}")`
    );
  }
  throw new Error(`Command not found in PATH: "${command}"`);
}
function quoteForCmd(arg) {
  if (!arg.length) return '""';
  const escaped = arg.replace(/"/g, '""');
  return /[\s"&<>|^()]/.test(escaped) ? `"${escaped}"` : escaped;
}
async function resolveSpawnTarget(command, args, cwd, env) {
  const resolved = await resolveCommandPath(command, cwd, env);
  const executable = resolved ?? command;
  if (process.platform !== "win32") {
    return { command: executable, args };
  }
  if (/\.(cmd|bat)$/i.test(executable)) {
    const shell = env.ComSpec || process.env.ComSpec || "cmd.exe";
    const commandLine = [quoteForCmd(executable), ...args.map(quoteForCmd)].join(
      " "
    );
    return {
      command: shell,
      args: ["/d", "/s", "/c", commandLine]
    };
  }
  return { command: executable, args };
}

// src/adapters/_shared/process.ts
import { spawn } from "child_process";
var runningProcesses = /* @__PURE__ */ new Map();
async function runChildProcess(runId, command, args, opts) {
  const onLogError = opts.onLogError ?? ((err, id, msg) => console.warn({ err, runId: id }, msg));
  return new Promise((resolve, reject) => {
    const rawMerged = { ...process.env, ...opts.env };
    const NESTING_VARS = [
      "CLAUDECODE",
      "CLAUDE_CODE_ENTRYPOINT",
      "CLAUDE_CODE_SESSION",
      "CLAUDE_CODE_PARENT_SESSION"
    ];
    for (const key of NESTING_VARS) {
      delete rawMerged[key];
    }
    const mergedEnv = ensurePathInEnv(rawMerged);
    void resolveSpawnTarget(command, args, opts.cwd, mergedEnv).then((target) => {
      const child = spawn(target.command, target.args, {
        cwd: opts.cwd,
        env: mergedEnv,
        shell: false,
        stdio: [
          opts.stdin != null ? "pipe" : "ignore",
          "pipe",
          "pipe"
        ]
      });
      if (opts.stdin != null && child.stdin) {
        child.stdin.write(opts.stdin);
        child.stdin.end();
      }
      runningProcesses.set(runId, { child, graceSec: opts.graceSec });
      let timedOut = false;
      let stdout = "";
      let stderr = "";
      let logChain = Promise.resolve();
      const timeout = opts.timeoutSec > 0 ? setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        }, Math.max(1, opts.graceSec) * 1e3);
      }, opts.timeoutSec * 1e3) : null;
      child.stdout?.on("data", (chunk) => {
        const text = String(chunk);
        stdout = appendWithCap(stdout, text);
        logChain = logChain.then(() => opts.onLog("stdout", text)).catch(
          (err) => onLogError(err, runId, "failed to append stdout log chunk")
        );
      });
      child.stderr?.on("data", (chunk) => {
        const text = String(chunk);
        stderr = appendWithCap(stderr, text);
        logChain = logChain.then(() => opts.onLog("stderr", text)).catch(
          (err) => onLogError(err, runId, "failed to append stderr log chunk")
        );
      });
      child.on("error", (err) => {
        if (timeout) clearTimeout(timeout);
        runningProcesses.delete(runId);
        const errno = err.code;
        const pathValue = mergedEnv.PATH ?? mergedEnv.Path ?? "";
        const msg = errno === "ENOENT" ? `Failed to start command "${command}" in "${opts.cwd}". Verify adapter command, working directory, and PATH (${pathValue}).` : `Failed to start command "${command}" in "${opts.cwd}": ${err.message}`;
        reject(new Error(msg));
      });
      child.on(
        "close",
        (code, signal) => {
          if (timeout) clearTimeout(timeout);
          runningProcesses.delete(runId);
          void logChain.finally(() => {
            resolve({
              exitCode: code,
              signal,
              timedOut,
              stdout,
              stderr
            });
          });
        }
      );
    }).catch(reject);
  });
}

// src/adapters/_shared/template.ts
var SENSITIVE_ENV_KEY = /(key|token|secret|password|passwd|authorization|cookie)/i;
function resolvePathValue(obj, dottedPath) {
  const parts = dottedPath.split(".");
  let cursor = obj;
  for (const part of parts) {
    if (typeof cursor !== "object" || cursor === null || Array.isArray(cursor)) {
      return "";
    }
    cursor = cursor[part];
  }
  if (cursor === null || cursor === void 0) return "";
  if (typeof cursor === "string") return cursor;
  if (typeof cursor === "number" || typeof cursor === "boolean") return String(cursor);
  try {
    return JSON.stringify(cursor);
  } catch {
    return "";
  }
}
function renderTemplate(template, data) {
  return template.replace(
    /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g,
    (_, path3) => resolvePathValue(data, path3)
  );
}
function joinPromptSections(sections, separator = "\n\n") {
  return sections.map((value) => typeof value === "string" ? value.trim() : "").filter(Boolean).join(separator);
}
function redactEnvForLogs(env) {
  const redacted = {};
  for (const [key, value] of Object.entries(env)) {
    redacted[key] = SENSITIVE_ENV_KEY.test(key) ? "***REDACTED***" : value;
  }
  return redacted;
}

// src/adapters/_shared/skills.ts
import { promises as fs2 } from "fs";
import path2 from "path";
var SKILL_ROOT_RELATIVE_CANDIDATES = [
  "../../skills",
  "../../../../../skills"
];
function normalizePathSlashes(value) {
  return value.replaceAll("\\", "/");
}
function isMaintainerOnlySkillTarget(candidate) {
  return normalizePathSlashes(candidate).includes("/.agents/skills/");
}
async function resolveSkillsDir(moduleDir, additionalCandidates = []) {
  const candidates = [
    ...SKILL_ROOT_RELATIVE_CANDIDATES.map(
      (relativePath) => path2.resolve(moduleDir, relativePath)
    ),
    ...additionalCandidates.map((candidate) => path2.resolve(candidate))
  ];
  const seenRoots = /* @__PURE__ */ new Set();
  for (const root of candidates) {
    if (seenRoots.has(root)) continue;
    seenRoots.add(root);
    const isDirectory = await fs2.stat(root).then((stats) => stats.isDirectory()).catch(() => false);
    if (isDirectory) return root;
  }
  return null;
}
async function listSkillEntries(moduleDir, additionalCandidates = []) {
  const root = await resolveSkillsDir(moduleDir, additionalCandidates);
  if (!root) return [];
  try {
    const entries = await fs2.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => ({
      name: entry.name,
      source: path2.join(root, entry.name)
    }));
  } catch {
    return [];
  }
}
async function readSkillMarkdown(moduleDir, skillName) {
  const normalized = skillName.trim().toLowerCase();
  if (!normalized) return null;
  const entries = await listSkillEntries(moduleDir);
  const match = entries.find((entry) => entry.name === normalized);
  if (!match) return null;
  try {
    return await fs2.readFile(path2.join(match.source, "SKILL.md"), "utf8");
  } catch {
    return null;
  }
}
async function ensureSkillSymlink(source, target, linkSkill = (linkSource, linkTarget) => fs2.symlink(linkSource, linkTarget)) {
  const existing = await fs2.lstat(target).catch(() => null);
  if (!existing) {
    await linkSkill(source, target);
    return "created";
  }
  if (!existing.isSymbolicLink()) {
    return "skipped";
  }
  const linkedPath = await fs2.readlink(target).catch(() => null);
  if (!linkedPath) return "skipped";
  const resolvedLinkedPath = path2.resolve(path2.dirname(target), linkedPath);
  if (resolvedLinkedPath === source) {
    return "skipped";
  }
  const linkedPathExists = await fs2.stat(resolvedLinkedPath).then(() => true).catch(() => false);
  if (linkedPathExists) {
    return "skipped";
  }
  await fs2.unlink(target);
  await linkSkill(source, target);
  return "repaired";
}
async function removeMaintainerOnlySkillSymlinks(skillsHome, allowedSkillNames) {
  const allowed = new Set(Array.from(allowedSkillNames));
  try {
    const entries = await fs2.readdir(skillsHome, { withFileTypes: true });
    const removed = [];
    for (const entry of entries) {
      if (allowed.has(entry.name)) continue;
      const target = path2.join(skillsHome, entry.name);
      const existing = await fs2.lstat(target).catch(() => null);
      if (!existing?.isSymbolicLink()) continue;
      const linkedPath = await fs2.readlink(target).catch(() => null);
      if (!linkedPath) continue;
      const resolvedLinkedPath = path2.isAbsolute(linkedPath) ? linkedPath : path2.resolve(path2.dirname(target), linkedPath);
      if (!isMaintainerOnlySkillTarget(linkedPath) && !isMaintainerOnlySkillTarget(resolvedLinkedPath)) {
        continue;
      }
      await fs2.unlink(target);
      removed.push(entry.name);
    }
    return removed;
  } catch {
    return [];
  }
}

export {
  MAX_CAPTURE_BYTES,
  MAX_EXCERPT_BYTES,
  parseObject,
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseJson,
  appendWithCap,
  defaultPathForPlatform,
  ensurePathInEnv,
  buildAgentEnv,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  runningProcesses,
  runChildProcess,
  resolvePathValue,
  renderTemplate,
  joinPromptSections,
  redactEnvForLogs,
  resolveSkillsDir,
  listSkillEntries,
  readSkillMarkdown,
  ensureSkillSymlink,
  removeMaintainerOnlySkillSymlinks
};
//# sourceMappingURL=chunk-Z6GQFNVV.js.map