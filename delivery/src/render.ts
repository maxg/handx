import assert from 'assert/strict';
import fs from 'fs/promises';
import path from 'path';

import puppeteer from 'puppeteer-core';

export class Render implements AsyncDisposable {

  #browser = puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: 'new',
    args: [ '--no-sandbox' ],
  });

  async file(src: string, dir: string, file: string, webout: string, metaout: string) {
    await fs.mkdir(path.dirname(path.join(webout, dir, file)), { recursive: true });
    await fs.mkdir(path.join(metaout, dir), { recursive: true });
    const handouts = path.join(src, dir, 'handout');
    if (await needsRender(file, handouts)) {
      const { content, meta } = await this.page(src, dir, file);
      await fs.writeFile(path.join(webout, dir, file), fixRelative(dir, content));
      for (const [ id, data ] of Object.entries(meta)) {
        await fs.writeFile(path.join(metaout, dir, `${id}.json`), fixRelative(dir, data));
      }
    } else if (needsFix(file)) {
      const content = await fs.readFile(path.join(handouts, file), { encoding: 'utf8' });
      await fs.writeFile(path.join(webout, dir, file), fixRelative(dir, content));
    } else {
      await fs.copyFile(path.join(handouts, file), path.join(webout, dir, file));
    }
  }

  async page(src: string, dir: string, file: string) {
    const [ kind, handout, ...parts ] = `${dir}/${file.replace(/(index)?\.s?html/, '')}`.split('/');
    const deliver = `?handout-deliver=${kind}/${handout || 'index'}/${parts.length ? parts.join('-') : ''}/`;
    const page = await (await this.#browser).newPage();
    page.on('error', err => console.error(`${dir}/${file} error`, err));
    page.on('pageerror', err => console.log(`${dir}/${file} uncaught`, err));
    await page.goto(`file://${src}/${dir}/handout/${file}${deliver}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document?.documentElement?.lastChild?.textContent?.includes('HANDOUT_DELIVERY\t'));
    const result = await page.content();
    page.close();
    // TODO programmatic access instead?
    const regex = /^HANDOUT_DELIVERY\t([^ ]+) (.*)\n/m;
    const delivered = result.match(regex);
    return {
      content: result.replace(regex, ''),
      meta: delivered ? { [delivered[1]!]: delivered[2]! } : {},
    }
  }

  async [Symbol.asyncDispose]() {
    (await this.#browser).close();
  }
}

async function needsRender(file: string, cwd: string): Promise<boolean> {
  if ( ! file.endsWith('.html')) { return false; }
  return (await fs.readFile(path.join(cwd, file), { encoding: 'utf8' })).includes('handout-page.js');
}

function needsFix(file: string): boolean {
  return file.endsWith('.html') || file.endsWith('.shtml') || file.endsWith('.svg');
}

function fixRelative(dir: string, text: string): string {
  // fix paths to site CSS & JavaScript
  // ="../../../web/handout/handout-file" -> ="../../web/handout-file"
  const noHandout = text.replace(/(="[^"]*)\/\.\.\/([^"]*)\/handout\/([^"]*")/g, '$1/$2/$3');

  // fix paths to index files
  // ="../../web/index.html" -> ="../../web/", ="dir/index.html" -> ="dir/"
  const noIndex = noHandout.replace(/(="(?:[^":]+\/)*)index\.s?html([^"]*")/g, '$1$2');

  if (dir !== 'home') { return noIndex; }
  // fix relative paths from home page
  // ="../web/something" -> ="web/something"
  return noIndex.replace(/(=")\.\.\/([^"]*")/g, '$1$2');
}

async function cli() {
  await using render = new Render();
  const [ src, dir, file, out ] = [ 2, 3, 4, 5 ].map(i => process.argv[i]);
  assert(src && dir && file && out);
  console.log(`Render ${src} ${dir} ${file} to ${out}`);
  await render.file(src, dir, file, path.join(out, 'web'), path.join(out, 'meta'));
}

if (import.meta.url === `file://${process.argv[1]}`.replace(/(\.js)?$/, '.js')) {
  cli();
}
