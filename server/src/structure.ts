import fs from 'fs/promises';
import path from 'path';

import type express from 'express';

import { env } from './config.js';

export const structure: express.RequestHandler = (req, res, next) => {
  handleStructure(req, res.locals).then(result => res.json(result), err => next(err));
};

async function handleStructure(req: express.Request, locals: Record<string, any>) {
  const dirname = path.join(env.METADATA, locals.site);

  const ispage = /(\w+-)+\w+\.json/;
  const pages = (await fs.readdir(dirname)).filter(name => ispage.test(name));
  const pairs = pages.map<Promise<[string, any]>>(async name =>
    [ name.replace('.json', ''), await parse(path.join(dirname, name)) ]);
  const configs = new Map(await Promise.all(pairs));
  const roots = [ ...configs.keys() ].filter(page => configs.get(page).indexroot);

  return [ ...gather(configs, roots) ];
}

async function parse(filename: string) {
  return JSON.parse(await fs.readFile(filename, { encoding: 'utf8' }));
}

function* gather(configs: Map<string, any>, roots: string[]): Generator<Entry> {
  for (const root of roots) {
    const config = configs.get(root);
    for (const page of config.toindex) {
      yield entry(configs.get(page));
      yield* gather(configs, [ page ]);
    }
  }
}

function entry(config: any) {
  return {
    handout: [ config.kind, config.handout, config.part ].filter(c => c).join('/'),
    structure: config.structure,
  };
}

type Entry = ReturnType<typeof entry>
