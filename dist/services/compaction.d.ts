import type { CompactionContext } from "../types/index.js";
export interface CompactionOptions {
    threshold?: number;
    minTokens?: number;
    cooldownMs?: number;
    getModelLimit?: (providerID: string, modelID: string) => number | undefined;
}
export declare function createCompactionHook(ctx: CompactionContext, tags: {
    user: string;
    project: string;
}, options?: CompactionOptions): {
    event({ event }: {
        event: {
            type: string;
            properties?: unknown;
        };
    }): Promise<void>;
};
//# sourceMappingURL=compaction.d.ts.map