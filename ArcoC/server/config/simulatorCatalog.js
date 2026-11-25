/**
 * Catálogo del simulador Unity WebGL: qué escena y qué fase juega cada paso práctico.
 *
 * La API es la dueña de esta correlación. La página de práctica pide un intento,
 * recibe { scene, phase } y se los pasa a Unity en la URL del iframe; Unity solo
 * carga lo que se le indica y devuelve el resultado etiquetado con el intento.
 *
 * Cada módulo del curso es una escena del build con nombre estándar ModuloNN (Modulo01,
 * Modulo02…) y cada uno de sus tres minijuegos es una fase (1–3) de esa escena.
 *
 * Todos los minijuegos de la malla (curriculum.js) tienen entrada aquí. `ready` indica si su
 * escena ya está en el build WebGL publicado:
 *   - ready: true  → la práctica carga Unity y se juega.
 *   - ready: false → la práctica se muestra "en desarrollo". En producción no admite partidas,
 *                    así que el estudiante no puede finalizarla ni avanzar más allá. Fuera de
 *                    producción la API sí las admite (pruebas y botones de simulación).
 *
 * Para publicar los minijuegos de un módulo:
 *   1. Crear su escena en el proyecto Unity (Assets/Scenes/ModuloNN.unity) y añadirla a Build Settings.
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

export const SIMULATOR_CATALOG = Object.freeze({
  m1_s1: entry({ scene: 'Modulo01', phase: 1, minigameId: 'MG1_ProtocolZero', title: 'Protocolo Cero: Arquitectura del Arco', ready: true }),
  m1_s2: entry({ scene: 'Modulo01', phase: 2, minigameId: 'MG2_BeamMaster', title: 'Maestro del Haz: Consola y Dispersión', ready: true }),
  m1_s3: entry({ scene: 'Modulo01', phase: 3, minigameId: 'MG3_IsocenterCommand', title: 'Comando Isocentro: Bucle Cerrado', ready: true }),
  m2_s1: entry({ scene: 'Modulo02', phase: 1, minigameId: 'M02_MG1_DoseSentinel', title: 'Centinela Dosimétrico: Semáforo ALARA', ready: false }),
  m2_s2: entry({ scene: 'Modulo02', phase: 2, minigameId: 'M02_MG2_ShieldInspector', title: 'Escáner de Blindaje: EPP, Gestación y DRF', ready: false }),
  m2_s3: entry({ scene: 'Modulo02', phase: 3, minigameId: 'M02_MG3_ScatterZone5P', title: 'Zona Segura 5-P: Scatter y Perímetro 2 m', ready: false }),
  m3_s1: entry({ scene: 'Modulo03', phase: 1, minigameId: 'M03_MG1_HardwareOptics', title: 'Arquitecto del Haz: FPD, Colimación y LIH', ready: false }),
  m3_s2: entry({ scene: 'Modulo03', phase: 2, minigameId: 'M03_MG2_ConsoleMaster', title: 'Maestro de Consola: Pulsos, ABC y Pediatría', ready: false }),
  m3_s3: entry({ scene: 'Modulo03', phase: 3, minigameId: 'M03_MG3_KinematicsNavigator', title: 'Navegador 8-DoF: Frenos y Bucle Cerrado', ready: false }),
  m4_s1: entry({ scene: 'Modulo04', phase: 1, minigameId: 'M04_MG1_HipTractionAO3', title: 'Estación Cadera (AO 3): Tracción y Centro-Centro', ready: false }),
  m4_s2: entry({ scene: 'Modulo04', phase: 2, minigameId: 'M04_MG2_KneeLaserAlignment', title: 'Ortogonalidad y Láser: Rodilla a 90°', ready: false }),
  m4_s3: entry({ scene: 'Modulo04', phase: 3, minigameId: 'M04_MG3_AnkleMortise3D', title: 'Mortaja y Barrido 3D: Tobillo (AO 4)', ready: false }),
  m5_s1: entry({ scene: 'Modulo05', phase: 1, minigameId: 'M05_MG1_ShoulderElbowViews', title: 'Hombro y Codo Ortogonal: Grashey y 90°', ready: false }),
  m5_s2: entry({ scene: 'Modulo05', phase: 2, minigameId: 'M05_MG2_WristMiniCArmSafety', title: 'Muñeca y Manos Fuera del Haz: Mini C-Arm', ready: false }),
  m5_s3: entry({ scene: 'Modulo05', phase: 3, minigameId: 'M05_MG3_SpineParallax3D', title: 'Desafío Espinal 3D: Paralelaje y Pedículos', ready: false }),
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
