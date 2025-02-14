import path from 'node:path';
import fs from 'node:fs/promises';
import ejs from 'ejs';
import type { VovkSchema } from 'vovk';
import type { ProjectInfo } from '../getProjectInfo/index.mjs';
import type { Segment } from '../locateSegments.mjs';
import formatLoggedSegmentName from '../utils/formatLoggedSegmentName.mjs';
import prettify from '../utils/prettify.mjs';
import { GenerateOptions } from '../types.mjs';
import getClientTemplates from './getClientTemplates.mjs';
import chalkHighlightThing from '../utils/chalkHighlightThing.mjs';
import uniq from 'lodash/uniq.js';

export default async function generate({
  projectInfo,
  segments,
  segmentsSchema,
  forceNothingWrittenLog,
  templates,
  prettify: prettifyClient,
  fullSchema,
}: {
  projectInfo: ProjectInfo;
  segments: Segment[];
  segmentsSchema: Record<string, VovkSchema>;
  forceNothingWrittenLog?: boolean;
} & Pick<GenerateOptions, 'templates' | 'prettify' | 'fullSchema'>): Promise<{ written: boolean; path: string }> {
  const generateFrom = templates ?? projectInfo.config.generateFrom;
  const noClient = templates?.[0] === 'none';
  const { config, cwd, log, clientImports, apiRoot } = projectInfo;

  const { clientOutDirAbsolutePath, templateFiles } = getClientTemplates({ config, cwd, generateFrom });
  // Ensure that each segment has a matching schema if it needs to be emitted:
  for (let i = 0; i < segments.length; i++) {
    const { segmentName } = segments[i];
    const schema = segmentsSchema[segmentName];
    if (!schema) {
      throw new Error(`Unable to generate client. No schema found for ${formatLoggedSegmentName(segmentName)}`);
    }
    if (!schema.emitSchema) continue;
  }

  const now = Date.now();

  // Data for the EJS templates:
  const t = {
    apiRoot,
    imports: clientImports,
    segments,
    fullSchema: segmentsSchema,
  };

  // Process each template in parallel
  const processedTemplates = noClient
    ? []
    : await Promise.all(
        templateFiles.map(async ({ templatePath, outPath, templateName }) => {
          // Read the EJS template
          const templateContent = await fs.readFile(templatePath, 'utf-8');

          // Render the template
          let rendered = templatePath.endsWith('.ejs')
            ? ejs.render(
                templateContent,
                { t },
                {
                  filename: templatePath,
                }
              )
            : templateContent;

          // Optionally prettify
          if (prettifyClient || config.prettifyClient) {
            rendered = await prettify(rendered, outPath);
          }

          // Read existing file content to compare
          const existingContent = await fs.readFile(outPath, 'utf-8').catch(() => '');

          // Determine if we need to rewrite the file, ignore 1st line
          const needsWriting =
            existingContent.trim().split('\n').slice(1).join('\n') !== rendered.trim().split('\n').slice(1).join('\n');

          return {
            outPath,
            rendered,
            needsWriting,
            templateName,
          };
        })
      );

  const usedTemplateNames = uniq(
    processedTemplates.filter(({ needsWriting }) => needsWriting).map(({ templateName }) => templateName)
  );

  let fullSchemaNames: string[] = [];

  const DEFAULT_NAME = 'full-schema.json';

  if (fullSchema) {
    fullSchemaNames.push(typeof fullSchema === 'string' ? fullSchema : DEFAULT_NAME);
    fullSchemaNames.push(
      ...templateFiles
        .filter(({ fullSchema }) => fullSchema)
        .map(({ fullSchema }) => (typeof fullSchema === 'string' ? fullSchema : DEFAULT_NAME))
    );
  }

  fullSchemaNames = uniq(fullSchemaNames);

  if (fullSchemaNames.length || usedTemplateNames.length > 0) {
    // Make sure the output directory exists
    await fs.mkdir(clientOutDirAbsolutePath, { recursive: true });
  }

  if (fullSchemaNames.length) {
    await Promise.all(
      fullSchemaNames.map(async (name) => {
        const fullSchemaOutAbsolutePath = path.resolve(clientOutDirAbsolutePath, name);
        await fs.writeFile(fullSchemaOutAbsolutePath, JSON.stringify(segmentsSchema, null, 2));
        log.info(`Full schema has ben written to ${fullSchemaOutAbsolutePath}`);
      })
    );
  }

  if (usedTemplateNames.length === 0) {
    const logOrDebug = forceNothingWrittenLog ? log.info : log.debug;
    logOrDebug(`Client is up to date and doesn't need to be regenerated (${Date.now() - now}ms)`);
    return { written: false, path: clientOutDirAbsolutePath };
  }

  // Write updated files where needed
  await Promise.all(
    processedTemplates.map(({ outPath, rendered, needsWriting }) => {
      if (needsWriting) {
        return fs.writeFile(outPath, rendered);
      }
      return null;
    })
  );

  log.info(
    `Client generated from template${usedTemplateNames.length !== 1 ? 's' : ''} ${chalkHighlightThing(usedTemplateNames.map((s) => `"${s}"`).join(', '))} at ${clientOutDirAbsolutePath} in ${Date.now() - now}ms`
  );
  return { written: true, path: clientOutDirAbsolutePath };
}
