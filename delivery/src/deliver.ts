import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

import { Octokit } from '@octokit/rest';
import { createAppAuth, type InstallationAccessTokenAuthentication } from '@octokit/auth-app';
import type { PushEvent, Repository } from '@octokit/webhooks-types';

import { env } from './config.js';
import { Render } from './render.js';

const sites = new Map<string, string>(Object.entries(JSON.parse(env.SITES)));

export async function* manual(owner: string, repo: string, installationId: number, head: string, paths: string[]) {
  const reponame = `${owner}/${repo}`;
  if ( ! sites.has(reponame)) {
    throw new Error(`unknown repo ${reponame}`);
  }
  const octokit = new Octokit({
    baseUrl: `https://${env.GITHUB_HOST}/api/v3`,
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
      installationId,
    },
  });
  await octokit.auth({ type: 'installation', installationId });
  const repository = (await octokit.repos.get({ owner, repo })).data as Repository;
  const repo_head = (await octokit.repos.getBranch({ owner, repo, branch: repository.default_branch })).data.commit.sha;
  if (head !== repo_head) {
    throw new Error(`incorrect HEAD revision for ${reponame}`);
  }
  yield* deliver(repository, installationId, { paths });
}

export async function* push(push: PushEvent) {
  const reponame = push.repository.full_name;
  if ( ! push.repository.owner.name) {
    throw new Error(`missing repo owner name in event from ${reponame}`);
  }
  if ( ! push.installation) {
    throw new Error(`missing installation in event from ${reponame}`);
  }
  if (push.ref !== `refs/heads/${push.repository.default_branch}`) {
    return;
  }
  yield* deliver(push.repository, push.installation.id, { push });
}

type Spec = { push: PushEvent } | { paths: string[] };

async function* deliver(repository: Repository, installationId: number, spec: Spec) {
  const reponame = repository.full_name;
  const sitename = sites.get(reponame);
  if ( ! sitename) {
    throw new Error(`no site for repo ${reponame}`);
  }
  yield `${reponame} Deliver to ${sitename}`;
  const octokit = new Octokit({
    baseUrl: `https://${env.GITHUB_HOST}/api/v3`,
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
      installationId,
    },
  });
  const { token } = await octokit.auth({ type: 'installation', installationId }) as InstallationAccessTokenAuthentication;
  const url = new URL(repository.clone_url);
  url.username = 'x-access-token';
  url.password = token;

  const src = await fs.mkdtemp(path.join(os.tmpdir(), 'handx-src-'));
  setTimeout(() => fs.rm(src, { recursive: true }), 1000 * 60 * 10);
  // TODO clone to the actual depth
  spawnSync('git', [
    'clone', '--quiet', '--depth', '10', url.toString(), '.' ], { cwd: src, encoding: 'utf8', stdio: 'inherit' });

  await fs.cp(path.join(src, 'web', 'handx'), path.join(env.DESTINATION, 'meta', sitename), { recursive: true });

  const updated = 'push' in spec ? findUpdated(spec.push.before, spec.push.after, src) : filterHandouts(spec.paths, src);
  if (updated.size === 0) {
    yield `${reponame} Nothing to update`;
    return;
  }
  yield `${reponame} Will update ${[ ...updated ].join(', ')}`;

  await using render = new Render();

  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'handx-out-'));
  setTimeout(() => fs.rm(out, { recursive: true }), 1000 * 60 * 10);
  const [ webout, metaout ] = [ path.join(out, 'web'), path.join(out, 'meta') ];

  for (const dir of updated) {
    yield `${reponame} Rendering ${dir}`;
    for (const file of findFiles(path.join(src, dir, 'handout'))) {
      await render.file(src, dir, file, webout, metaout)
    }
  }

  const webpath = path.join(env.DESTINATION, 'web', sitename);
  for (const dir of updated) {
    const dest = path.join(webpath, dir);
    if ( ! existsSync(dest)) {
      yield `${reponame} Skipping ${dir}: destination does not exist`;
      continue;
    }
    yield `${reponame} Delivering ${dir}`;
    await fs.cp(path.join(webout, dir), dir === 'home' ? webpath : dest, { recursive: true });
    await fs.mkdir(path.join(env.DESTINATION, 'meta', sitename), { recursive: true });
    await fs.cp(path.join(metaout, dir), path.join(env.DESTINATION, 'meta', sitename), { recursive: true });
  }
  yield `${reponame} Done`;
}

function filterHandouts(paths: string[], cwd: string): Set<string> {
  const { stdout, error } = spawnSync('find', [
    '-L', '.', '-type', 'd', '-name', 'handout' ], { cwd, encoding: 'utf8' });
  if (error) { throw error };
  return new Set(stdout.split('\n').map(line => line.match(/^\.\/(.*)\/handout/)?.[1]).filter(nonnull).filter(line => paths.includes(line)));
}

function findUpdated(before: string, after: string, cwd: string): Set<string> {
  const { stdout, error } = spawnSync('git', [
    'diff', '--name-only', before, after ], { cwd, encoding: 'utf8' });
  if (error) { throw error; }
  return new Set(stdout.split('\n').map(line => line.match(/(.*)\/handout\//)?.[1]).filter(nonnull));
}

function findFiles(cwd: string): string[] {
  const { stdout, error } = spawnSync('find', [
    '-L', '.', '-type', 'f' ], { cwd, encoding: 'utf8' });
  if (error) { throw error; }
  return stdout.split('\n').map(line => line.match(/^\.\/(.*)/)?.[1]).filter(nonnull);
}

function nonnull<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}
