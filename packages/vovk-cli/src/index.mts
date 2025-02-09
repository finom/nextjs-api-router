#!/usr/bin/env node
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import 'dotenv/config';
import { Command } from 'commander';
import concurrently from 'concurrently';
import type { VovkSchema } from 'vovk';
import getAvailablePort from './utils/getAvailablePort.mjs';
import getProjectInfo from './getProjectInfo/index.mjs';
import generate from './generate/index.mjs';
import locateSegments from './locateSegments.mjs';
import { VovkDev } from './dev/index.mjs';
import newComponents from './new/index.mjs';
import type { DevOptions, GenerateOptions, NewOptions, VovkConfig, VovkEnv } from './types.mjs';
import initProgram from './initProgram.mjs';

export type { VovkConfig, VovkEnv };

const program = new Command();

const packageJSON = JSON.parse(readFileSync(path.join(import.meta.dirname, '../package.json'), 'utf-8')) as {
  version: string;
};

program.name('vovk').description('Vovk CLI').version(packageJSON.version);

initProgram(program.command('init'));

program
  .command('dev')
  .alias('d')
  .description('start schema watcher (optional flag --next-dev to start it with Next.js)')
  .argument('[nextArgs...]', 'extra arguments for the dev command')
  .option('--next-dev', 'start schema watcher and Next.js with automatic port allocation')
  .option('--exit', 'kill the processe when schema and client is generated')
  .action(async (nextArgs: string[], options: DevOptions) => {
    const { nextDev, exit = false } = options;
    const portAttempts = 30;
    const PORT = !nextDev
      ? process.env.PORT
      : process.env.PORT ||
        (await getAvailablePort(3000, portAttempts, 0, (failedPort, tryingPort) =>
          // eslint-disable-next-line no-console
          console.warn(`🐺 Port ${failedPort} is in use, trying ${tryingPort} instead.`)
        ).catch(() => {
          throw new Error(`🐺 ❌ Failed to find an available port after ${portAttempts} attempts`);
        }));

    if (!PORT) {
      throw new Error('🐺 ❌ PORT env variable is required');
    }

    if (nextDev) {
      const { result } = concurrently(
        [
          {
            command: `npx next dev ${nextArgs.join(' ')}`,
            name: 'Next.js Development Server',
            env: { PORT } satisfies VovkEnv,
          },
          {
            command: `node ${import.meta.dirname}/dev/index.mjs`,
            name: 'Vovk Dev Watcher',
            env: {
              PORT,
              __VOVK_START_WATCHER_IN_STANDALONE_MODE__: 'true' as const,
              __VOVK_EXIT__: exit ? 'true' : 'false',
            } satisfies VovkEnv,
          },
        ],
        {
          killOthers: ['failure', 'success'],
          prefix: 'none',
          successCondition: 'first',
        }
      );
      try {
        await result;
      } finally {
        // do nothing, all processes are killed
      }
    } else {
      void new VovkDev().start({ exit });
    }
  });

program
  .command('generate')
  .alias('g')
  .description('Generate RPC client from schema')
  .option('--out, --client-out-dir <path>', 'path to output directory')
  .option(
    '--template, --templates <templates...>',
    'client code templates ("ts", "compiled", "python", "none", a custom path)'
  )
  .option('--full-schema [fileName]', 'generate client with full schema')
  .option('--prettify', 'prettify output files')
  .action(async (options: GenerateOptions) => {
    const { clientOutDir, templates, prettify, fullSchema } = options;
    const projectInfo = await getProjectInfo({ clientOutDir });
    const { cwd, config, apiDir } = projectInfo;
    const segments = await locateSegments({ dir: apiDir, config });
    const schemaOutAbsolutePath = path.join(cwd, config.schemaOutDir);
    const schemaImportUrl = pathToFileURL(path.join(schemaOutAbsolutePath, 'main.cjs')).href;
    const { default: segmentsSchema } = (await import(schemaImportUrl)) as {
      default: Record<string, VovkSchema>;
    };

    await generate({
      projectInfo,
      segments,
      segmentsSchema,
      templates,
      prettify,
      fullSchema,
      forceNothingWrittenLog: true,
    });
  });

program
  .command('new [components...]')
  .alias('n')
  .description(
    'create new components. "vovk new [...components] [segmentName/]moduleName" to create a new module or "vovk new segment [segmentName]" to create a new segment'
  )
  .option('-o, --overwrite', 'overwrite existing files')
  .option(
    '--template, --templates <templates...>',
    'override config template; accepts an array of strings that correspond the order of the components'
  )
  .option('--dir <dirname>', 'override dirName in template file; relative to the root of the project')
  .option('--empty', 'create an empty module')
  .option('--no-segment-update', 'do not update segment files when creating a new module')
  .option('--dry-run', 'do not write files to disk')
  .action((components: string[], options: NewOptions) => newComponents(components, options));

program
  .command('help')
  .description('Show help message')
  .action(() => program.help());

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
