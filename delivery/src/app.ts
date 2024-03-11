import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import http from 'http';

import express from 'express';
import bodyparser from 'body-parser';
import { Webhooks, createNodeMiddleware } from '@octokit/webhooks';

import { env } from './config.js';
import * as deliver from './deliver.js';

const production = process.env.NODE_ENV === 'production';
const port = production ? 80 : 9180;

assert(fs.existsSync(env.DESTINATION), `missing DESTINATION: ${env.DESTINATION}`);
for (const subdir of [ 'web', 'meta' ]) {
  assert(fs.existsSync(path.join(env.DESTINATION, subdir)), `missing subdir: ${env.DESTINATION}/${subdir}`);
}

function main() {
  const webhooks = new Webhooks({
    secret: env.GITHUB_WEBHOOK_SECRET,
  });
  webhooks.on('ping', event => {});
  webhooks.on('installation', event => {});
  webhooks.on('push', async event => {
    for await (const output of deliver.push(event.payload)) {
      console.log('[push]', output);
    }
  });
  webhooks.onError(error => {
    console.error('webhook error', error.name, error.message);
  });

  const app = express();
  app.set('trust proxy', 'uniquelocal');
  app.set('x-powered-by', false);

  app.use(createNodeMiddleware(webhooks, {
    path: '/delivery/github/webhooks',
  }));
  app.post('/delivery/manual', bodyparser.urlencoded({ extended: false }), (req, res, next) => {
    const { owner, repo, installationId, head, path } = req.body as Record<string, string>;
    async function handle() {
      res.set('transfer-encoding', 'chunked');
      if ( ! (owner && repo && installationId && head && path)) {
        throw new Error('missing parameter');
      }
      for await (const output of deliver.manual(owner, repo, parseInt(installationId), head, [ path ])) {
        console.log('[manual]', output);
        res.write(output + '\n');
      }
    }
    handle().then(() => res.end(), err => res.end(`Error: ${err}`));
  });
  app.use((req, res, next) => res.status(404).end());

  http.createServer(app).listen(port, () => console.log('listening'));
}

main();
