import { getSimulatorEntry } from '../config/simulatorCatalog.js';

/** Paso de la malla en palabras (el servidor no tiene los títulos de los videos). */
export function stepDescription(stepId) {
  if (stepId === null || stepId === undefined) return 'ninguno: ya terminaste el curso';
  if (stepId === 'exam') return 'el examen final';
  const match = /^m(\d+)_([vs])(\d+)$/.exec(stepId);
  if (!match) return stepId;
  const [, moduleNumber, kind, index] = match;
  if (kind === 'v') return `el video ${index} del módulo ${moduleNumber}`;
  const title = getSimulatorEntry(stepId)?.title;
  return `el minijuego ${index} del módulo ${moduleNumber}${title ? ` («${title}»)` : ''}`;
}
