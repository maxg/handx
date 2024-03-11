import type { RequestHandler } from 'express';
import openid from 'openid-client';

export interface Config {
  server: string;
  client: openid.ClientMetadata;
  email_domain: string;
}

interface Handlers {
  handle: RequestHandler;
  require: RequestHandler;
}

export async function auth(config: Config): Promise<Handlers> {
  openid.custom.setHttpOptionsDefaults({ timeout: 1000 * 10 });
  const issuer = await openid.Issuer.discover(config.server);
  const client = new issuer.Client(config.client);

  return {
    async handle(req, res, next) {
      if ( ! req.session) { return res.status(500).end('No session'); }
      if ( ! req.session.login) { return res.status(500).end('No session data'); }
      const params = client.callbackParams(req);
      try {
        const tokenset = await client.callback(config.client.redirect_uris![0], params, {
          nonce: req.session.login.nonce,
        });
        delete req.session.login.nonce;
        const { email } = await client.userinfo(tokenset);
        req.session.username = email?.replace(`@${config.email_domain}`, '');
      } catch {
        return res.status(401).end('Unable to authenticate');
      }
      if (req.session.login.return) {
        res.redirect(req.session.login.return);
      } else {
        res.end('Authenticated');
      }
    },
    async require(req, res, next) {
      if ( ! req.session) { return res.status(500).end('No session'); }
      if ( ! req.session.username) {
        if ( ! req.session.login) { req.session.login = {}; }
        req.session.login.return = req.originalUrl;
        const nonce = req.session.login.nonce = openid.generators.nonce();
        return res.redirect(client.authorizationUrl({ scope: 'openid email', nonce }));
      }
      next();
    },
  }
}
