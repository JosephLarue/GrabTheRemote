// Encrypts env files so they can be committed. The key never leaves your machine.
//
//   pnpm env:keygen                  create .env.key (keep it, never commit it)
//   pnpm env:encrypt [.env.local]    .env.local -> .env.local.enc
//   pnpm env:decrypt [.env.local]    .env.local.enc -> .env.local (--force to overwrite)
//
// The key is read from ENV_KEY, or from .env.key. AES-256-GCM, so a wrong key or a
// tampered file fails loudly instead of producing garbage.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const KEY_FILE = '.env.key';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function fail(message: string): never {
  console.error(`env-crypt: ${message}`);
  process.exit(1);
}

function loadKey(): Buffer {
  const raw = process.env.ENV_KEY ?? (existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8') : '');
  if (!raw.trim()) fail(`no key. Set ENV_KEY or run "pnpm env:keygen" to create ${KEY_FILE}.`);
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== 32) fail('key must be 32 bytes, base64-encoded.');
  return key;
}

function keygen() {
  if (existsSync(KEY_FILE)) fail(`${KEY_FILE} already exists. Delete it first if you really want a new key.`);
  writeFileSync(KEY_FILE, randomBytes(32).toString('base64') + '\n', { mode: 0o600 });
  console.log(`Wrote ${KEY_FILE}. Back it up somewhere safe: without it, the .enc files are unreadable.`);
}

function encrypt(plainPath: string) {
  if (!existsSync(plainPath)) fail(`${plainPath} not found.`);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv);
  const body = Buffer.concat([cipher.update(readFileSync(plainPath)), cipher.final()]);
  const out = Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  writeFileSync(`${plainPath}.enc`, out + '\n');
  console.log(`Encrypted ${plainPath} -> ${plainPath}.enc`);
}

function decrypt(plainPath: string, force: boolean) {
  const encPath = `${plainPath}.enc`;
  if (!existsSync(encPath)) fail(`${encPath} not found.`);
  if (existsSync(plainPath) && !force) fail(`${plainPath} already exists. Pass --force to overwrite it.`);
  const data = Buffer.from(readFileSync(encPath, 'utf8').trim(), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', loadKey(), data.subarray(0, IV_BYTES));
  decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  let plain: Buffer;
  try {
    plain = Buffer.concat([decipher.update(data.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
  } catch {
    fail(`cannot decrypt ${encPath}: wrong key or corrupted file.`);
  }
  writeFileSync(plainPath, plain, { mode: 0o600 });
  console.log(`Decrypted ${encPath} -> ${plainPath}`);
}

const [command, ...rest] = process.argv.slice(2);
const force = rest.includes('--force');
const file = rest.find((arg) => !arg.startsWith('--')) ?? '.env.local';

if (command === 'keygen') keygen();
else if (command === 'encrypt') encrypt(file);
else if (command === 'decrypt') decrypt(file, force);
else fail('usage: env-crypt <keygen|encrypt|decrypt> [file] [--force]');
