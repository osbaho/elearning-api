import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { get, all, run } from '../config/db.js';

/**
 * Generates and streams a certificate PDF for a given student
 * @param {number|string} studentId
 * @param {import('express').Response} res
 */
export async function generateCertificatePDF(studentId, res) {
  const student = await get(
    'SELECT id, name, email, exam_score, id_number, id_type, institution FROM students WHERE id = ?',
    [studentId]
  );
  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado.' });
  }

  const progress = await all(
    'SELECT module_id, completed_at FROM course_progress WHERE student_id = ? AND status = ?',
    [studentId, 'completed']
  );
  const examRecord = progress.find(p => p.module_id === 'exam');

  if (!examRecord) {
    return res.status(400).json({ error: 'El estudiante no ha completado el examen final.' });
  }

  const score = student.exam_score ?? 0;
  if (score < 90) {
    return res.status(400).json({ error: 'El estudiante debe aprobar la evaluación final con un puntaje mínimo de 90% para obtener su certificado.' });
  }

  const completedDate = examRecord.completed_at ? new Date(examRecord.completed_at) : new Date();
  const dateStr = completedDate.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const hashInput = `${student.id}-${student.email}-${student.exam_score}-${examRecord.completed_at}`;
  const verificationCode = 'CARM-' + crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 12).toUpperCase();

  try {
    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    const safeName = (student.name || 'Estudiante').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename=Certificado_CArmMaster_${safeName}.pdf`);

    doc.pipe(res);

    // Page Dimensions
    const width = doc.page.width;
    const height = doc.page.height;

    // Outer cyan border
    doc.rect(20, 20, width - 40, height - 40)
       .lineWidth(3)
       .stroke('#00d4ff');

    // Inner dark border
    doc.rect(26, 26, width - 52, height - 52)
       .lineWidth(1)
       .stroke('#141c35');

    // Decorative corner accents
    const cornerSize = 14;
    doc.rect(20, 20, cornerSize, cornerSize).fill('#00d4ff');
    doc.rect(width - 20 - cornerSize, 20, cornerSize, cornerSize).fill('#00d4ff');
    doc.rect(20, height - 20 - cornerSize, cornerSize, cornerSize).fill('#00d4ff');
    doc.rect(width - 20 - cornerSize, height - 20 - cornerSize, cornerSize, cornerSize).fill('#00d4ff');

    // Header Title
    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#00a3cc').text('C-ARM MASTER TRAINING PLATFORM', { align: 'center', characterSpacing: 2 });
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#0f1629').text('CERTIFICADO DE APROBACIÓN', { align: 'center' });
    doc.moveDown(0.4);

    doc.font('Helvetica').fontSize(13).fillColor('#555555').text('Por cuanto ha demostrado suficiencia teórica y práctica en la evaluación, se certifica a:', { align: 'center' });
    doc.moveDown(0.6);

    // Student Name
    doc.font('Helvetica-Bold').fontSize(26).fillColor('#0070ba').text((student.name || '').toUpperCase(), { align: 'center' });
    doc.moveDown(0.3);

    // Document and Institution Info
    const idText = student.id_number 
      ? `${student.id_type || 'C.C.'} No. ${student.id_number}`
      : `Correo: ${student.email}`;
    const instText = student.institution ? ` — ${student.institution}` : '';
    doc.font('Helvetica').fontSize(12).fillColor('#333333').text(`${idText}${instText}`, { align: 'center' });
    doc.moveDown(0.8);

    // Description
    doc.font('Helvetica').fontSize(13).fillColor('#444444').text('Por haber cursado y superado satisfactoriamente el programa de entrenamiento interactivo:', { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f1629').text('Manejo y Operación del Arco en C', { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#666666').text('Con fundamentación en principios de protección radiológica, seguridad en quirófano y posicionamiento anatómico.', { align: 'center' });
    doc.moveDown(1.2);

    // Generar Código QR Dinámico de Verificación
    const verifyBaseUrl = process.env.PUBLIC_VERIFY_BASE_URL ||
      (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',')[0] : 'http://localhost:5000');
    const verifyUrl = `${verifyBaseUrl.replace(/\/$/, '')}/api/verify/${verificationCode}`;

    let qrBuffer = null;
    try {
      qrBuffer = await QRCode.toBuffer(verifyUrl, {
        width: 160,
        margin: 1,
        color: {
          dark: '#0f1629',
          light: '#ffffff'
        }
      });
    } catch (qrErr) {
      console.warn('Could not generate QR buffer:', qrErr.message);
    }

    // Score & Date Box
    const startY = doc.y;
    doc.font('Helvetica').fontSize(11).fillColor('#333333');
    doc.text(`Fecha de Emisión: ${dateStr}`, 60, startY);
    doc.font('Helvetica-Bold').text(`Puntaje de Evaluación: ${score}% (Aprobado)`, width - 360, startY, { align: 'right', width: 300 });
    
    if (qrBuffer) {
      const qrSize = 64;
      const qrX = width - 130;
      const qrY = startY + 12;

      // Dibujar imagen QR y enlace interactivo en PDF
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      doc.link(qrX, qrY, qrSize, qrSize, verifyUrl);

      // Marco decorativo alrededor del QR
      doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4)
         .lineWidth(1)
         .stroke('#00d4ff');

      doc.font('Helvetica').fontSize(7.5).fillColor('#666666')
         .text('Escanear para validar', qrX - 10, qrY + qrSize + 4, { width: qrSize + 20, align: 'center' });

      // Textos centrales de validación
      const textCenterY = startY + 20;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0070ba')
         .text(`Código de Verificación Digital: ${verificationCode}`, 60, textCenterY, { width: width - 200, align: 'center' });
      doc.font('Helvetica').fontSize(8.5).fillColor('#666666')
         .text('Escanea el código QR o visita el portal oficial para certificar autenticidad.', 60, textCenterY + 15, { width: width - 200, align: 'center' });
      doc.fontSize(7.5).fillColor('#999999')
         .text('Constancia académica emitida digitalmente por la plataforma C-Arm Master.', 60, textCenterY + 28, { width: width - 200, align: 'center' });
    } else {
      doc.moveDown(2);
      doc.font('Helvetica').fontSize(9).fillColor('#888888').text(`Código de Verificación Digital: ${verificationCode}`, { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(8).fillColor('#999999').text('Constancia académica emitida digitalmente por la plataforma C-Arm Master.', { align: 'center' });
    }

    doc.end();
  } catch (pdfErr) {
    console.error('Error generating certificate PDF:', pdfErr);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar el certificado en PDF.' });
    }
  }
}

/**
 * Calcula el código determinístico para un certificado aprobado.
 */
export function calculateVerificationCode(studentId, email, score, completedAt) {
  const hashInput = `${studentId}-${email}-${score}-${completedAt}`;
  return 'CARM-' + crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 12).toUpperCase();
}

/**
 * Verifica públicamente la validez de un código de certificado digital.
 * @param {string} code
 * @returns {Promise<Object|null>}
 */
export async function verifyCertificateCode(code) {
  if (!code || typeof code !== 'string') return null;
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode.startsWith('CARM-')) return null;

  // 1. Búsqueda instantánea O(1) a través de la columna indexada certificate_code
  const fastMatch = await get(`
    SELECT s.id, s.name, s.email, s.exam_score, s.id_number, s.id_type, s.institution, cp.completed_at
    FROM course_progress cp
    JOIN students s ON s.id = cp.student_id
    WHERE cp.module_id = 'exam' AND cp.status = 'completed' AND cp.certificate_code = ? AND s.exam_score >= 90
  `, [cleanCode]);

  if (fastMatch) {
    const maskedId = fastMatch.id_number 
      ? `${fastMatch.id_type || 'ID'}: •••• ${String(fastMatch.id_number).slice(-4)}`
      : null;

    return {
      valid: true,
      verificationCode: cleanCode,
      studentName: fastMatch.name,
      institution: fastMatch.institution || 'No especificada',
      identification: maskedId,
      score: fastMatch.exam_score,
      issuedAt: fastMatch.completed_at,
      program: 'Manejo y Operación del Arco en C'
    };
  }

  // 2. Fallback de compatibilidad con auto-reparación para registros históricos
  const records = await all(`
    SELECT s.id, s.name, s.email, s.exam_score, s.id_number, s.id_type, s.institution, cp.id as progress_id, cp.completed_at
    FROM students s
    JOIN course_progress cp ON cp.student_id = s.id
    WHERE cp.module_id = 'exam' AND cp.status = 'completed' AND s.exam_score >= 90 AND (cp.certificate_code IS NULL OR cp.certificate_code = '')
  `);

  for (const row of records) {
    const generatedCode = calculateVerificationCode(row.id, row.email, row.exam_score, row.completed_at);
    if (generatedCode === cleanCode) {
      // Auto-reparar para que futuras consultas sean O(1)
      run('UPDATE course_progress SET certificate_code = ? WHERE id = ?', [cleanCode, row.progress_id]).catch(() => {});

      const maskedId = row.id_number 
        ? `${row.id_type || 'ID'}: •••• ${String(row.id_number).slice(-4)}`
        : null;

      return {
        valid: true,
        verificationCode: cleanCode,
        studentName: row.name,
        institution: row.institution || 'No especificada',
        identification: maskedId,
        score: row.exam_score,
        issuedAt: row.completed_at,
        program: 'Manejo y Operación del Arco en C'
      };
    }
  }

  return null;
}
