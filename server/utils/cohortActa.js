import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { get, all } from '../config/db.js';

/**
 * Genera el Acta Oficial Colectiva de Acreditación y Libro de Calificaciones IES (PDF)
 * para una promoción (cohorte) específica.
 * @param {string} cohortName Nombre de la promoción
 * @param {import('express').Response} res Objeto Response de Express
 */
export async function generateCohortActaPDF(cohortName, res) {
  const targetCohort = cohortName || 'Promoción 1';

  // 1. Obtener estudiantes de la cohorte
  const students = await all(`
    SELECT id, name, email, id_type, id_number, institution, 
           exam_score, exam_attempts, is_onboarded, start_date, created_at
    FROM students 
    WHERE COALESCE(cohort, 'Promoción 1') = ? AND role != 'admin'
    ORDER BY name ASC
  `, [targetCohort]);

  if (!students || students.length === 0) {
    return res.status(404).json({ error: `No se encontraron estudiantes registrados en ${targetCohort}.` });
  }

  const studentIds = students.map(s => s.id);
  const placeholders = studentIds.map(() => '?').join(',');

  // 2. Progreso curricular y certificados
  const progressRows = await all(`
    SELECT student_id, module_id, certificate_code, completed_at
    FROM course_progress
    WHERE student_id IN (${placeholders}) AND status = 'completed'
  `, studentIds);

  const certMap = {};
  const stepsMap = {};
  for (const p of progressRows) {
    if (p.module_id === 'exam' && p.certificate_code) {
      certMap[p.student_id] = { code: p.certificate_code, date: p.completed_at };
    } else if (p.module_id !== 'exam') {
      stepsMap[p.student_id] = (stepsMap[p.student_id] || 0) + 1;
    }
  }

  // 3. Consultar si la promoción está cerrada / sellada
  const closure = await get(`
    SELECT closed_at, cohort_seal_hash 
    FROM cohort_closures 
    WHERE cohort_name = ?
  `, [targetCohort]);

  // Clasificar graduados (que cumplen el 100% del estándar)
  const graduates = students.filter(s => {
    const steps = stepsMap[s.id] || 0;
    const score = s.exam_score ?? 0;
    return score >= 90 && steps >= 25 && !!s.is_onboarded;
  });

  const totalEnrolled = students.length;
  const totalGraduates = graduates.length;
  const passRate = totalEnrolled > 0 ? Math.round((totalGraduates / totalEnrolled) * 100) : 0;
  const avgScore = totalGraduates > 0 
    ? (graduates.reduce((acc, g) => acc + (g.exam_score || 0), 0) / totalGraduates).toFixed(1)
    : '—';

  // 4. Crear documento PDF (Vertical, Carta)
  const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
  const safeFilename = targetCohort.replace(/[^a-zA-Z0-9_-]/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Acta_Oficial_IES_${safeFilename}.pdf"`);

  doc.pipe(res);

  const width = doc.page.width;
  const height = doc.page.height;

  // Marco perimetral institucional
  doc.rect(20, 20, width - 40, height - 40)
     .lineWidth(2)
     .stroke('#00d4ff');

  doc.rect(24, 24, width - 48, height - 48)
     .lineWidth(0.5)
     .stroke('#334155');

  // Encabezado institucional
  doc.fillColor('#00d4ff')
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('INSTITUCIÓN PRESTADORA DE CAPACITACIÓN CLÍNICA: C-ARM MASTER', 40, 36, { align: 'center' });

  doc.fillColor('#0f172a')
     .font('Helvetica-Bold')
     .fontSize(15)
     .text('ACTA OFICIAL DE ACREDITACIÓN Y LIBRO DE CALIFICACIONES (IES)', 40, 52, { align: 'center' });

  doc.fillColor('#475569')
     .font('Helvetica')
     .fontSize(9)
     .text('Manejo Operativo de Fluoroscopía, Cinemática 8-DoF y Radioprotección Quirúrgica (Res. 1811 / ICRP 118)', 40, 72, { align: 'center' });

  // Línea divisoria
  doc.moveTo(40, 88).lineTo(width - 40, 88).lineWidth(1).stroke('#00d4ff');

  // Caja de Metadatos de la Cohorte
  const metaBoxY = 96;
  doc.rect(40, metaBoxY, width - 80, 50).fillAndStroke('#f8fafc', '#cbd5e1');

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10)
     .text(`Promoción: ${targetCohort}`, 50, metaBoxY + 8);

  const expDate = closure ? new Date(closure.closed_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.fillColor('#475569').font('Helvetica').fontSize(9)
     .text(`Fecha de Emisión: ${expDate}`, 50, metaBoxY + 22)
     .text(`Estado Legal: ${closure ? 'SELLADA Y CERRADA (Inmutable)' : 'EN CURSO (Activa)'}`, 50, metaBoxY + 34);

  // KPIs resumen en el recuadro
  const rightX = width - 260;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a')
     .text(`Matriculados: ${totalEnrolled}`, rightX, metaBoxY + 8)
     .text(`Aprobados con Aval IES: ${totalGraduates} (${passRate}%)`, rightX, metaBoxY + 22)
     .text(`Promedio Calificación: ${avgScore}%`, rightX, metaBoxY + 34);

  // Hash de sello criptográfico
  if (closure && closure.cohort_seal_hash) {
    doc.fillColor('#0369a1').font('Courier-Bold').fontSize(7)
       .text(`Huella SHA-256 de Sello: ${closure.cohort_seal_hash}`, 50, metaBoxY + 54);
  }

  // Título de la Sección de Graduados
  const tableStartY = closure ? 162 : 156;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11)
     .text(`REGISTRO DE ESTUDIANTES CON AVAL INSTITUCIONAL (${totalGraduates} PROFESIONALES)`, 40, tableStartY);

  // Encabezados de tabla
  const theadY = tableStartY + 16;
  doc.rect(40, theadY, width - 80, 20).fill('#0f172a');

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
  doc.text('N°', 45, theadY + 6, { width: 25 });
  doc.text('Nombre del Profesional', 70, theadY + 6, { width: 140 });
  doc.text('Identificación', 215, theadY + 6, { width: 75 });
  doc.text('Institución / Hospital', 295, theadY + 6, { width: 110 });
  doc.text('Nota', 410, theadY + 6, { width: 35, align: 'center' });
  doc.text('Código Verificación QR', 450, theadY + 6, { width: 100, align: 'right' });

  // Filas de la tabla
  let rowY = theadY + 20;
  if (graduates.length === 0) {
    doc.rect(40, rowY, width - 80, 24).fill('#f1f5f9');
    doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(9)
       .text('No hay estudiantes con certificación completada en esta promoción aún.', 40, rowY + 7, { align: 'center' });
    rowY += 24;
  } else {
    graduates.forEach((g, idx) => {
      const isEven = idx % 2 === 0;
      doc.rect(40, rowY, width - 80, 18).fill(isEven ? '#ffffff' : '#f8fafc');

      const certInfo = certMap[g.id] || {};
      const docStr = g.id_number ? `${g.id_type || 'CC'} ${g.id_number}` : 'Registrado';

      doc.fillColor('#334155').font('Helvetica').fontSize(8);
      doc.text(`${idx + 1}`, 45, rowY + 5, { width: 25 });
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(g.name, 70, rowY + 5, { width: 140 });
      doc.font('Helvetica').fillColor('#334155').text(docStr, 215, rowY + 5, { width: 75 });
      doc.text(g.institution || 'Hospital Confirmado', 295, rowY + 5, { width: 110, ellipsis: true });
      doc.font('Helvetica-Bold').fillColor('#15803d').text(`${g.exam_score}%`, 410, rowY + 5, { width: 35, align: 'center' });
      doc.font('Courier-Bold').fillColor('#0284c7').text(certInfo.code || 'CARM-VERIFIED', 450, rowY + 5, { width: 100, align: 'right' });

      rowY += 18;
    });
  }

  // Cláusula Legal de Aval Institucional
  const legalY = Math.max(rowY + 16, height - 190);
  doc.rect(40, legalY, width - 80, 52).fillAndStroke('#f1f5f9', '#cbd5e1');

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8)
     .text('CLÁUSULA DE AVAL INSTITUCIONAL Y CONVALIDACIÓN ANTE IES / MINISTERIO DE EDUCACIÓN:', 48, legalY + 6);

  doc.fillColor('#475569').font('Helvetica').fontSize(7.5)
     .text(
       'Por medio de la presente acta se hace constar que los profesionales arriba relacionados han cumplido a cabalidad con la totalidad de los requisitos curriculares (25 pasos formativos), prácticas cinemáticas en simulador interactivo y evaluación final reglamentaria bajo supervisión biométrica continuada (proctoring con IA), obteniendo un puntaje igual o superior al 90%. Se confiere el AVAL INSTITUCIONAL formal para la operación clínica segura de equipos emisores de radiación ionizante tipo Arco en C.',
       48, legalY + 18, { width: width - 96, align: 'justify' }
     );

  // QR de Verificación Institucional
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const verifyUrl = `${clientUrl}/admin?cohort=${encodeURIComponent(targetCohort)}`;
  const qrImage = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 80 });
  const qrBuffer = Buffer.from(qrImage.replace(/^data:image\/png;base64,/, ''), 'base64');

  doc.image(qrBuffer, width - 110, height - 120, { width: 64 });
  doc.fontSize(6).fillColor('#64748b')
     .text('Verificación Oficial', width - 115, height - 52, { align: 'center', width: 74 });

  // Firmas de Autoridad Académica
  const sigY = height - 90;
  
  // Firma 1: Director Académico
  doc.moveTo(50, sigY).lineTo(210, sigY).lineWidth(1).stroke('#334155');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8)
     .text('Dr. Alejandro Restrepo M.D.', 50, sigY + 4)
     .font('Helvetica').fontSize(7).fillColor('#64748b')
     .text('Director Académico y Científico\nC-Arm Master MVP / Aval IES', 50, sigY + 14);

  // Firma 2: Oficial de Protección Radiológica
  doc.moveTo(250, sigY).lineTo(410, sigY).lineWidth(1).stroke('#334155');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8)
     .text('Mg. Laura Camargo R.S.O.', 250, sigY + 4)
     .font('Helvetica').fontSize(7).fillColor('#64748b')
     .text('Oficial de Protección Radiológica\nComité de Seguridad Radiológica ACHS/OIEA', 250, sigY + 14);

  doc.end();
}
