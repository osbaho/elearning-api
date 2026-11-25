/**
 * Qué hace cada ciclo de supervisión del examen (cada 3 s) con el cuadro de la cámara. Es una
 * función pura para poder probarla (suite 36); la usa useProctoring.
 *
 *   'worker'  el Web Worker está listo y libre: se le envía el cuadro.
 *   'wait'    el worker sigue con el cuadro anterior: se salta este ciclo. Antes se caía al hilo
 *             principal, cuyos modelos no estaban cargados, y salía un error en la consola.
 *   'reset'   el worker lleva WORKER_STALL_MS sin responder: se da por caído y este ciclo ya va al
 *             hilo principal. Sin esto no saldrían más latidos y el servidor suspendería el examen
 *             por pérdida de señal.
 *   'main'    no hay worker (o no se puede usar): detección en el hilo principal.
 *   'skip'    ya hay una detección en curso en el hilo principal.
 */
export const WORKER_STALL_MS = 10000;

export function frameRoute({ workerReady, workerBusySince = null, mainBusy = false, now = Date.now() }) {
  if (workerReady) {
    if (workerBusySince === null || workerBusySince === undefined) return 'worker';
    return now - workerBusySince < WORKER_STALL_MS ? 'wait' : 'reset';
  }
  return mainBusy ? 'skip' : 'main';
}
