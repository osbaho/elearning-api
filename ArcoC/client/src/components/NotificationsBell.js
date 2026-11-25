'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, formatRelative } from '../lib/api';

const ICONS = {
  case_answered: '📨',
  step_reopened: '↺',
  exam_attempt_granted: '📝',
  reinforcement: '💬',
};

/**
 * Campana de avisos del estudiante (GET/POST /api/student/notifications): respuestas a sus
 * reportes, pasos reabiertos, intentos adicionales del examen y mensajes de su coordinador. Se
 * actualiza al abrir la página y al volver a la pestaña.
 */
export default function NotificationsBell() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const load = useCallback(() => apiRequest('/student/notifications').then((res) => {
    if (res.ok) setData(res.data);
  }), []);

  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  // Cerrar al hacer clic fuera del panel o con Escape
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markRead = async (ids) => {
    const res = await apiRequest('/student/notifications/read', { method: 'POST', body: ids ? { ids } : {} });
    if (res.ok) {
      setData((current) => current && {
        unread: res.data.unread,
        items: current.items.map((item) => (!ids || ids.includes(item.id) ? { ...item, read: true } : item)),
      });
    }
  };

  if (!data) return null;
  const unread = data.unread;

  return (
    <div className="notif-wrap" ref={panelRef}>
      <button
        type="button"
        className="notif-bell"
        id="btn-notifications"
        aria-label={unread > 0 ? `Avisos: ${unread} sin leer` : 'Avisos'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        🔔{unread > 0 && <span className="count-badge" id="notifications-unread">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" id="notifications-panel" role="dialog" aria-label="Avisos">
          <div className="notif-panel-header">
            <strong>Avisos</strong>
            {unread > 0 && (
              <button type="button" className="btn-report" id="btn-notifications-read-all" onClick={() => markRead(null)}>
                Marcar todos como leídos
              </button>
            )}
          </div>
          {data.items.length === 0 && <div className="notif-empty">No tienes avisos.</div>}
          {data.items.map((item) => {
            const content = (
              <>
                <div className="notif-item-title">{ICONS[item.kind] || '🔔'} {item.title}</div>
                {item.body && <div className="notif-item-body">{item.body}</div>}
                <div className="notif-item-time">{formatRelative(item.createdAt)}</div>
              </>
            );
            const onOpen = () => {
              if (!item.read) markRead([item.id]);
              setOpen(false);
            };
            return item.link ? (
              <Link key={item.id} href={item.link} className={`notif-item ${item.read ? '' : 'unread'}`}
                data-notification={item.kind} onClick={onOpen}>
                {content}
              </Link>
            ) : (
              <button key={item.id} type="button" className={`notif-item ${item.read ? '' : 'unread'}`}
                data-notification={item.kind} onClick={onOpen}>
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
