/**
 * Lectura de CSV para la importación masiva de estudiantes.
 * Acepta separador ';' (Excel en español) o ',', comillas dobles con "" escapado, saltos de
 * línea CRLF/LF y BOM UTF-8. Las cabeceras se reconocen sin importar mayúsculas ni tildes.
 */

const HEADER_ALIASES = {
  name: ['nombre', 'nombre completo', 'nombres', 'name'],
  email: ['correo', 'correo electronico', 'email', 'e-mail', 'mail'],
  idType: ['tipo documento', 'tipo de documento', 'tipo_documento', 'tipo id', 'id_type'],
  idNumber: ['documento', 'numero documento', 'numero de documento', 'numero_documento', 'cedula', 'identificacion', 'id_number'],
  institution: ['institucion', 'institucion / hospital', 'hospital', 'institution'],
  cohort: ['promocion', 'cohorte', 'cohort'],
  startDate: ['fecha inicio', 'fecha de inicio', 'fecha_inicio', 'acceso desde', 'start_date'],
};

export const REQUIRED_COLUMNS = ['name', 'email'];

function normalizeHeader(header) {
  return String(header)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function detectDelimiter(firstLine) {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas && semicolons > 0 ? ';' : ',';
}

/** Divide el texto en filas de celdas respetando comillas. */
export function parseCsvRows(text) {
  const source = String(text).replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiter = detectDelimiter(firstLine);
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') inQuotes = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

/**
 * Convierte el CSV en objetos { line, name, email, idType, idNumber, institution, cohort, startDate }.
 * Devuelve { records } o { error } si faltan columnas obligatorias.
 */
export function parseStudentsCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { error: 'El archivo está vacío.' };

  const headers = rows[0].map(normalizeHeader);
  const columnIndex = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = headers.findIndex((h) => aliases.includes(h));
    if (index >= 0) columnIndex[field] = index;
  }
  const missing = REQUIRED_COLUMNS.filter((field) => columnIndex[field] === undefined);
  if (missing.length > 0) {
    return { error: `Faltan columnas obligatorias: ${missing.map((m) => (m === 'name' ? 'nombre' : 'correo')).join(' y ')}. Usa la plantilla.` };
  }

  const records = rows.slice(1).map((cells, i) => {
    const value = (field) => (columnIndex[field] === undefined ? '' : String(cells[columnIndex[field]] ?? '').trim());
    return {
      line: i + 2, // línea en el archivo (la 1 es la cabecera)
      name: value('name'),
      email: value('email').toLowerCase(),
      idType: value('idType'),
      idNumber: value('idNumber'),
      institution: value('institution'),
      cohort: value('cohort'),
      startDate: value('startDate'),
    };
  });
  return { records };
}

/** Plantilla descargable (separador ';' para que Excel en español la abra en columnas). */
export const STUDENTS_CSV_TEMPLATE = '﻿' + [
  'nombre;correo;tipo_documento;numero_documento;institucion;promocion;fecha_inicio',
  'Dra. Ana Pérez;ana.perez@hospital.org;CC;1020304050;Hospital San Rafael;Promoción 1;',
  'Dr. Luis Gómez;luis.gomez@clinica.co;CE;E123456;Clínica del Norte;Promoción 1;2026-12-01',
].join('\r\n');
