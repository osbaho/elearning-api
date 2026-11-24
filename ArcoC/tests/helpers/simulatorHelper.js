const API = 'http://localhost:5000/api';

// Minijuegos de la malla (m<módulo>_s<n>). Todos exigen una partida terminada para finalizarse.
// Los que aún no están en el build WebGL (ready: false en server/config/simulatorCatalog.js)
// admiten partidas por API fuera de producción, que es como corre la suite.
const PRACTICE_STEP_PATTERN = /^m\d+_s\d+$/;

export const PERFECT_RESULT = { score: 100, maxScore: 100, passed: true, errorCount: 0, doseMsv: 0, timeSeconds: 1 };

/**
 * Juega una partida del simulador vía API, igual que hace la página de práctica cuando
 * Unity reporta una fase: crea el intento y envía su resultado.
 * `request` debe estar autenticado (p. ej. page.request después de iniciar sesión).
 */
export async function playSimulatorPhase(request, stepId, result = {}) {
  const startRes = await request.post(`${API}/simulator/attempts`, { data: { stepId } });
  if (!startRes.ok()) {
    throw new Error(`No se pudo crear el intento para ${stepId}: ${startRes.status()} ${await startRes.text()}`);
  }
  const attempt = await startRes.json();
  const resultRes = await request.post(`${API}/simulator/attempts/${attempt.attemptId}/result`, {
    data: { phase: attempt.phase, ...PERFECT_RESULT, ...result },
  });
  if (!resultRes.ok()) {
    throw new Error(`No se pudo registrar el resultado de ${stepId}: ${resultRes.status()} ${await resultRes.text()}`);
  }
  return { attempt, result: await resultRes.json() };
}

/**
 * Marca un paso como completado. Si es un minijuego, primero juega una partida
 * (la API exige al menos una partida terminada para finalizarlo).
 */
export async function completeStep(request, stepId) {
  if (PRACTICE_STEP_PATTERN.test(stepId)) {
    await playSimulatorPhase(request, stepId);
  }
  const res = await request.post(`${API}/progress/${stepId}`);
  if (!res.ok()) {
    throw new Error(`No se pudo completar ${stepId}: ${res.status()} ${await res.text()}`);
  }
  return res;
}
