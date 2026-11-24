#!/usr/bin/env node
/**
 * Corre la suite E2E (Playwright) contra PostgreSQL en lugar de SQLite.
 *
 *   npm run test:pg                                   toda la suite
 *   npm run test:pg -- tests/e2e/22-*.test.js         argumentos para Playwright
 *
 * Sin configuración levanta un PostgreSQL 16 desechable (paquete embedded-postgres, sin Docker
 * ni instalación en el sistema), crea una base vacía, aplica migraciones y seeds, corre las
 * pruebas y lo borra todo al terminar. Con TEST_DATABASE_URL usa esa base (p. ej. un servicio
 * de PostgreSQL en CI) y no levanta ninguna.
 *
 * Los servidores de desarrollo deben estar detenidos: Playwright arranca los suyos (puertos
 * 5000 y 3000) con DATABASE_URL apuntando a la base de prueba.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arcoRoot = path.resolve(here, '../..');
const PG_PORT = Number(process.env.TEST_PG_PORT || 54329);
const DB_NAME = 'carm_e2e';

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

function run(command, args, { cwd = arcoRoot, env = process.env, shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', shell });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(signal ? 1 : code ?? 1));
  });
}

async function ensureEmbeddedPostgres() {
  if (fs.existsSync(path.join(here, 'node_modules', 'embedded-postgres'))) return;
  console.log('📦 Instalando PostgreSQL de pruebas (solo la primera vez)...');
  const code = await run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: here, shell: process.platform === 'win32' });
  if (code !== 0) throw new Error('No se pudo instalar embedded-postgres (npm ci en scripts/pg-test).');
}

async function startEmbeddedPostgres() {
  await ensureEmbeddedPostgres();
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carm-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port: PG_PORT,
    persistent: false,
    // npm 11 no ejecuta el postinstall que recrea los enlaces de las librerías (Linux/macOS)
    // sin aprobación explícita: la librería los recrea al arrancar
    autoRehydrateSymlinks: true,
    // En Windows initdb toma la codificación del sistema (WIN1252), que no admite los emojis de
    // los correos. Producción (imagen oficial de PostgreSQL) usa UTF8: la prueba también.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: (message) => console.error('[postgres]', message),
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME);
  console.log(`🐘 PostgreSQL de prueba en el puerto ${PG_PORT} (base ${DB_NAME}, datos en ${databaseDir})`);
  return { pg, url: `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}` };
}

async function main() {
  for (const port of [5000, 3000]) {
    if (await portInUse(port)) {
      console.error(`❌ El puerto ${port} está ocupado. Detén los servidores de desarrollo antes de probar contra PostgreSQL.`);
      return 1;
    }
  }

  let embedded = null;
  const stop = async () => {
    if (!embedded) return;
    const { pg } = embedded;
    embedded = null;
    await pg.stop().catch((err) => console.error('No se pudo detener PostgreSQL:', err.message));
  };
  process.once('SIGINT', () => { stop().finally(() => process.exit(130)); });

  try {
    let databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl) {
      embedded = await startEmbeddedPostgres();
      databaseUrl = embedded.url;
    }

    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DATABASE_SSL: process.env.DATABASE_SSL || 'disable',
      // Cuenta de administrador que esperan las pruebas
      ADMIN_EMAIL: 'admin@admin.com',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'test-admin-password',
    };

    // initDb aplica las migraciones; luego el administrador y el banco de 50 preguntas
    for (const script of ['server/scripts/seed.js', 'server/scripts/seed_50_questions.js']) {
      const code = await run(process.execPath, [script], { env });
      if (code !== 0) throw new Error(`Falló ${script}`);
    }

    const playwrightCli = path.join(arcoRoot, 'node_modules', '@playwright', 'test', 'cli.js');
    return await run(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], { env });
  } finally {
    await stop();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('❌', err.message);
    process.exit(1);
  });
