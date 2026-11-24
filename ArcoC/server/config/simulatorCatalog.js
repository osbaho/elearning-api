/**
 * Catálogo del simulador Unity WebGL: qué escena y qué fase juega cada paso práctico.
 *
 * La API es la dueña de esta correlación. La página de práctica pide un intento,
 * recibe { scene, phase } y se los pasa a Unity en la URL del iframe; Unity solo
 * carga lo que se le indica y devuelve el resultado etiquetado con el intento.
 *
 * Todos los minijuegos de la malla (curriculum.js) tienen entrada aquí. `ready` indica si su
 * escena ya está en el build WebGL publicado:
 *   - ready: true  → la práctica carga Unity y se juega.
 *   - ready: false → la práctica se muestra "en desarrollo". En producción no admite partidas,
 *                    así que el estudiante no puede finalizarla ni avanzar más allá. Fuera de
 *                    producción la API sí las admite (pruebas y botones de simulación).
 *
 * Para publicar los minijuegos de un módulo:
 *   1. Crear su escena en el proyecto Unity y añadirla a Build Settings.
 *   2. Ajustar aquí su escena, minigameId y título, y poner ready: true.
 *   3. Volver a generar el build WebGL (menú CArm → Build WebGL para ArcoC).
 *
 * minSeconds: duración real mínima de una partida (desde que la API crea el intento, incluye la
 * carga de Unity). En producción, un resultado más rápido se rechaza: nadie juega la fase tan
 * rápido, así que solo puede venir de un envío automatizado. Ajústalo con datos reales de juego.
 */
const DEFAULT_MIN_SECONDS = 30;

function entry(fields) {
  return Object.freeze({ minSeconds: DEFAULT_MIN_SECONDS, ...fields });
}

/** Minijuegos de un módulo cuyo contenido aún no existe: escena y fases previstas. */
function pendingModule(moduleNumber) {
  const entries = {};
  for (const phase of [1, 2, 3]) {
    entries[`m${moduleNumber}_s${phase}`] = entry({
      scene: `Scene${moduleNumber}`,
      phase,
      minigameId: `M0${moduleNumber}_MG${phase}`,
      title: `Minijuego ${phase} del módulo ${moduleNumber}`,
      ready: false,
    });
  }
  return entries;
}

export const SIMULATOR_CATALOG = Object.freeze({
  m1_s1: entry({ scene: 'Scene1', phase: 1, minigameId: 'MG1_ProtocolZero', title: 'Protocolo Cero: Arquitectura del Arco', ready: true }),
  m1_s2: entry({ scene: 'Scene1', phase: 2, minigameId: 'MG2_BeamMaster', title: 'Maestro del Haz: Consola y Dispersión', ready: true }),
  m1_s3: entry({ scene: 'Scene1', phase: 3, minigameId: 'MG3_IsocenterCommand', title: 'Comando Isocentro: Bucle Cerrado', ready: true }),
  ...pendingModule(2),
  ...pendingModule(3),
  ...pendingModule(4),
  ...pendingModule(5),
});

export function getSimulatorEntry(stepId) {
  if (typeof stepId !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(SIMULATOR_CATALOG, stepId)
    ? SIMULATOR_CATALOG[stepId]
    : null;
}

/** true si la escena del minijuego está en el build WebGL publicado. */
export function isSimulatorStepReady(stepId) {
  return getSimulatorEntry(stepId)?.ready === true;
}

/**
 * Motivo por el que no se puede iniciar una partida de `stepId`, o null si se puede.
 * Función pura: el entorno se recibe como parámetro para poder probar ambos casos.
 */
export function attemptBlockReason(stepId, { production = process.env.NODE_ENV === 'production' } = {}) {
  const simEntry = getSimulatorEntry(stepId);
  if (!simEntry) return 'Este paso no tiene contenido de simulador.';
  if (!simEntry.ready && production) {
    return 'Este minijuego todavía no está disponible en el simulador.';
  }
  return null;
}
