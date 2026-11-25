import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { queueFileWrite, sqliteIntegrityProblem, writeFileAtomic } from '../../server/config/sqliteFile.js';

/**
 * Guardado seguro de la base SQLite (desarrollo y pruebas): el archivo nunca queda a medias, una
 * base dañada no arranca ni se modifica, y un guardado no deshace una transacción abierta.
 * Todo corre sobre archivos temporales, nunca sobre database.sqlite.
 */
const ARCOC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const SQLITE_FILE_URL = new URL('../../server/config/sqliteFile.js', import.meta.url).href;
const DB_MODULE_URL = new URL('../../server/config/db.js', import.meta.url).href;
const KILL_TEST_SIZE = 8 * 1024 * 1024;

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'arcoc-sqlite-'));
}

/** Lanza `node` con DATABASE_URL vacío (siempre SQLite, también en npm run test:pg). */
function spawnNode(args, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: ARCOC_DIR,
    env: { ...process.env, DATABASE_URL: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const run = { child, output: '' };
  child.stdout.on('data', (d) => { run.output += d; });
  child.stderr.on('data', (d) => { run.output += d; });
  run.exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  return run;
}

async function waitForExit(run, timeoutMs = 30000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      run.child.kill('SIGKILL');
      reject(new Error(`El proceso no terminó a tiempo. Salida:\n${run.output}`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([run.exited, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Escribe sin parar A y B (8 MiB cada uno) con writeFileAtomic; avisa «listo» tras la primera. */
const WRITER_SCRIPT = `
const { writeFileAtomic } = await import(process.env.MODULE_URL);
const size = Number(process.env.SIZE);
const a = Buffer.alloc(size, 0x41);
const b = Buffer.alloc(size, 0x42);
for (let n = 0; ; n++) {
  await writeFileAtomic(process.env.TARGET, n % 2 ? a : b);
  if (n === 0) process.stdout.write('listo\\n');
}
`;

/** Abre una base en un archivo temporal, deja armado el guardado y espera 900 ms dentro de una transacción. */
const TRANSACTION_SCRIPT = `
const db = await import(process.env.DB_MODULE_URL);
await db.initDb();
await db.run('CREATE TABLE IF NOT EXISTS prueba_guardado (x TEXT)');
await db.withTransaction(async (tx) => {
  await tx.run("INSERT INTO prueba_guardado (x) VALUES ('antes')");
  await new Promise((resolve) => setTimeout(resolve, 900));
  await tx.run("INSERT INTO prueba_guardado (x) VALUES ('despues')");
});
const rows = await db.all('SELECT x FROM prueba_guardado ORDER BY rowid');
await db.closeDb();
console.log('FILAS=' + JSON.stringify(rows.map((r) => r.x)));
`;

/** Base SQLite válida de varias páginas (para truncarla después). */
async function sampleDatabase() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE notas (id INTEGER PRIMARY KEY, texto TEXT)');
  const insert = db.prepare('INSERT INTO notas (texto) VALUES (?)');
  for (let i = 0; i < 2000; i++) insert.run([`nota ${i} `.padEnd(200, 'x')]);
  insert.free();
  const bytes = Buffer.from(db.export());
  db.close();
  return { SQL, bytes };
}

test.describe('Guardado seguro de la base SQLite', () => {
  test('Guardado atómico: escribe completo, reemplaza el anterior, va en fila y no deja temporales', async () => {
    const dir = tempDir();
    try {
      const target = path.join(dir, 'base.sqlite');
      await writeFileAtomic(target, Buffer.from('uno'));
      await writeFileAtomic(target, Buffer.from('dos'));
      expect(fs.readFileSync(target, 'utf8')).toBe('dos');
      expect(fs.existsSync(`${target}.tmp`)).toBe(false);

      // Cinco guardados a la vez: cada uno toma sus datos cuando le toca y gana el último
      const calls = [];
      await Promise.all([1, 2, 3, 4, 5].map((n) => queueFileWrite(target, async () => {
        calls.push(n);
        return Buffer.from(`v${n}`);
      })));
      expect(calls).toEqual([1, 2, 3, 4, 5]);
      expect(fs.readFileSync(target, 'utf8')).toBe('v5');

      // Un guardado que falla no bloquea los siguientes ni toca el archivo
      const failed = queueFileWrite(target, () => { throw new Error('fallo al exportar'); });
      const next = queueFileWrite(target, () => Buffer.from('v6'));
      await expect(failed).rejects.toThrow('fallo al exportar');
      await next;
      expect(fs.readFileSync(target, 'utf8')).toBe('v6');
      expect(fs.readdirSync(dir)).toEqual(['base.sqlite']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('Si el proceso muere a mitad de un guardado, el archivo queda entero (el anterior o el nuevo)', async () => {
    test.setTimeout(90000);
    const dir = tempDir();
    try {
      const target = path.join(dir, 'base.sqlite');
      for (const delayMs of [20, 90, 250]) {
        fs.writeFileSync(target, Buffer.alloc(KILL_TEST_SIZE, 0x41));
        const writer = spawnNode(['--input-type=module', '-e', WRITER_SCRIPT], {
          MODULE_URL: SQLITE_FILE_URL, TARGET: target, SIZE: String(KILL_TEST_SIZE),
        });
        await expect.poll(() => writer.output, { timeout: 20000 }).toContain('listo');
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        writer.child.kill('SIGKILL');
        await waitForExit(writer);
        expect(writer.output).not.toContain('Error');

        const content = fs.readFileSync(target);
        expect(content.length).toBe(KILL_TEST_SIZE);
        const other = content[0] === 0x41 ? 0x42 : 0x41;
        expect([0x41, 0x42]).toContain(content[0]);
        expect(content.indexOf(other)).toBe(-1);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('Una base dañada se detecta: el servidor no arranca, explica cómo recuperarse y no la modifica', async () => {
    const { SQL, bytes } = await sampleDatabase();
    expect(sqliteIntegrityProblem(new SQL.Database(bytes))).toBeNull();

    // Truncada como la dejaba un guardado interrumpido, o un archivo que no es una base
    const truncated = bytes.subarray(0, Math.floor(bytes.length / 4096 * 0.6) * 4096);
    expect(sqliteIntegrityProblem(new SQL.Database(truncated))).toEqual(expect.any(String));
    expect(sqliteIntegrityProblem(new SQL.Database(Buffer.from('esto no es una base de datos '.repeat(300)))))
      .toEqual(expect.any(String));

    const dir = tempDir();
    try {
      const damaged = path.join(dir, 'danada.sqlite');
      fs.writeFileSync(damaged, truncated);
      const server = spawnNode(['server.js'], { SQLITE_PATH: damaged, PORT: '5098' });
      expect(await waitForExit(server)).toBe(1);
      expect(server.output).toContain('está dañada');
      expect(server.output).toContain('npm run seed');
      expect(fs.readFileSync(damaged).equals(truncated)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('Un guardado que llega durante una transacción espera a que termine y no la deshace', async () => {
    test.setTimeout(60000);
    const dir = tempDir();
    try {
      const file = path.join(dir, 'transaccion.sqlite');
      const run = spawnNode(['--input-type=module', '-e', TRANSACTION_SCRIPT], {
        DB_MODULE_URL, SQLITE_PATH: file,
      });
      expect(await waitForExit(run)).toBe(0);
      expect(run.output).toContain('FILAS=["antes","despues"]');

      const SQL = await initSqlJs();
      const saved = new SQL.Database(fs.readFileSync(file));
      expect(saved.exec('SELECT x FROM prueba_guardado ORDER BY rowid')[0].values.flat()).toEqual(['antes', 'despues']);
      saved.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
