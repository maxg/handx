import assert from 'assert/strict';

enum Vars {
  SITES, DESTINATION,
  GITHUB_HOST, GITHUB_APP_ID, GITHUB_WEBHOOK_SECRET, GITHUB_PRIVATE_KEY,
}

export const env = new Proxy({} as { readonly [Var in (keyof typeof Vars)]: string }, {
  get(_, key: keyof typeof Vars): string {
    const val = process.env[key];
    assert(val, `config ${key} missing`);
    return val;
  }
});
