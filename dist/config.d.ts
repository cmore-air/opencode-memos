export declare const MEMOS_API_KEY: string | undefined;
export declare const MEMOS_USER_ID: string | undefined;
export declare const MEMOS_CHANNEL: string | undefined;
export declare const CONFIG: {
    baseUrl: string;
    similarityThreshold: number;
    maxMemories: number;
    maxProfileItems: number;
    injectProfile: boolean;
    keywordPatterns: string[];
    compactionThreshold: number;
    minTokensForCompaction: number;
    compactionCooldownSeconds: number;
    containerTagPrefix: string;
    userContainerTag: string | undefined;
    projectContainerTag: string | undefined;
    maxProjectMemories: number;
    readableCubeIds: string[];
    writableCubeIds: string[];
    defaultAddMode: "fast" | "fine";
};
export declare function isConfigured(): boolean;
//# sourceMappingURL=config.d.ts.map