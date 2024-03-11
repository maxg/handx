import assert from 'assert/strict';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import express from 'express';

import { env } from './config.js';

class Mismatch extends Error {
  constructor(message: string) {
    super(message + ', please try reloading the page');
  }
}

export const submit = express.Router();

submit.use((req, res, next) => {
  handleSubmit(req, res.locals).then(result => res.json(result), err => next(err));
});
submit.use(((err, req, res, next) => {
  console.error(err);
  res.status(400).type('text/plain').end(err.message);
}) satisfies express.ErrorRequestHandler);

async function handleSubmit(req: express.Request, locals: Record<string, any>) {
  const handout = req.body.handout;
  assert(typeof handout === 'string');
  assert(/^\w[\w-]*\w$/.test(handout));
  const student = JSON.parse(req.body.student);

  const filename = path.join(env.METADATA, locals.site, handout + '.json');
  const config = JSON.parse(await fs.readFile(filename, { encoding: 'utf8' }));

  if (locals.setup.maintenance) {
    throw new Error('exercise submission is down for maintenance, please come back later');
  }

  const username = req.session?.username;
  if (( ! username) && locals.setup.login_until && (new Date().toISOString() <= locals.setup.login_until)) {
    throw new Error('please log in to submit exercises');
  }

  for (const exercise of config.exercises) {
    if (exercise.id !== student.id) { continue; }

    const result = scoreExercise(exercise, student);
    const recorded = await omnivore(locals.setup.omnivore, username, config, student, result);
    return {
      result,
      exercise: req.body.reveal || result.correct ? exercise : undefined,
      recorded,
    };
  }

  throw new Mismatch('unknown exercise');
}

function map<T, U>(arr: T[], fn: (elt: T, idx: number) => U): U[] {
  return Array.prototype.map.call<T[], [typeof fn], U[]>(arr, fn);
}

function scoreExercise(expect: any, student: any) {
  if (expect.category !== student.category) {
    throw new Mismatch('unexpected exercise category');
  }
  if (expect.node !== student.node) {
    throw new Mismatch('unexpected exercise');
  }

  const parts = map(expect.parts, (expect, idx) => scorePart(expect, student.parts[idx]));
  return {
    correct: parts.every(part => part.correct),
    parts,
  };
}

function scorePart(expect: any, student: any) {
  if (expect.node !== student.node) {
    throw new Mismatch('unexpected exercise part');
  }

  const choices = map(expect.choices, (expect, idx) => scoreChoice(expect, student.choices[idx]));
  return {
    correct: choices.every(choice => choice),
  };
}

function scoreChoice(expect: any, student: any) {
  if (expect.node !== student.node) {
    throw new Mismatch('unexpected exercise question');
  }

  if (expect.regex) {
    const match = expect.regex.match(/^\/(.+)\/([imxo]*)/);
    if ( ! match) throw new Error('invalid exercise regex');
    const regex = new RegExp(`^(${match[1]})$`, match[2]);
    return regex.test(student.input);
  }
  return expect.expected === student.input;
}

async function omnivore(url: string, username: string, config: any, student: any, result: ReturnType<typeof scoreExercise>) {
  if ( ! url) {
    return undefined;
  }
  if ( ! username) {
    return undefined;
  }
  const id = [ config.part, student.id.replace('/', '-') ].filter(str => str).join('-');
  const prefix = [ config.kind, config.handout, student.category, id ].join('/');
  const ts = new Date().toISOString();
  const records = result.parts.flatMap((part, idx) => {
    const dir = `/${prefix}-${student.parts[idx].node}`;
    const answer = map(student.parts[idx].choices, getChoice).filter(choice => choice !== false).join('\n');
    return [
      { username, key: `${dir}/correct`, ts, value: part.correct },
      { username, key: `${dir}/answer`, ts, value: answer },
    ];
  });
  const json = JSON.stringify(records);

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(json);
  const signature = sign.sign(env.OMNIVORE_PRIVATE_KEY, 'base64');

  const response = await fetch(`${url}/api/v2/multiadd`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Omnivore-Signed': `handx ${signature}`,
    },
    body: json,
  });
  return response.status === 200;
}

function getChoice(student: any) {
  if (student.input === true) {
    return student.node;
  }
  return student.input;
}
