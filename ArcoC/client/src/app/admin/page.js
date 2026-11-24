'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { courseModules, ALL_STEPS } from '../../lib/courseConfig';
import { apiRequest, formatDateTime } from '../../lib/api';
import CohortManagerModal from './_components/CohortManagerModal';
import StudentManageModal from './_components/StudentManageModal';
import ImportStudentsModal from './_components/ImportStudentsModal';
import AdminActionsModal from './_components/AdminActionsModal';
import LaunchReadinessCard from './_components/LaunchReadinessCard';
import ProgressTrackingView from './_components/ProgressTrackingView';
import SupportCasesButton from './_components/SupportCasesButton';
import { EMAIL_STATUS, accountStatus } from './_components/adminLabels';

const EMPTY_REG_FORM = {
  name: '',
  email: '',
  id_number: '',
  id_type: 'CC',
  institution: '',
  cohort: 'Promoción 1',
  customCohort: '',
  // Vacía = acceso según las fechas de la promoción
  start_date: '',
  // Estudiante de prueba: no cuenta en estadísticas, actas, CSV ni sellos
  isTest: false
};

function getModuleProgress(completedModules, moduleId) {
  const mod = courseModules.find(m => m.id === moduleId);
  if (!mod) return { status: 'none', text: '—' };
  
  const steps = mod.items.map(i => i.key);
  const done = steps.filter(k => (completedModules || []).includes(k)).length;
  
  if (done === steps.length) return { status: 'complete', text: `✅ ${done}/${steps.length}` };
  if (done > 0) return { status: 'partial', text: `⏳ ${done}/${steps.length}` };
  return { status: 'none', text: '—' };
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  const [students, setStudents] = useState([]);
  // Momento en que se cargó la lista: referencia del cálculo de rezago (el render no lee el reloj)
  const [studentsLoadedAt, setStudentsLoadedAt] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [selectedCohort, setSelectedCohort] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modales
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [regForm, setRegForm] = useState(EMPTY_REG_FORM);
  // Última matrícula: muestra su enlace de activación por si el correo no llega
  const [lastEnrollment, setLastEnrollment] = useState(null);
  const [isCohortManagerOpen, setIsCohortManagerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  // 'audit' = tabla oficial de auditoría IES; 'tracking' = seguimiento del avance por promoción
  const [view, setView] = useState('audit');
  const [manageStudentId, setManageStudentId] = useState(null);

  // Modal de Verificación de Estándar IES
  const [complianceStudent, setComplianceStudent] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // Modal de Bitácora Forense de Notificaciones
  const [isEmailLogsModalOpen, setIsEmailLogsModalOpen] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  const fetchCohortsAndStudents = useCallback((cohort = selectedCohort, search = searchQuery, status = statusFilter) => {
    const request = async () => {
      const cohortParam = cohort !== 'all' ? `&cohort=${encodeURIComponent(cohort)}` : '';
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const statusParam = status !== 'all' ? `&status=${encodeURIComponent(status)}` : '';

      return Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/students?limit=100${cohortParam}${searchParam}${statusParam}`, {
          credentials: 'include'
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/cohorts`, {
          credentials: 'include'
        })
      ]);
    };

    // El estado cambia solo en los callbacks, cuando responde la API: el efecto que carga el panel
    // puede invocarla sin llamar a setState de forma síncrona (react-hooks/set-state-in-effect).
    return request()
      .then(async ([resStudents, resCohorts]) => {
        if (resStudents.ok) {
          const data = await resStudents.json();
          setStudents(data.students || []);
          setStudentsLoadedAt(Date.now());
        } else {
          setError('No se pudieron cargar los estudiantes.');
        }

        if (resCohorts.ok) {
          const cohortData = await resCohorts.json();
          setCohorts(cohortData.cohorts || []);
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Error de conexión con el servidor.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedCohort, searchQuery, statusFilter]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'admin') {
      return;
    }
    fetchCohortsAndStudents(selectedCohort, searchQuery, statusFilter);
  }, [user, authLoading, router, selectedCohort, searchQuery, statusFilter, fetchCohortsAndStudents]);

  const reloadPanel = () => fetchCohortsAndStudents(selectedCohort, searchQuery, statusFilter);

  // Reintento de un correo fallido desde la bitácora
  const handleRetryEmail = async (emailId) => {
    const res = await apiRequest(`/admin/email-logs/${emailId}/retry`, { method: 'POST' });
    if (!res.ok) return addToast(res.error, 'error');
    addToast('Correo encolado de nuevo.', 'success');
    openEmailLogsModal();
  };

  const copyActivationLink = async () => {
    try {
      await navigator.clipboard.writeText(lastEnrollment.activationUrl);
      addToast('Enlace de activación copiado.', 'success');
    } catch {
      addToast('No se pudo copiar: selecciona el enlace y cópialo manualmente.', 'warning');
    }
  };

  const handleCohortChange = (cohortName) => {
    setSelectedCohort(cohortName);
    setLoading(true);
    fetchCohortsAndStudents(cohortName, searchQuery);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
  };

  // Descarga de Certificado Individual PDF
  const downloadCert = async (studentId, studentName) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/certificate/${studentId}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificado_${studentName?.replace(/\s+/g, '_') || studentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        addToast('Certificado oficial descargado con éxito.', 'success');
      } else {
        const data = await res.json();
        addToast(`No se puede generar certificado: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al descargar el certificado.', 'error');
    }
  };

  // Descarga de Acta Colectiva y Libro de Calificaciones IES (PDF)
  const downloadCohortActa = async (cohortName) => {
    try {
      const target = cohortName === 'all' ? (distinctCohorts[0] || 'Promoción 1') : cohortName;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/cohort-acta/${encodeURIComponent(target)}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Acta_Oficial_IES_${target.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        addToast(`📑 Acta oficial de "${target}" descargada con éxito.`, 'success');
      } else {
        const data = await res.json();
        addToast(`Error al generar acta: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al descargar acta oficial de la promoción.', 'error');
    }
  };

  // Cierre y sellado formal de la promoción
  const handleCloseCohort = async (cohortName) => {
    if (cohortName === 'all') {
      addToast('Selecciona una promoción específica para cerrarla y sellarla.', 'warning');
      return;
    }
    if (!window.confirm(`¿Confirmas el cierre y sellado legal de la "${cohortName}"?\n\nEsta acción calculará una huella criptográfica SHA-256 inmutable de las calificaciones para fines de auditoría ministerial e IES.`)) {
      return;
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/cohorts/${encodeURIComponent(cohortName)}/close`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`🔒 Promoción "${cohortName}" cerrada y sellada formalmente.`, 'success');
        fetchCohortsAndStudents(selectedCohort, searchQuery);
      } else {
        addToast(`Error: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error de conexión al cerrar la promoción.', 'error');
    }
  };

  // Reenvío de credenciales y guía de inducción
  const handleResendEmail = async (studentId, studentEmail) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/resend-email/${studentId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        addToast(`✉️ Credenciales y guía de inducción reenviadas a ${studentEmail}.`, 'success');
      } else {
        addToast('No se pudo reenviar el correo de inducción.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al conectar con el servidor para reenviar correo.', 'error');
    }
  };

  // Envío de recordatorio académico anti-rezago
  const handleSendReminder = async (studentId, studentEmail) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/send-reminder/${studentId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        addToast(`🔔 Recordatorio de avance académico enviado a ${studentEmail}.`, 'success');
      } else {
        addToast('No se pudo enviar el recordatorio.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al conectar con el servidor para enviar recordatorio.', 'error');
    }
  };

  // Cálculo de rezago académico (más de 7 días sin avance significativo), a la fecha de carga de la lista
  const isStudentLagging = (student) => {
    if (student.role === 'admin' || (student.examScore ?? 0) >= 90) return false;
    const dateRef = student.startDate ? new Date(student.startDate) : new Date(student.createdAt);
    const diffDays = Math.floor((studentsLoadedAt - dateRef.getTime()) / (1000 * 60 * 60 * 24));
    const completedCount = (student.completedModules || []).filter(m => m !== 'exam').length;
    return diffDays >= 7 && completedCount < 5;
  };

  // Apertura y consulta del Estándar IES
  const openComplianceModal = async (student) => {
    setComplianceStudent(student);
    setComplianceLoading(true);
    setComplianceData(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/compliance/${student.id}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setComplianceData(data);
      } else {
        addToast('Error al obtener la evaluación del estándar.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error de conexión al evaluar estándar.', 'error');
    } finally {
      setComplianceLoading(false);
    }
  };

  // Apertura de la bitácora de correos
  const openEmailLogsModal = async () => {
    setIsEmailLogsModalOpen(true);
    setEmailLogsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/email-logs`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setEmailLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
      addToast('Error al consultar bitácora de correos.', 'error');
    } finally {
      setEmailLogsLoading(false);
    }
  };

  // Exportar auditoría CSV
  const handleExportCsv = async () => {
    try {
      const cohortParam = selectedCohort !== 'all' ? `?cohort=${encodeURIComponent(selectedCohort)}` : '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/export-audit${cohortParam}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = `auditoria_ies_${selectedCohort === 'all' ? 'todas_promociones' : selectedCohort.replace(/\s+/g, '_')}_${Date.now()}.csv`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        addToast('Reporte oficial de auditoría descargado en formato CSV.', 'success');
      } else {
        addToast('Error al exportar reporte de auditoría.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al descargar archivo de auditoría.', 'error');
    }
  };

  // Envío del formulario de registro de estudiante
  const handleSubmitRegister = async (e) => {
    e.preventDefault();
    if (!regForm.name || !regForm.email) {
      addToast('Nombre y correo electrónico son obligatorios.', 'error');
      return;
    }

    const finalCohort = regForm.cohort === 'OTRA' ? regForm.customCohort.trim() : regForm.cohort;
    if (!finalCohort) {
      addToast('Debes especificar el nombre de la promoción.', 'error');
      return;
    }

    setSubmittingReg(true);
    try {
      const payload = {
        name: regForm.name.trim(),
        email: regForm.email.trim(),
        id_number: regForm.id_number.trim(),
        id_type: regForm.id_type,
        institution: regForm.institution.trim(),
        cohort: finalCohort,
        start_date: regForm.start_date || null,
        isTest: regForm.isTest === true
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        addToast(`✅ Estudiante matriculado en "${finalCohort}". Le llegará un correo para activar su cuenta.`, 'success');
        setIsRegisterModalOpen(false);
        setLastEnrollment({
          name: data.student.name,
          email: data.student.email,
          cohort: finalCohort,
          activationUrl: data.activationUrl,
          expiresAt: data.activationExpiresAt,
          emailTransport: data.emailTransport
        });
        setRegForm({ ...EMPTY_REG_FORM, cohort: finalCohort });
        reloadPanel();
      } else {
        addToast(`Error: ${data.error || 'No se pudo matricular al estudiante.'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error al conectar con el servidor para matricular al estudiante.', 'error');
    } finally {
      setSubmittingReg(false);
    }
  };

  if (authLoading || (loading && !students.length)) {
    return <div className="container py-course text-center">Cargando panel de administración y promociones...</div>;
  }

  if (user && user.role !== 'admin') {
    return (
      <div className="container py-course text-center">
        <div className="card max-w-500 mx-auto p-32">
          <div className="text-4xl mb-16">🔒</div>
          <h2 className="title-md mb-8 text-cyan">Control de Acceso</h2>
          <p className="text-secondary mb-24">Acceso restringido. Se requieren privilegios de Administrador.</p>
          <button className="btn btn-primary" onClick={() => router.push('/course')}>Ir al Curso</button>
        </div>
      </div>
    );
  }

  const studentList = students.filter(s => s.role !== 'admin');
  // Los indicadores no cuentan a los estudiantes de prueba (sí aparecen en la tabla, marcados)
  const realStudents = studentList.filter(s => !s.isTest);
  const testStudentCount = studentList.length - realStudents.length;
  const certifiedCount = realStudents.filter(s => (s.examScore ?? 0) >= 90).length;
  const inProgressCount = realStudents.filter(s => (s.examScore ?? 0) < 90).length;
  const laggingCount = realStudents.filter(isStudentLagging).length;
  const totalIncidents = realStudents.reduce((acc, s) => acc + (s.proctoringIncidents || 0) + (s.focusViolations || 0), 0);
  const avgScore = realStudents.filter(s => s.examScore !== null).length > 0
    ? (realStudents.reduce((acc, s) => acc + (s.examScore || 0), 0) / realStudents.filter(s => s.examScore !== null).length).toFixed(1)
    : '—';

  // Extraer nombres de promociones únicas
  const distinctCohorts = Array.from(new Set([
    ...cohorts.map(c => c.name),
    ...studentList.map(s => s.cohort || 'Promoción 1')
  ])).filter(Boolean);

  const selectedCohortObj = cohorts.find(c => c.name === selectedCohort);

  return (
    <div className="container container-wide py-course">
      {/* Header & Title */}
      <div className="flex-between items-center mb-24 flex-wrap gap-16">
        <div>
          <h1 className="title-lg mb-8">Auditoría y Certificación IES — Gestión de Promociones</h1>
          <p className="text-secondary m-0">
            Supervisión académica, control de promociones (cohortes) y validación de estándares para convalidación ministerial e institucional.
          </p>
        </div>
        <div className="flex gap-12 items-center flex-wrap">
          <Link
            href="/course"
            className="btn btn-secondary text-sm flex items-center gap-6"
            id="btn-open-course-preview"
            title="Recorre el curso como lo ve un estudiante, sin orden y sin registrar avance"
          >
            👁️ Ver el curso (revisión)
          </Link>
          <SupportCasesButton addToast={addToast} />
          <button
            className="btn btn-secondary text-sm flex items-center gap-6"
            onClick={openEmailLogsModal}
            id="btn-open-email-logs"
          >
            ✉️ Bitácora de Correos
          </button>
          <button 
            className="btn btn-secondary text-sm flex items-center gap-6"
            onClick={() => downloadCohortActa(selectedCohort)}
            id="btn-download-cohort-acta"
            title="Descargar Acta Colectiva y Libro de Calificaciones de la Promoción en PDF"
          >
            📑 Acta Colectiva IES (PDF)
          </button>
          <button 
            className="btn btn-secondary text-sm flex items-center gap-6"
            onClick={handleExportCsv}
            id="btn-export-audit-csv"
          >
            📊 Exportar Auditoría (CSV)
          </button>
          <button
            className="btn btn-secondary text-sm flex items-center gap-6"
            onClick={() => setIsActionsOpen(true)}
            id="btn-open-admin-actions"
          >
            🧾 Bitácora de Acciones
          </button>
          <button
            className="btn btn-secondary text-sm flex items-center gap-6"
            onClick={() => setIsCohortManagerOpen(true)}
            id="btn-open-cohorts"
          >
            🗂️ Promociones
          </button>
          <button
            className="btn btn-secondary text-sm flex items-center gap-6"
            onClick={() => setIsImportOpen(true)}
            id="btn-open-import"
          >
            📥 Importar CSV
          </button>
          <button
            className="btn btn-primary text-sm flex items-center gap-6"
            onClick={() => setIsRegisterModalOpen(true)}
            id="btn-register-student-modal"
          >
            ➕ Registrar Estudiante en Promoción
          </button>
        </div>
      </div>

      {/* Qué falta para el lanzamiento: videos, minijuegos y banco de preguntas */}
      <LaunchReadinessCard />

      {/* Última matrícula: enlace de activación por si el correo no llega */}
      {lastEnrollment && (
        <div className="card p-16 mb-24 enrollment-banner" id="enrollment-banner">
          <div className="flex-between items-start gap-12 flex-wrap">
            <div className="text-sm">
              ✅ <strong>{lastEnrollment.name}</strong> ({lastEnrollment.email}) quedó matriculado(a) en «{lastEnrollment.cohort}».
              <div className="text-xs text-secondary mt-4">
                {lastEnrollment.emailTransport === 'smtp'
                  ? 'Se le envió el correo de bienvenida con su enlace de activación.'
                  : 'Correo en modo simulado (sin SMTP configurado): comparte el enlace manualmente.'}
                {' '}El enlace es personal, de un solo uso y vence {formatDateTime(lastEnrollment.expiresAt)}.
              </div>
            </div>
            <button className="btn btn-secondary text-xs px-8 py-4" onClick={() => setLastEnrollment(null)}>✕</button>
          </div>
          <div className="flex gap-6 mt-8">
            <input id="enrollment-activation-url" className="input text-xs flex-1" readOnly value={lastEnrollment.activationUrl}
              onFocus={(e) => e.target.select()} />
            <button id="btn-copy-activation" className="btn btn-secondary text-xs px-8" onClick={copyActivationLink}>Copiar enlace</button>
          </div>
        </div>
      )}

      {/* Cohort Tabs / Filter Selector */}
      <div className="card p-16 mb-24">
        <div className="flex-between items-center flex-wrap gap-12 mb-12">
          <div className="flex items-center gap-12 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              Filtrar por Promoción:
            </span>
            <button
              className={`cohort-pill ${selectedCohort === 'all' ? 'active' : ''}`}
              onClick={() => handleCohortChange('all')}
              id="pill-cohort-all"
            >
              Todas las Promociones ({studentList.length})
            </button>
            {distinctCohorts.map(cohortName => {
              const countInCohort = studentList.filter(s => (s.cohort || 'Promoción 1') === cohortName).length;
              const cObj = cohorts.find(c => c.name === cohortName);
              const isClosed = cObj?.isClosed;
              return (
                <button
                  key={cohortName}
                  className={`cohort-pill ${selectedCohort === cohortName ? 'active' : ''}`}
                  onClick={() => handleCohortChange(cohortName)}
                  id={`pill-cohort-${cohortName.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {isClosed ? '🔒 ' : ''}{cohortName} ({countInCohort})
                </button>
              );
            })}
          </div>

          {/* Sello de cierre de la promoción seleccionada */}
          {selectedCohort !== 'all' && (
            <div>
              {selectedCohortObj?.isClosed ? (
                <span 
                  className="compliance-badge-pass text-xs py-6 px-12"
                  title={`Cerrada el ${new Date(selectedCohortObj.closedAt).toLocaleString()}`}
                  id="badge-cohort-closed"
                >
                  🔒 Promoción Sellada IES (SHA-256: {selectedCohortObj.sealHash?.substring(0, 10)}...)
                </span>
              ) : (
                <button
                  className="btn btn-secondary text-xs px-12 py-6 border-amber text-amber"
                  onClick={() => handleCloseCohort(selectedCohort)}
                  id="btn-close-cohort"
                  title="Cerrar y sellar criptográficamente esta promoción para auditoría formal IES"
                >
                  🔒 Cerrar y Sellar Promoción
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search input in real time */}
        <div className="flex items-center gap-12">
          <input
            type="text"
            className="input text-sm flex-1"
            placeholder="🔍 Buscar por nombre, correo electrónico o documento de identidad..."
            value={searchQuery}
            onChange={handleSearchChange}
            id="input-admin-search"
          />
          <select
            className="input text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setLoading(true); }}
            id="select-status-filter"
            aria-label="Filtrar por estado de la cuenta"
          >
            <option value="all">Todas las cuentas</option>
            <option value="active">Activas</option>
            <option value="pending">Pendientes de activación</option>
            <option value="inactive">Desactivadas</option>
          </select>
          {searchQuery && (
            <button 
              className="btn btn-secondary text-xs px-12"
              onClick={() => { setSearchQuery(''); fetchCohortsAndStudents(selectedCohort, ''); }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards for IES Audit */}
      <div className="grid-cols-5 gap-16 mb-32">
        <div className="card p-16 text-center">
          <div className="text-secondary text-xs font-bold uppercase tracking-wider mb-8">
            {selectedCohort === 'all' ? 'Total Estudiantes' : `Matriculados (${selectedCohort})`}
          </div>
          <div className="title-lg text-cyan" id="stat-total-students">{realStudents.length}</div>
          {testStudentCount > 0 && (
            <div className="text-xs text-muted" id="stat-test-students">+{testStudentCount} de prueba (no cuentan)</div>
          )}
        </div>
        <div className="card p-16 text-center">
          <div className="text-secondary text-xs font-bold uppercase tracking-wider mb-8">Aprobados para Aval IES</div>
          <div className="title-lg text-green" id="stat-certified-students">{certifiedCount}</div>
        </div>
        <div className="card p-16 text-center">
          <div className="text-secondary text-xs font-bold uppercase tracking-wider mb-8">En Instrucción</div>
          <div className="title-lg text-amber" id="stat-progress-students">{inProgressCount}</div>
        </div>
        <div className="card p-16 text-center">
          <div className="text-secondary text-xs font-bold uppercase tracking-wider mb-8">Alumnos en Rezago</div>
          <div className={`title-lg ${laggingCount > 0 ? 'text-red font-bold' : 'text-muted'}`} id="stat-lagging-students">
            {laggingCount}
          </div>
        </div>
        <div className="card p-16 text-center">
          <div className="text-secondary text-xs font-bold uppercase tracking-wider mb-8">Promedio Nota / Incidentes</div>
          <div className="title-lg text-muted" id="stat-avg-incidents">
            <span className="text-cyan">{avgScore}%</span> / <span className="text-amber">{totalIncidents} inc.</span>
          </div>
        </div>
      </div>

      {/* Vistas: auditoría IES (tabla oficial) o seguimiento del avance (calculado en el servidor) */}
      <div className="view-tabs mb-16" role="tablist" aria-label="Vista del panel">
        <button
          role="tab"
          id="tab-view-audit"
          aria-selected={view === 'audit'}
          className={`view-tab ${view === 'audit' ? 'active' : ''}`}
          onClick={() => setView('audit')}
        >
          📋 Auditoría IES
        </button>
        <button
          role="tab"
          id="tab-view-tracking"
          aria-selected={view === 'tracking'}
          className={`view-tab ${view === 'tracking' ? 'active' : ''}`}
          onClick={() => setView('tracking')}
        >
          📈 Seguimiento del avance
        </button>
      </div>

      {view === 'tracking' && (
        <ProgressTrackingView cohort={selectedCohort} search={searchQuery} status={statusFilter} />
      )}

      {/* Main Student Table */}
      {view === 'audit' && (
      <div className="card overflow-auto">
        <div className="p-16 border-bottom flex-between items-center">
          <h2 className="title-sm m-0 text-cyan">
            Registro Oficial de Estudiantes {selectedCohort !== 'all' ? `— ${selectedCohort}` : ''}
          </h2>
          <span className="text-xs text-secondary">
            Estándar Reglamentario IES: ≥90% en Evaluación Final, {ALL_STEPS.length}/{ALL_STEPS.length} pasos y Proctoring Validado
          </span>
        </div>
        <table className="admin-table" role="table" aria-label="Lista de estudiantes para auditoría IES">
          <thead>
            <tr>
              <th scope="col">Estudiante</th>
              <th scope="col">Promoción / Acceso</th>
              <th scope="col">Identificación</th>
              <th scope="col">Institución / Hospital (IES)</th>
              {courseModules.map(m => (
                <th key={m.id} scope="col" title={m.title}>Mód. {m.id}</th>
              ))}
              <th scope="col">Evaluación</th>
              <th scope="col">Supervisión IA</th>
              <th scope="col">Estado IES</th>
              <th scope="col" className="text-center">Auditoría / Acciones</th>
            </tr>
          </thead>
          <tbody>
            {studentList.map(s => {
              const modules = s.completedModules || [];
              const score = s.examScore ?? 0;
              const passed = score >= 90;
              const docText = s.idNumber ? `${s.idType || 'CC'} ${s.idNumber}` : 'Sin datos';
              const instText = s.institution || 'Sin asignar';
              const isCompliant = passed && ALL_STEPS.every(k => modules.includes(k)) && s.isOnboarded;
              const lagging = isStudentLagging(s);
              const account = accountStatus(s);

              return (
                <tr key={s.id} data-student-id={s.id} data-student-email={s.email} data-cohort={s.cohort || 'Promoción 1'} data-account-status={account.key} data-test-student={s.isTest ? 'true' : undefined}>
                  <td>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs text-muted">{s.email}</div>
                    {s.isTest && <span className="test-badge mt-4 d-inline-block" title="No cuenta en estadísticas, actas, CSV ni sellos">🧪 Prueba</span>}
                    {account.key !== 'active' && (
                      <span className={`${account.className} mt-4 d-inline-block`}>{account.label}</span>
                    )}
                  </td>
                  <td>
                    <span className="badge-admin py-2 px-8 text-xs">{s.cohort || 'Promoción 1'}</span>
                    <div className="text-xs text-muted mt-4">
                      {s.startDate ? `Desde: ${s.startDate}` : 'Acceso inmediato'}
                    </div>
                    {lagging && (
                      <span className="compliance-badge-fail py-2 px-6 text-xs mt-4 d-inline-block">
                        ⚠️ Rezago (+7d)
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="font-mono text-xs">{docText}</div>
                  </td>
                  <td>
                    <div className="text-xs text-muted">{instText}</div>
                  </td>
                  {courseModules.map(m => {
                    const prog = getModuleProgress(modules, m.id);
                    return (
                      <td key={m.id} className="text-center font-sm">
                        {prog.text}
                      </td>
                    );
                  })}
                  <td className="text-center">
                    <span className={`font-bold ${s.examScore !== null ? (passed ? 'text-green' : 'text-red') : 'text-muted'}`}>
                      {s.examScore !== null ? `${score}%` : 'Pendiente'}
                    </span>
                    {s.examAttempts > 0 && (
                      <div className="text-xs text-muted font-normal">{s.examAttempts}/{s.examMaxAttempts ?? 3} intentos</div>
                    )}
                  </td>
                  <td>
                    <span className={`text-xs ${s.proctoringIncidents > 0 || s.focusViolations > 0 ? 'text-amber font-bold' : 'text-muted'}`}>
                      🎥 {s.proctoringIncidents || 0} | 👁️ {s.focusViolations || 0}
                    </span>
                  </td>
                  <td>
                    {isCompliant ? (
                      <span className="badge-student">Aval Listo (100%)</span>
                    ) : passed ? (
                      <span className="badge-admin">Examen OK (Pendiente Requisitos)</span>
                    ) : (
                      <span className="text-xs text-muted">En Instrucción</span>
                    )}
                  </td>
                  <td className="text-center">
                    <div className="flex gap-6 justify-center items-center flex-wrap">
                      <Link
                        href={`/admin/estudiantes/${s.id}`}
                        id={`btn-detail-${s.id}`}
                        className="btn btn-secondary text-xs px-8 py-4"
                        title="Ficha completa: avance por paso, partidas, examen, incidencias, correos y línea de tiempo"
                      >
                        📋 Ficha
                      </Link>
                      <button
                        id={`btn-manage-${s.id}`}
                        className="btn btn-secondary text-xs px-8 py-4"
                        onClick={() => setManageStudentId(s.id)}
                        title="Editar datos, cambiar de promoción, enlace de acceso, desactivar e historial"
                      >
                        ⚙️ Gestionar
                      </button>
                      <button
                        id={`btn-eval-standard-${s.id}`}
                        className="btn btn-secondary text-xs px-8 py-4"
                        onClick={() => openComplianceModal(s)}
                        title="Verificar si cumple todos los requisitos del estándar del curso"
                      >
                        🔍 Ver Estándar IES
                      </button>
                      <button
                        id={`btn-cert-${s.id}`}
                        className="btn btn-primary text-xs px-8 py-4"
                        onClick={() => downloadCert(s.id, s.name)}
                        disabled={!passed}
                        title={!passed ? 'Requiere ≥90% para generar certificado' : 'Descargar certificado con QR'}
                      >
                        📄 Certificado
                      </button>
                      <button
                        id={`btn-resend-guide-${s.id}`}
                        className="btn btn-secondary text-xs px-8 py-4"
                        onClick={() => handleResendEmail(s.id, s.email)}
                        title="Reenviar correo de inducción con credenciales y guía operativa"
                      >
                        ✉️ Reenviar Guía
                      </button>
                      {lagging && (
                        <button
                          id={`btn-send-reminder-${s.id}`}
                          className="btn btn-secondary text-xs px-8 py-4 text-amber border-amber"
                          onClick={() => handleSendReminder(s.id, s.email)}
                          title="Enviar recordatorio preventivo de avance académico"
                        >
                          🔔 Recordatorio
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {studentList.length === 0 && (
              <tr>
                <td colSpan={courseModules.length + 8} className="text-center text-muted p-32">
                  No se encontraron estudiantes para la promoción o filtro seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* ─── MODAL 1: REGISTRAR NUEVO ESTUDIANTE EN PROMOCIÓN ─── */}
      {isRegisterModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRegisterModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="title-sm m-0 text-cyan">➕ Matricular Estudiante en Promoción</h3>
              <button 
                className="btn btn-secondary text-xs px-8 py-4"
                onClick={() => setIsRegisterModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitRegister}>
              <div className="modal-body">
                <div className="p-12 mb-16 rounded bg-card border text-xs text-secondary leading-relaxed">
                  ℹ️ <strong>Activación por enlace:</strong> el estudiante recibe un correo de bienvenida con un enlace personal (de un solo uso, válido 7 días) para crear su contraseña, junto con la guía para iniciar el curso. Nunca se envían contraseñas por correo.
                </div>

                <div className="grid-cols-2 gap-12 mb-12">
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4">Nombre Completo *</label>
                    <input
                      type="text"
                      className="input text-sm w-full"
                      required
                      placeholder="Ej. Dr. Carlos Mendoza"
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                      id="reg-input-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4">Correo Electrónico Institucional *</label>
                    <input
                      type="email"
                      className="input text-sm w-full"
                      required
                      placeholder="estudiante@hospital.org"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      id="reg-input-email"
                    />
                  </div>
                </div>

                <div className="grid-cols-2 gap-12 mb-12">
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4">Promoción (Cohorte) *</label>
                    <select
                      className="input text-sm w-full"
                      value={regForm.cohort}
                      onChange={(e) => setRegForm({ ...regForm, cohort: e.target.value })}
                      id="reg-select-cohort"
                    >
                      {cohorts.filter(c => !c.isClosed).map(c => (
                        <option key={c.id ?? c.name} value={c.name}>{c.name}</option>
                      ))}
                      {!cohorts.some(c => c.name === 'Promoción 1') && <option value="Promoción 1">Promoción 1</option>}
                      <option value="OTRA">+ Crear Nueva Promoción...</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4" htmlFor="reg-input-start-date">
                      Acceso individual desde (opcional)
                    </label>
                    <input
                      type="date"
                      className="input text-sm w-full"
                      value={regForm.start_date}
                      onChange={(e) => setRegForm({ ...regForm, start_date: e.target.value })}
                      id="reg-input-start-date"
                    />
                    <div className="text-xs text-muted mt-4">Vacía: según las fechas de la promoción.</div>
                  </div>
                </div>

                {regForm.cohort === 'OTRA' && (
                  <div className="mb-12">
                    <label className="text-xs text-cyan font-bold block mb-4">Nombre de la Nueva Promoción *</label>
                    <input
                      type="text"
                      className="input text-sm w-full"
                      placeholder="Ej. Promoción 4 - Residentes 2026"
                      value={regForm.customCohort}
                      onChange={(e) => setRegForm({ ...regForm, customCohort: e.target.value })}
                      id="reg-input-custom-cohort"
                    />
                  </div>
                )}

                <div className="grid-cols-2 gap-12 mb-12">
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4">Documento de Identidad</label>
                    <div className="flex gap-4">
                      <select
                        className="input text-sm w-70"
                        value={regForm.id_type}
                        onChange={(e) => setRegForm({ ...regForm, id_type: e.target.value })}
                        id="reg-select-id-type"
                      >
                        <option value="CC">CC</option>
                        <option value="CE">CE</option>
                        <option value="Pasaporte">Pas</option>
                      </select>
                      <input
                        type="text"
                        className="input text-sm flex-1"
                        placeholder="Número (opcional)"
                        value={regForm.id_number}
                        onChange={(e) => setRegForm({ ...regForm, id_number: e.target.value })}
                        id="reg-input-id-number"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4">Institución / Hospital</label>
                    <input
                      type="text"
                      className="input text-sm w-full"
                      placeholder="Ej. Hospital San Rafael"
                      value={regForm.institution}
                      onChange={(e) => setRegForm({ ...regForm, institution: e.target.value })}
                      id="reg-input-institution"
                    />
                  </div>
                </div>

                <label className="text-xs flex items-center gap-8 mt-16" htmlFor="reg-input-is-test">
                  <input
                    type="checkbox"
                    id="reg-input-is-test"
                    checked={regForm.isTest}
                    onChange={(e) => setRegForm({ ...regForm, isTest: e.target.checked })}
                  />
                  🧪 Estudiante de prueba: para reproducir casos. No cuenta en estadísticas, actas, CSV ni sellos y su certificado no es verificable.
                </label>

              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => setIsRegisterModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-sm"
                  disabled={submittingReg}
                  id="btn-submit-registration"
                >
                  {submittingReg ? 'Matriculando y Enviando...' : 'Confirmar y Despachar Correo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: VERIFICACIÓN DEL ESTÁNDAR IES / MINEDUCACIÓN ─── */}
      {complianceStudent && (
        <div className="modal-backdrop" onClick={() => setComplianceStudent(null)}>
          <div className="modal-dialog modal-dialog-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="title-sm m-0 text-cyan">
                  Auditoría de Conformidad del Estándar Institucional IES
                </h3>
                <div className="text-xs text-secondary mt-4">
                  Estudiante: <strong>{complianceStudent.name}</strong> ({complianceStudent.email}) — Promoción: <strong>{complianceStudent.cohort || 'Promoción 1'}</strong>
                </div>
              </div>
              <button 
                className="btn btn-secondary text-xs px-8 py-4"
                onClick={() => setComplianceStudent(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {complianceLoading ? (
                <div className="text-center py-32 text-secondary">Evaluando los 6 criterios del estándar...</div>
              ) : complianceData ? (
                <div>
                  {/* Banner de Veredicto Principal */}
                  <div className={`p-16 rounded mb-20 text-center border ${
                    complianceData.allMet 
                      ? 'bg-green/10 border-green text-green' 
                      : 'bg-red/10 border-red text-red'
                  }`}>
                    <div className="text-2xl mb-4">{complianceData.allMet ? '🏆' : '⚠️'}</div>
                    <h4 className="title-md m-0 mb-4 font-bold" id="compliance-verdict-title">
                      {complianceData.verdict}
                    </h4>
                    <p className="text-xs m-0 text-secondary">
                      {complianceData.allMet 
                        ? 'El estudiante cumple con el 100% de los requisitos curriculares, biométricos, evaluativos y de integridad. Cuenta con aval institucional oficial para convalidación ante la IES.'
                        : `El estudiante NO cumple actualmente con el estándar. Requisitos pendientes: ${complianceData.missingCriteria.join(', ')}.`}
                    </p>
                  </div>

                  {/* Lista de Criterios del Estándar */}
                  <div className="mb-16">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-secondary mb-12">
                      Evaluación de los 6 Criterios Reglamentarios:
                    </h5>

                    {complianceData.criteria.map((crit, idx) => (
                      <div 
                        key={crit.code} 
                        className={`compliance-item ${crit.met ? 'item-pass' : 'item-fail'}`}
                        id={`compliance-criteria-${idx + 1}`}
                      >
                        <div className="flex-between items-start gap-12">
                          <div className="flex-1">
                            <div className="flex items-center gap-8 mb-4">
                              <span className="font-bold text-sm text-light">
                                {idx + 1}. {crit.title}
                              </span>
                            </div>
                            <div className="text-xs text-muted mb-4">{crit.required}</div>
                            <div className="text-xs text-secondary font-mono">{crit.details}</div>
                          </div>
                          <div>
                            <span className={crit.met ? 'compliance-badge-pass' : 'compliance-badge-fail'}>
                              {crit.met ? '✓' : '✕'} {crit.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Acciones del Estándar */}
                  <div className="p-12 rounded bg-card border flex-between items-center flex-wrap gap-8">
                    <span className="text-xs text-secondary">
                      {complianceData.allMet 
                        ? 'Código de Acta Validable: Generado con firma HMAC-SHA256.'
                        : 'El certificado oficial se habilitará en cuanto el estudiante complete los requisitos faltantes.'}
                    </span>
                    {complianceData.allMet && (
                      <button 
                        className="btn btn-primary text-xs px-12 py-6"
                        onClick={() => downloadCert(complianceStudent.id, complianceStudent.name)}
                      >
                        📄 Descargar Certificado IES
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-red">No se pudo cargar la información del estándar.</div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary text-sm"
                onClick={() => setComplianceStudent(null)}
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: BITÁCORA FORENSE DE CORREOS INSTITUCIONALES ─── */}
      {isEmailLogsModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsEmailLogsModalOpen(false)}>
          <div className="modal-dialog modal-dialog-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="title-sm m-0 text-cyan">✉️ Bitácora Forense de Notificaciones y Correos</h3>
                <div className="text-xs text-secondary mt-4">
                  Registro auditable de confirmaciones de matrícula, credenciales y guías de inducción despachadas.
                </div>
              </div>
              <button 
                className="btn btn-secondary text-xs px-8 py-4"
                onClick={() => setIsEmailLogsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body overflow-auto">
              {emailLogsLoading ? (
                <div className="text-center py-32 text-secondary">Cargando registros forenses de correo...</div>
              ) : emailLogs.length > 0 ? (
                <table className="admin-table text-xs">
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Destinatario</th>
                      <th scope="col">Estudiante / Promoción</th>
                      <th scope="col">Asunto Institucional</th>
                      <th scope="col">Fecha / Hora</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map(log => {
                      const status = EMAIL_STATUS[log.status] || { label: log.status, className: 'email-status' };
                      return (
                        <tr key={log.id} data-email-status={log.status}>
                          <td className="font-mono">{log.id}</td>
                          <td className="font-mono text-cyan">{log.recipient_email}</td>
                          <td>
                            <div>{log.student_name || 'Estudiante'}</div>
                            <span className="badge-admin text-xs">{log.cohort || 'Promoción 1'}</span>
                          </td>
                          <td>{log.subject}</td>
                          <td className="font-mono text-muted">{formatDateTime(log.sent_at)}</td>
                          <td>
                            <span className={status.className}>{status.label}</span>
                            {log.attempts > 1 && <div className="text-muted">{log.attempts} intentos</div>}
                            {log.last_error && <div className="text-red" title={log.last_error}>{log.last_error.slice(0, 80)}</div>}
                            {log.status === 'failed' && !!log.retryable && (
                              <button className="btn btn-secondary text-xs px-8 py-4 mt-4" onClick={() => handleRetryEmail(log.id)}>
                                Reintentar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-24 text-muted">No hay registros de correos en la bitácora aún.</div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary text-sm"
                onClick={() => setIsEmailLogsModalOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {isCohortManagerOpen && (
        <CohortManagerModal
          cohorts={cohorts}
          onClose={() => setIsCohortManagerOpen(false)}
          onChanged={reloadPanel}
          addToast={addToast}
        />
      )}

      {isImportOpen && (
        <ImportStudentsModal
          cohorts={cohorts}
          defaultCohort={selectedCohort !== 'all' ? selectedCohort : 'Promoción 1'}
          onClose={() => setIsImportOpen(false)}
          onImported={reloadPanel}
          addToast={addToast}
        />
      )}

      {isActionsOpen && <AdminActionsModal onClose={() => setIsActionsOpen(false)} />}

      {manageStudentId && (
        <StudentManageModal
          key={manageStudentId}
          studentId={manageStudentId}
          cohorts={cohorts}
          onClose={() => setManageStudentId(null)}
          onChanged={reloadPanel}
          addToast={addToast}
        />
      )}
    </div>
  );
}
