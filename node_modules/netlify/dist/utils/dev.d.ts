import type { NetlifyAPI } from '@netlify/api';
import type { EnvironmentVariables, SiteInfo } from './types.js';
type ApiAccount = Awaited<ReturnType<NetlifyAPI['listAccountsForUser']>>[number];
type Capabilities = NonNullable<ApiAccount['capabilities']> & {
    background_functions?: {
        included?: boolean | undefined;
    } | undefined;
    ai_gateway_disabled?: {
        included?: boolean | undefined;
    } | undefined;
};
export type Capability = keyof Capabilities;
export type Account = ApiAccount & {
    capabilities?: Capabilities;
};
interface GetSiteInformationOptions {
    api: NetlifyAPI;
    offline: boolean;
    site: {
        id?: string;
    };
    siteInfo: SiteInfo;
}
export interface SiteInformationResult {
    addonsUrls: Record<string, string>;
    siteUrl: string;
    accountId?: string;
    capabilities: {
        backgroundFunctions?: boolean;
        aiGatewayDisabled: boolean;
    };
    timeouts: {
        syncFunctions: number;
        backgroundFunctions: number;
    };
}
export declare const getSiteInformation: ({ api, offline, site, siteInfo, }: GetSiteInformationOptions) => Promise<SiteInformationResult>;
/**
 * @param {{devConfig: any, env: Record<string, { sources: string[], value: string}>, site: any}} param0
 */
export declare const getDotEnvVariables: ({ devConfig, env, site }: {
    devConfig: any;
    env: any;
    site: any;
}) => Promise<EnvironmentVariables>;
/**
 * Takes a set of environment variables in the format provided by @netlify/config and injects them into `process.env`
 */
export declare const injectEnvVariables: (env: EnvironmentVariables) => void;
export declare const acquirePort: ({ configuredPort, defaultPort, errorMessage, }: {
    configuredPort?: number;
    defaultPort: number;
    errorMessage: string;
}) => Promise<number>;
export declare const processOnExit: (fn: any) => void;
export declare const UNLINKED_SITE_MOCK_ID = "unlinked";
export {};
//# sourceMappingURL=dev.d.ts.map