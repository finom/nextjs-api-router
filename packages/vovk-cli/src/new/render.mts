import ejs from 'ejs';
import matter from 'gray-matter';
import _ from 'lodash';
import pluralize from 'pluralize';
import type { VovkConfig } from 'vovk';
import addCommonTerms from './addCommonTerms.mjs';
import type { VovkModuleRenderResult } from '../types.mjs';

addCommonTerms();

export default async function render(
  codeTemplate: string,
  {
    config,
    withService,
    segmentName,
    moduleName,
    empty,
    templateFileName,
  }: {
    cwd: string;
    config: VovkConfig;
    withService: boolean;
    segmentName: string;
    moduleName: string;
    empty?: boolean;
    templateFileName: string;
  }
): Promise<VovkModuleRenderResult> {
  const getModuleDirName = (givenSegmentName: string, givenModuleName: string) =>
    [config.modulesDir, givenSegmentName || config.rootSegmentModulesDirName, _.camelCase(givenModuleName)]
      .filter(Boolean)
      .join('/');

  const theThing = _.camelCase(moduleName);
  const TheThing = _.upperFirst(theThing);
  const the_thing = _.snakeCase(moduleName);
  const THE_THING = _.toUpper(the_thing);
  const the__thing = _.kebabCase(moduleName);

  const t = {
    // module name variations
    moduleName,
    theThing,
    theThings: pluralize(theThing),
    TheThing,
    TheThings: pluralize(TheThing),
    the_thing,
    the_things: pluralize(the_thing),
    THE_THING,
    THE_THINGS: pluralize(THE_THING),
    'the-thing': the__thing,
    'the-things': pluralize(the__thing),

    // data
    config,
    withService,
    segmentName,
    defaultDir: getModuleDirName(segmentName, theThing),

    // libraries
    _, // lodash
    pluralize,
  };

  const parsed = matter((await ejs.render(codeTemplate, { t }, { async: true, filename: templateFileName })).trim());
  const { dir, fileName, sourceName, compiledName } = parsed.data as VovkModuleRenderResult;
  const code = empty ? (sourceName ? `export default class ${sourceName} {}` : '') : parsed.content;

  return {
    dir,
    fileName,
    sourceName,
    compiledName,
    code,
  };
}
