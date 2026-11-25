import fs from 'fs';

/**
 * Archivo de la base SQLite (desarrollo y pruebas). sql.js trabaja en memoria y vuelca la base
 * completa al archivo en cada guardado. Antes se escribía directamente encima: si el proceso se
 * detenía a mitad de la escritura (p. ej. cuando Playwright cierra el servidor al terminar las
 * pruebas), el archivo quedaba truncado y la base no volvía a abrir («database disk image is
 * malformed»). Ahora:
 *   - cada guardado se escribe completo en `<archivo>.tmp`, se fuerza a disco y se renombra sobre
 *     el definitivo, así que el archivo siempre tiene una versión entera (la anterior o la nueva);
 *   - los guardados de un mismo archivo van en fila y cada uno toma los datos cuando le toca, de
 *     modo que no se pisan y el último deja el estado más reciente;
 *   - al abrir, una base dañada se detecta y el servidor no arranca ni la modifica.
 */

const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const queues = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Escribe `data` en `filePath` pasando por `<filePath>.tmp`; nunca deja el archivo a medias. */
export async function writeFileAtomic(filePath, data, { renameRetries = 5, retryDelayMs = 100 } = {}) {
  const tmpPath = `${filePath}.tmp`;
  const handle = await fs.promises.open(tmpPath, 'w');
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  // En Windows el renombrado falla a ratos si otro proceso abre el archivo un instante
  // (antivirus, indexador): se reintenta antes de dar el guardado por fallido.
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.rename(tmpPath, filePath);
      return;
    } catch (err) {
      if (attempt >= renameRetries || !RETRYABLE_RENAME_CODES.has(err.code)) throw err;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }
}

/**
 * Pone en fila un guardado de `filePath`. `produceData` (puede ser async) se llama cuando le toca
 * escribir, para guardar el estado de ese momento. Devuelve la promesa de ese guardado.
 */
export function queueFileWrite(filePath, produceData) {
  const previous = queues.get(filePath) || Promise.resolve();
  const task = previous.then(async () => writeFileAtomic(filePath, await produceData()));
  const tail = task.catch(() => {});
  queues.set(filePath, tail);
  tail.then(() => {
    if (queues.get(filePath) === tail) queues.delete(filePath);
  });
  return task;
}

/** Revisa una base sql.js recién abierta: null si está sana, o el motivo si está dañada. */
export function sqliteIntegrityProblem(db) {
  try {
    const result = db.exec('PRAGMA quick_check');
    const value = result[0]?.values?.[0]?.[0];
    return value === 'ok' ? null : String(value ?? 'quick_check no devolvió resultado');
  } catch (err) {
    return err.message;
  }
}

/** Mensaje al arrancar con una base dañada: qué pasó y cómo recuperarse. */
export function damagedDatabaseMessage(filePath, problem) {
  return `La base SQLite ${filePath} está dañada (${problem}) y no se modificó. ` +
    'Apártala (renómbrala, p. ej. a database.danada-AAAA-MM-DD.sqlite, que git ignora) y crea una nueva ' +
    'con «npm run seed» y «npm run seed:questions» (DOCUMENTATION.md, sección 13).';
}
