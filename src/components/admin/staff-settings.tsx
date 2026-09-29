'use client';
import { useCallback, useEffect, useState } from 'react';
import { ROLES, type Role } from '@/modules/staff/permissions';
type Staff = { userId: string; name: string; email: string; roles: Role[]; mfaEnabled: boolean };
type Audit = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};
async function request<T>(url: string, data?: unknown): Promise<T> {
  const response = await fetch(
    url,
    data
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : undefined,
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error.message);
  return result;
}
export function StaffSettings() {
  const [tab, setTab] = useState<'staff' | 'audit'>('staff');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [events, setEvents] = useState<Audit[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('support');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('');
  const [actor, setActor] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setStaff((await request<{ items: Staff[] }>('/api/admin/staff')).items);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    request<{ items: Staff[] }>('/api/admin/staff')
      .then((result) => {
        if (active) setStaff(result.items);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function audit(more = false) {
    setBusy(true);
    try {
      const query = new URLSearchParams();
      if (entity) query.set('entityType', entity);
      if (actor) query.set('actor', actor);
      if (more && cursor) query.set('cursor', cursor);
      const result = await request<{ items: Audit[]; nextCursor: string | null }>(
        '/api/admin/audit?' + query,
      );
      setEvents(more ? [...events, ...result.items] : result.items);
      setCursor(result.nextCursor);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function change(url: string, data: unknown) {
    setBusy(true);
    setMessage('');
    try {
      await request(url, data);
      await load();
      setMessage('Staff access updated.');
      setEmail('');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-title">
        <p className="admin-eyebrow">WORKROOM / SETTINGS</p>
        <h1>People & accountability.</h1>
        <p>Give each person the access their work needs.</p>
      </div>
      <div className="admin-tabs" aria-label="Settings sections">
        <button aria-pressed={tab === 'staff'} onClick={() => setTab('staff')}>
          Staff & roles
        </button>
        <button
          aria-pressed={tab === 'audit'}
          onClick={() => {
            setTab('audit');
            void audit();
          }}
        >
          Audit log
        </button>
      </div>
      {message && (
        <p className="admin-notice" role="status">
          {message}
        </p>
      )}
      {tab === 'staff' ? (
        <>
          <form
            className="admin-card admin-form-row"
            onSubmit={(e) => {
              e.preventDefault();
              void change('/api/admin/staff/grants', { email, role });
            }}
          >
            <label>
              Verified account email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <button className="admin-primary" disabled={busy}>
              Grant role
            </button>
          </form>
          <div className="admin-table-wrap" role="region" aria-label="Staff accounts" tabIndex={0}>
            {loading ? (
              <p role="status">Loading staff…</p>
            ) : (
              <table>
                <caption className="sr-only">Staff accounts and permissions</caption>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Roles</th>
                    <th>Authenticator</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.userId}>
                      <td>
                        <strong>{s.name}</strong>
                        <small>{s.email}</small>
                      </td>
                      <td>
                        {s.roles.map((r) => (
                          <div className="admin-role" key={r}>
                            {r.replaceAll('_', ' ')}
                            <button
                              disabled={busy}
                              className="admin-link-button"
                              aria-label={`Revoke ${r.replaceAll('_', ' ')} from ${s.name}`}
                              onClick={() => {
                                if (
                                  window.confirm(`Revoke ${r.replaceAll('_', ' ')} from ${s.name}?`)
                                )
                                  void change('/api/admin/staff/revocations', {
                                    userId: s.userId,
                                    role: r,
                                  });
                              }}
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                      </td>
                      <td>
                        <span className="admin-chip">
                          {s.mfaEnabled ? 'Enabled' : 'Not enrolled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          <form
            className="admin-card admin-form-row"
            onSubmit={(e) => {
              e.preventDefault();
              void audit();
            }}
          >
            <label>
              Entity type
              <input
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                placeholder="e.g. staff"
              />
            </label>
            <label>
              Actor
              <input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder="e.g. system:cli"
              />
            </label>
            <button className="admin-primary" disabled={busy}>
              Filter activity
            </button>
          </form>
          <div className="admin-table-wrap" role="region" aria-label="Audit entries" tabIndex={0}>
            <table>
              <caption className="sr-only">Audit activity</caption>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.createdAt).toLocaleString()}</td>
                    <td>{event.action}</td>
                    <td>
                      <code>{event.actor}</code>
                    </td>
                    <td>
                      {event.entityType}
                      <small>{event.entityId}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!events.length && (
              <p className="admin-empty">
                {busy ? 'Loading activity…' : 'No activity matches these filters.'}
              </p>
            )}
          </div>
          {cursor && (
            <button className="admin-secondary" disabled={busy} onClick={() => void audit(true)}>
              Load more
            </button>
          )}
        </>
      )}
    </>
  );
}
