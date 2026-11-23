/**
 * Catálogo del simulador Unity WebGL: qué escena y qué fase juega cada paso práctico.
 *
 * La API es la dueña de esta correlación. La página de práctica pide un intento,
 * recibe { scene, phase } y se los pasa a Unity en la URL del iframe; Unity solo
 * carga lo que se le indica y devuelve el resultado etiquetado con el intento.
 *
 * Para incorporar otro módulo:
 *   1. Crear su escena en el proyecto Unity y añadirla a Build Settings.
 *   2. Registrar aquí sus pasos (p. ej. m2_s1 → { scene: 'M02', phase: 1 }).
 *   3. Volver a generar el build WebGL (menú CArm → Build WebGL para ArcoC).
 * Los pasos sin entrada aquí muestran la práctica como "en desarrollo".
 */
export const SIMULATOR_CATALOG = Object.freeze({
  m1_s1: Object.freeze({ scene: 'Scene1', phase: 1, minigameId: 'MG1_ProtocolZero', title: 'Protocolo Cero: Arquitectura del Arco' }),
  m1_s2: Object.freeze({ scene: 'Scene1', phase: 2, minigameId: 'MG2_BeamMaster', title: 'Maestro del Haz: Consola y Dispersión' }),
  m1_s3: Object.freeze({ scene: 'Scene1', phase: 3, minigameId: 'MG3_IsocenterCommand', title: 'Comando Isocentro: Bucle Cerrado' }),
});

export function getSimulatorEntry(stepId) {
  if (typeof stepId !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(SIMULATOR_CATALOG, stepId)
    ? SIMULATOR_CATALOG[stepId]
    : null;
}
