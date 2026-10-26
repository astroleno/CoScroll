import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// MIT-licensed official tools. Pin both the revision and bytes; never execute a moving download.
export const INKO_REVISION = 'a1e2d4929d8e97807961a536d7f1e224f5e42b31';
const files = {
  '_common.py': 'd8572b3025725da6c52314198a116539a50e85de664141392490fcfde18882fd',
  '_pen.py': 'a29c370a9f873197ee4ad8457427e5f9623a37be53ac379949fe18c0547856fd',
  'inko.py': '643821a9b2d71579f589feccb26c8d547653981f4dd9cb9ef6719805c27c0229',
  'scene.py': '3cbe6e8044f5044cbdae0615ddcb3c67e4163eea0ccff2c0c27d0b94c2bf9c43',
  LICENSE: '034cdae430667f64d644a89061ed1c45d822fc78cca0634a596d1b39496963ce',
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function ensureInkoSdk(root) {
  const directory = join(root, '.cache/inko-sdk', INKO_REVISION);
  await mkdir(directory, {recursive: true});
  await Promise.all(Object.entries(files).map(async ([name, expected]) => {
    const path = join(directory, name);
    try {if (digest(await readFile(path)) === expected) return;} catch (error) {if (error.code !== 'ENOENT') throw error;}
    const relative = name === 'LICENSE' ? name : `inko-handwriting/scripts/${name}`;
    const response = await fetch(`https://raw.githubusercontent.com/pretend1111/inko-skill/${INKO_REVISION}/${relative}`, {signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Cannot download official Inko tool: ${name} (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (digest(bytes) !== expected) throw new Error(`Official Inko tool checksum mismatch: ${name}`);
    await writeFile(path, bytes);
  }));
  return directory;
}

export function pythonJson(root, script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.COSCROLL_PYTHON || 'python3', [script, ...args], {
      cwd: root, env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'}, stdio: ['ignore', 'pipe', 'inherit'],
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {output += chunk;});
    child.once('error', reject);
    child.once('exit', code => {
      let result;
      try {result = JSON.parse(output);} catch {reject(new Error(`Inko tool failed (${code}); check the diagnostic above`)); return;}
      if (code !== 0 || result.ok === false) {
        reject(new Error(`Inko: ${result.reason || result.error?.code || 'generation_failed'}`)); return;
      }
      resolve(result);
    });
  });
}
