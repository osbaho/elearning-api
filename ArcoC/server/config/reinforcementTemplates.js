/**
 * Correos de refuerzo (Fase 5): el texto de cada tipo de alerta. El admin lo edita desde la bandeja
 * (tabla reinforcement_templates); si no lo ha cambiado, se usa el original de aquí.
 *
 * El texto lleva variables entre llaves dobles ({{nombre}}) y párrafos separados por una línea en
 * blanco. «Sin activar» no tiene plantilla: su refuerzo reenvía la invitación con un enlace de
 * activación nuevo.
 */
export const TEMPLATE_VARIABLES = Object.freeze({
  nombre: 'Nombre del estudiante',
  promocion: 'Promoción',
  avance: 'Avance en porcentaje (sin el signo %)',
  pasos_completados: 'Pasos completados',
  pasos_totales: 'Pasos de la malla',
  paso_actual: 'Paso en el que va (p. ej. «el video 2 del módulo 1»)',
  dias_sin_actividad: 'Días sin actividad',
  avance_esperado: 'Avance esperado a la fecha (porcentaje)',
  fecha_cierre: 'Fecha de cierre de la promoción',
  dias_para_cierre: 'Días que faltan para el cierre',
  minijuego: 'Minijuego con dificultades',
  partidas: 'Partidas de ese minijuego sin aprobar',
  enlace_curso: 'Enlace para entrar al curso',
});

export const TEMPLATE_LIMITS = Object.freeze({ SUBJECT_MAX: 150, BODY_MAX: 4000 });

const HELP = 'Si algo te impide avanzar, responde este correo o usa «Reportar un problema» dentro del curso.';

export const DEFAULT_TEMPLATES = Object.freeze({
  inactive: Object.freeze({
    subject: 'Te esperamos de vuelta en el curso de Arco en C',
    body: [
      'Hola, {{nombre}}:',
      'Hace {{dias_sin_actividad}} días que no entras al curso de Arco en C y Radioprotección Quirúrgica. Llevas el {{avance}} % de la ruta ({{pasos_completados}} de {{pasos_totales}} pasos).',
      'Tu siguiente paso es {{paso_actual}}. Al ingresar, el curso te lleva directo a él.',
      HELP,
    ].join('\n\n'),
  }),
  behind_schedule: Object.freeze({
    subject: 'Tu avance en el curso va por debajo de lo previsto',
    body: [
      'Hola, {{nombre}}:',
      'Llevas el {{avance}} % del curso ({{pasos_completados}} de {{pasos_totales}} pasos). A esta altura de tu promoción ({{promocion}}) se esperaba alrededor del {{avance_esperado}} %, y la promoción cierra el {{fecha_cierre}}.',
      'Te recomendamos reservar un rato esta semana para retomar desde {{paso_actual}}.',
      HELP,
    ].join('\n\n'),
  }),
  cohort_closing: Object.freeze({
    subject: 'Quedan {{dias_para_cierre}} días para el cierre de tu promoción',
    body: [
      'Hola, {{nombre}}:',
      'Tu promoción ({{promocion}}) cierra el {{fecha_cierre}}: quedan {{dias_para_cierre}} días. Llevas el {{avance}} % del curso ({{pasos_completados}} de {{pasos_totales}} pasos).',
      'Para certificarte necesitas completar la ruta y aprobar el examen final antes del cierre. Tu siguiente paso es {{paso_actual}}.',
      HELP,
    ].join('\n\n'),
  }),
  minigame_struggling: Object.freeze({
    subject: 'Consejos para el minijuego «{{minijuego}}»',
    body: [
      'Hola, {{nombre}}:',
      'Llevas {{partidas}} partidas del minijuego «{{minijuego}}» sin aprobarlo todavía. Es una práctica exigente y es normal que tome varios intentos.',
      'Antes de volver a jugar, repasa el video anterior del módulo y lee con calma las instrucciones del inicio de la partida. Al terminar, el simulador te muestra qué estuvo mal.',
      'Si crees que el simulador no funciona bien, usa «Reportar un problema» desde la práctica.',
    ].join('\n\n'),
  }),
  exam_exhausted: Object.freeze({
    subject: 'Sobre tus intentos del examen final',
    body: [
      'Hola, {{nombre}}:',
      'Usaste los intentos disponibles del examen final sin alcanzar la nota mínima. Tu coordinador revisará tu caso y te contactará con los siguientes pasos.',
      'Mientras tanto, puedes repasar los videos y las prácticas: siguen disponibles en tu cuenta.',
    ].join('\n\n'),
  }),
});

/** Valores de ejemplo para la vista previa del editor de plantillas. */
export const SAMPLE_VALUES = Object.freeze({
  nombre: 'Ana María Rodríguez',
  promocion: 'Promoción 2026-1',
  avance: 37,
  pasos_completados: 11,
  pasos_totales: 30,
  paso_actual: 'el minijuego 3 del módulo 2',
  dias_sin_actividad: 9,
  avance_esperado: 60,
  fecha_cierre: '15/12/2026',
  dias_para_cierre: 5,
  minijuego: 'Maestro del Haz: Consola y Dispersión',
  partidas: 3,
  enlace_curso: 'https://tu-dominio/login',
});

const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Nombres de las variables que usa un texto. */
export function templateVariablesIn(text) {
  return [...String(text).matchAll(VARIABLE_PATTERN)].map((m) => m[1]);
}

/** Valida { subject, body } de una plantilla. Devuelve { value } normalizado o { error }. */
export function validateTemplate(input) {
  const subject = typeof input?.subject === 'string' ? input.subject.trim() : '';
  const body = typeof input?.body === 'string' ? input.body.replace(/\r\n?/g, '\n').trim() : '';
  if (!subject) return { error: 'El asunto es obligatorio.' };
  if (/\n/.test(subject)) return { error: 'El asunto va en una sola línea.' };
  if (subject.length > TEMPLATE_LIMITS.SUBJECT_MAX) {
    return { error: `El asunto admite hasta ${TEMPLATE_LIMITS.SUBJECT_MAX} caracteres.` };
  }
  if (!body) return { error: 'El texto del correo es obligatorio.' };
  if (body.length > TEMPLATE_LIMITS.BODY_MAX) {
    return { error: `El texto admite hasta ${TEMPLATE_LIMITS.BODY_MAX} caracteres.` };
  }
  const unknown = [...new Set([...templateVariablesIn(subject), ...templateVariablesIn(body)])]
    .filter((name) => !(name in TEMPLATE_VARIABLES));
  if (unknown.length) {
    return { error: `Variables desconocidas: ${unknown.map((name) => `{{${name}}}`).join(', ')}.` };
  }
  return { value: { subject, body } };
}

/** Reemplaza las variables por sus valores; una que no tiene valor queda como «—». */
export function renderTemplate(text, values) {
  return String(text).replace(VARIABLE_PATTERN, (_, name) => {
    const value = values[name];
    return value === null || value === undefined || value === '' ? '—' : String(value);
  });
}
