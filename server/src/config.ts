import assert from 'assert/strict';

enum Vars {
  WEB_HOST, SITES, METADATA,
  OIDC_HOST, OIDC_ID, OIDC_SECRET, OIDC_EMAIL_DOMAIN,
  WEB_SECRET,
  OMNIVORE_PRIVATE_KEY,
}

export const env = new Proxy({} as { readonly [Var in (keyof typeof Vars)]: string }, {
  get(_, key: keyof typeof Vars): string {
    const val = process.env[key];
    assert(val, `config ${key} missing`);
    return val;
  }
});
