'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import ReportProblemButton from './ReportProblemButton';

/**
 * Preguntas frecuentes del estudiante (Fase 6). Las reglas del examen salen del perfil
 * (/api/student/me → exam), así que no se repiten a mano.
 */
export default function FaqView() {
  const { user } = useAuth();
  const exam = user?.exam || {};
  const questionCount = exam.questionCount ?? '—';
  const passScore = exam.passScore ?? '—';
  const maxAttempts = exam.maxAttempts ?? '—';
  const wildcardCost = exam.wildcardCost ?? '—';

  const items = [
    {
      id: 'avance',
      q: '¿Cómo avanzo en el curso?',
      a: (
        <>
          El curso tiene 5 módulos, y cada uno alterna 3 videos con 3 minijuegos del simulador: 30 pasos en total. Se avanza en
          orden: cada paso se habilita al completar el anterior. Un video cuenta como visto cuando lo ves completo, y un minijuego
          se finaliza con «Finalizar práctica», después de terminar al menos una partida. «Continuar donde quedé» te lleva al paso
          que te toca.
        </>
      ),
    },
    {
      id: 'puntos',
      q: '¿Qué son los Puntos de Reserva y cómo los gano?',
      a: (
        <>
          Cada partida terminada de un minijuego suma según su nivel: <strong>10</strong> si es perfecta (70 % o más y sin errores),
          <strong> 5</strong> si aprobó con errores y <strong>0</strong> si no aprobó. Un minijuego aporta como máximo 50 puntos y el
          saldo total llega hasta 500. Los puntos sirven para el comodín 50/50 del examen, que cuesta {wildcardCost} y elimina dos
          opciones incorrectas. En <Link href="/course/progreso#progress-points" className="text-cyan">Mi progreso</Link> ves de dónde
          salió cada punto.
        </>
      ),
    },
    {
      id: 'examen',
      q: '¿Cómo es el examen final?',
      a: (
        <>
          Se habilita al completar los 30 pasos. Cada intento tiene {questionCount} preguntas y se aprueba con {passScore} % o más;
          tienes {maxAttempts} intentos. Las preguntas no se repiten de un intento a otro mientras queden preguntas que no hayas
          visto. Durante el examen la cámara verifica que seas tú: si tu rostro deja de verse por un tiempo o cambias de pestaña,
          el examen puede suspenderse.
        </>
      ),
    },
    {
      id: 'intentos',
      q: '¿Qué pasa si no apruebo en los intentos que tengo?',
      a: (
        <>
          Tu coordinador revisa el caso. Si lo justifica (por ejemplo, una falla técnica que reportaste), puede concederte un
          intento adicional; te llega un correo cuando lo hace.
        </>
      ),
    },
    {
      id: 'certificado',
      q: '¿Cómo obtengo mi certificado?',
      a: (
        <>
          Al aprobar el examen. Lo descargas en PDF desde <Link href="/course/progreso#progress-exam" className="text-cyan">Mi
          progreso</Link>, y trae un código con el que una institución puede verificar que es auténtico.
        </>
      ),
    },
    {
      id: 'problema',
      q: 'Un video o un minijuego no funcionó, ¿qué hago?',
      a: (
        <>
          Usa «Reportar un problema» en ese paso: el reporte le llega al coordinador con los datos de tu navegador, y la respuesta
          te llega por correo. Si el problema afectó tu avance, puede reabrir el paso para que lo hagas de nuevo. Tus reportes y
          sus respuestas están en «Mis reportes».
        </>
      ),
    },
    {
      id: 'cierre',
      q: '¿Qué pasa cuando cierra mi promoción?',
      a: (
        <>
          El curso queda en modo consulta: puedes ver los videos, tu progreso y tu certificado, pero ya no se registran pasos,
          partidas ni intentos del examen.
        </>
      ),
    },
    {
      id: 'contrasena',
      q: 'Olvidé mi contraseña o quiero cambiar mis datos',
      a: (
        <>
          Recupera la contraseña en <Link href="/recuperar" className="text-cyan">«¿Olvidaste tu contraseña?»</Link>: te llega un
          enlace por correo. Para corregir tu nombre, documento o institución, usa «Solicitar una corrección» en{' '}
          <Link href="/course/progreso#progress-account" className="text-cyan">Mi progreso</Link>.
        </>
      ),
    },
    {
      id: 'camara',
      q: '¿Qué pasa con las imágenes de mi cámara?',
      a: (
        <>
          La cámara se usa al registrar tu rostro y durante el examen. Las imágenes se analizan en tu navegador y no se envían: el
          servidor solo guarda, cifrado, un descriptor numérico de tu rostro para comparar que seas tú.
        </>
      ),
    },
  ];

  return (
    <div className="container py-course" id="faq">
      <div className="page-header mb-24">
        <div className="hero-badge mb-16">❓ Ayuda</div>
        <h1 className="hero-title">Preguntas frecuentes</h1>
        <p className="hero-subtitle">Cómo funciona el curso, los puntos, el examen y el certificado.</p>
      </div>
      {items.map((item) => (
        <details key={item.id} className="card p-16 mb-12 faq-item" id={`faq-${item.id}`}>
          <summary className="font-bold">{item.q}</summary>
          <div className="text-sm text-secondary mt-8">{item.a}</div>
        </details>
      ))}
      <div className="card p-16 mt-16 flex-between items-center flex-wrap gap-12">
        <span className="text-sm">¿No encontraste tu respuesta?</span>
        <ReportProblemButton category="other" label="🛟 Escríbele a tu coordinador" />
      </div>
    </div>
  );
}
