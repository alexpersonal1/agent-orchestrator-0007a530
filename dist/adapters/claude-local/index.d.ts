import { S as ServerAdapterModule, m as AdapterExecutionContext } from '../../types-BaqRpRtt.js';

declare function runClaudeLogin(input: {
    runId: string;
    agent: AdapterExecutionContext["agent"];
    config: Record<string, unknown>;
    context?: Record<string, unknown>;
    authToken?: string;
    onLog?: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
}): Promise<{
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    stdout: string;
    stderr: string;
    loginUrl: string | null;
}>;
declare const claudeLocalAdapter: ServerAdapterModule;

export { claudeLocalAdapter, claudeLocalAdapter as default, runClaudeLogin };
