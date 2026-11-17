import { useCallback, useEffect, useRef, useState } from 'react';
import { MaterialIcon } from '../icons/MaterialIcon';
import { useFinanceData } from '../../app/FinanceDataProvider';
import { apiFetch } from '../../lib/http';
import { useHeaderComputedNotifications } from '../../hooks/useHeaderComputedNotifications';

type NotificationRow = {
    id?: string;
    title?: string;
    body?: string;
    message?: string;
    kind?: string;
    read?: boolean;
};

export function HeaderNotifications() {
    const { data, refresh } = useFinanceData();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const apiItems = (data?.userNotifications ?? []) as NotificationRow[];
    const computed = useHeaderComputedNotifications(data);
    const items = [
        ...computed.map((c) => ({ id: c.id, title: c.title, body: c.body, read: false, kind: c.kind })),
        ...apiItems
    ];
    const unread = items.filter((n) => !n.read).length;

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) close();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open, close]);

    async function markAllRead() {
        await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
        await refresh();
    }

    return (
        <div className="header-notifications" ref={panelRef}>
            <button
                type="button"
                className="header-btn"
                id="notifications-btn"
                title="Avisos"
                aria-expanded={open}
                aria-haspopup="true"
                aria-controls="notifications-panel"
                onClick={() => setOpen((v) => !v)}
            >
                <MaterialIcon name="notifications" variant="app" />
                <span className={`notification-badge${unread > 0 ? '' : ' hidden'}`} aria-label="Quantidade de avisos">
                    {unread}
                </span>
            </button>
            <div id="notifications-panel" className={`notifications-panel${open ? '' : ' hidden'}`} role="menu" aria-label="Avisos">
                <div className="notifications-panel-head">
                    <span className="notifications-panel-title">Avisos</span>
                    <span className="notifications-panel-hint">Faturas, cofrinhos e lançamentos</span>
                    {unread > 0 ? (
                        <button type="button" className="btn-secondary btn-small" onClick={() => void markAllRead()}>
                            Marcar lidos
                        </button>
                    ) : null}
                </div>
                <ul id="notifications-list" className="notifications-list" role="none">
                    {items.length === 0 ? (
                        <li className="notifications-empty" role="status">
                            Nenhum aviso no momento.
                        </li>
                    ) : (
                        items.slice(0, 30).map((n, i) => (
                            <li key={n.id ?? i} className={`notifications-item${n.read ? ' is-read' : ''}`}>
                                <strong>{n.title || n.kind || 'Aviso'}</strong>
                                <p className="card-metric-hint">{n.body || n.message || ''}</p>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </div>
    );
}