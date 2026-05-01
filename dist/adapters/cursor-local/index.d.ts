import { S as ServerAdapterModule, m as AdapterExecutionContext } from '../../types-BaqRpRtt.js';

type EnsureCursorSkillsInjectedOptions = {
    skillsDir?: string | null;
    skillsEntries?: Array<{
        name: string;
        source: string;
    }>;
    skillsHome?: string;
    linkSkill?: (source: string, target: string) => Promise<void>;
};
declare function ensureCursorSkillsInjected(onLog: AdapterExecutionContext["onLog"], options?: EnsureCursorSkillsInjectedOptions): Promise<void>;

declare const cursorLocalAdapter: ServerAdapterModule;

export { cursorLocalAdapter, cursorLocalAdapter as default, ensureCursorSkillsInjected };
