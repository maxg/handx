import assert from 'assert/strict';
import fs from 'fs';
import http from 'http';
import path from 'path';

import express from 'express';
import bodyparser from 'body-parser';
import session from 'cookie-session';

import { env } from './config.js';
import * as openid from './openid.js';
import { structure } from './structure.js';
import { submit } from './submit.js';

const production = process.env.NODE_ENV === 'production';
const port = production ? 80 : 9080;
const origin = production ? `https://${env.WEB_HOST}` : `http://${env.WEB_HOST}:${port}`;

const sites: string[] = JSON.parse(env.SITES);
assert(fs.existsSync(env.METADATA), `missing METADATA: ${env.METADATA}`);

async function main() {
  const app = express();
  app.set('trust proxy', 'uniquelocal');
  app.set('view engine', 'pug');
  app.set('x-powered-by', false);

  const v1 = express.Router();

  v1.use(session({
    name: 'handx', secret: env.WEB_SECRET, signed: true, overwrite: true,
    secure: production, httpOnly: true, sameSite: production ? 'none' : 'lax',
  }));

  const auth = await openid.auth({
    server: `https://${env.OIDC_HOST}`,
    client: {
      client_id: env.OIDC_ID,
      client_secret: env.OIDC_SECRET,
      redirect_uris: [ `${origin}/v1/auth` ],
    },
    email_domain: env.OIDC_EMAIL_DOMAIN,
  });
  v1.get('/auth', auth.handle);

  const cors: express.RequestHandler = (req, res, next) => {
    if (res.locals.setup.origins.includes(req.get('origin'))) {
      res.set({
        'Access-Control-Allow-Origin': req.get('origin'),
        'Access-Control-Allow-Credentials': 'true',
      });
    }
    next();
  };

  for (const site of sites) {
    const router = express.Router({ strict: true });
    function meta(file: string) {
      return fs.readFileSync(path.join(env.METADATA, site, file), { encoding: 'utf8' });
    }

    router.use((req, res, next) => {
      Object.assign(res.locals, {
        site,
        setup: JSON.parse(meta('setup.json')),
      });
      next();
    });
    router.get('/status', (req, res, next) => {
      res.render('status', {
        site_style: meta('style.css'),
        site_motd: meta('motd.html'),
        username: req.session?.username,
      });
    });
    router.get('/login', auth.require, (req, res, next) => {
      res.render('login', {
        site_style: meta('style.css'),
        username: req.session?.username,
      });
    });
    router.get('/structure', cors, structure);
    router.post('/submit', bodyparser.urlencoded({ extended: false }), cors, submit);

    v1.use(`/${site}`, router);
  }

  app.use('/v1', v1);
  app.use((req, res, next) => res.status(404).end());

  http.createServer(app).listen(port, () => console.log('listening'));
}

main();
