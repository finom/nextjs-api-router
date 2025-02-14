import getUserConfig from './getUserConfig.mjs';
import type { VovkEnv, VovkStrictConfig } from '../types.mjs';
import getRelativeSrcRoot from './getRelativeSrcRoot.mjs';

export default async function getConfig({ clientOutDir, cwd }: { clientOutDir?: string; cwd: string }) {
  const env = process.env as VovkEnv;
  const { configAbsolutePaths, error, userConfig } = await getUserConfig({ cwd });
  const conf = userConfig ?? {};
  const srcRoot = await getRelativeSrcRoot({ cwd });

  const validateOnClientImport = env.VOVK_VALIDATE_ON_CLIENT_PATH ?? conf.validateOnClientImport ?? null;
  const fetcherImport = env.VOVK_FETCHER_PATH ?? conf.fetcherImport ?? 'vovk/dist/client/defaultFetcher.js';
  const createRPCImport = env.VOVK_CREATE_RPC_PATH ?? conf.createRPCImport ?? 'vovk/dist/client/createRPC.js';
  const defaultClientTemplates = ['ts', 'module', 'main'];

  const config: VovkStrictConfig = {
    modulesDir: env.VOVK_MODULES_DIR ?? conf.modulesDir ?? './' + [srcRoot, 'modules'].filter(Boolean).join('/'),
    validateOnClientImport:
      typeof validateOnClientImport === 'string' ? [validateOnClientImport] : validateOnClientImport,
    fetcherImport: typeof fetcherImport === 'string' ? [fetcherImport] : fetcherImport,
    createRPCImport: typeof createRPCImport === 'string' ? [createRPCImport] : createRPCImport,
    schemaOutDir: env.VOVK_SCHEMA_OUT_DIR ?? conf.schemaOutDir ?? './.vovk-schema',
    clientOutDir: clientOutDir ?? env.VOVK_CLIENT_OUT_DIR ?? conf.clientOutDir ?? './node_modules/.vovk-client',
    origin: (env.VOVK_ORIGIN ?? conf.origin ?? '').replace(/\/$/, ''), // Remove trailing slash
    rootEntry: env.VOVK_ROOT_ENTRY ?? conf.rootEntry ?? 'api',
    rootSegmentModulesDirName: env.VOVK_ROOT_SEGMENT_MODULES_DIR_NAME ?? conf.rootSegmentModulesDirName ?? '',
    logLevel: env.VOVK_LOG_LEVEL ?? conf.logLevel ?? 'info',
    prettifyClient: (env.VOVK_PRETTIFY_CLIENT ? !!env.VOVK_PRETTIFY_CLIENT : null) ?? conf.prettifyClient ?? false,
    devHttps: (env.VOVK_DEV_HTTPS ? !!env.VOVK_DEV_HTTPS : null) ?? conf.devHttps ?? false,
    generateFrom:
      typeof conf.generateFrom === 'function'
        ? conf.generateFrom(defaultClientTemplates)
        : (conf.generateFrom ?? ['ts', 'module', 'main']),
    templates: {
      service: 'vovk-cli/templates/service.ejs',
      controller: 'vovk-cli/templates/controller.ejs',
      ...conf.templates,
    },
  };

  return { config, srcRoot, configAbsolutePaths, userConfig, error };
}
