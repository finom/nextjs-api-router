// @ts-check
const fs = require('fs/promises');
const path = require('path');

/** @type {(path: string) => Promise<boolean>} */
const fileExists = async (path) => !!(await fs.stat(path).catch(() => false));

async function postinstall() {
  const vovk = path.join(__dirname, '../../.vovk');
  const js = path.join(vovk, 'index.js');
  const ts = path.join(vovk, 'index.d.ts');

  if ((await fileExists(js)) || (await fileExists(ts))) {
    return;
  }

  await fs.mkdir(vovk, { recursive: true });
  await fs.writeFile(js, '/* postinstall */');
  await fs.writeFile(ts, '/* postinstall */');
}

void postinstall();
