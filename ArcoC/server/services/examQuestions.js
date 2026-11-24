/**
 * Selección de preguntas del examen sin repetir entre intentos.
 *
 * Cada intento toma primero preguntas que el estudiante nunca vio. Solo si el banco no alcanza
 * (por ejemplo, un banco menor que intentos × preguntas, o intentos adicionales concedidos por
 * el admin) completa con preguntas ya vistas, empezando por las que vio hace más intentos.
 * El orden final es aleatorio: las repetidas no quedan agrupadas al final.
 */

function shuffle(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * @param {number[]} bankIds           ids del banco de preguntas
 * @param {number[][]} previousAttempts preguntas de cada intento anterior, del más antiguo al más reciente
 * @param {number} count               preguntas por intento
 * @param {() => number} [random]      generador en [0, 1) (inyectable para pruebas)
 * @returns {number[]} ids del nuevo intento (todas las del banco si tiene menos de `count`)
 */
export function pickExamQuestionIds(bankIds, previousAttempts, count, random = Math.random) {
  const bank = [...new Set(bankIds)];
  // Intento más reciente en el que apareció cada pregunta
  const lastSeen = new Map();
  previousAttempts.forEach((ids, attemptIndex) => {
    for (const id of ids || []) lastSeen.set(id, attemptIndex);
  });

  const unseen = shuffle(bank.filter((id) => !lastSeen.has(id)), random);
  let chosen = unseen.slice(0, count);
  if (chosen.length < count) {
    // sort es estable: dentro de un mismo intento se conserva el orden aleatorio
    const seen = shuffle(bank.filter((id) => lastSeen.has(id)), random)
      .sort((a, b) => lastSeen.get(a) - lastSeen.get(b));
    chosen = [...chosen, ...seen.slice(0, count - chosen.length)];
  }
  return shuffle(chosen, random);
}

/** Lee la lista de ids guardada en JSON; null si no es una lista de enteros válida. */
export function parseQuestionIds(value) {
  try {
    const ids = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(ids) && ids.length > 0 && ids.every(Number.isInteger) ? ids : null;
  } catch {
    return null;
  }
}
