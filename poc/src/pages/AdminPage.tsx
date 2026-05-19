import { Navigate, useNavigate } from 'react-router';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { apiUrl } from '../lib/api';
import { errorMessage, useToast } from '../lib/toast';
import type { AuthSession, Profile } from '../lib/types';

interface AdminPageProps {
  session: AuthSession | null;
  onLogout: () => Promise<void> | void;
}

const STATUS_LABELS: Record<string, string> = { active: 'Activo', inactive: 'Inactivo', invited: 'Invitado' };
const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;

export function AdminPage({ session, onLogout }: AdminPageProps) {
  const token = session?.accessToken ?? null;
  const { notify } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  // V-17 fix: búsqueda + filtro de status (active/inactive/invited/all)
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'invited'>('active');

  const loadUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('api/admin/users'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json() as { data: Profile[] };
      setUsers(json.data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [token]);

  useEffect(() => { void loadUsers(); }, [loadUsers]); // eslint-disable-line react-hooks/set-state-in-effect

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    setInviting(true);
    try {
      const res = await fetch(apiUrl('api/admin/users'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, full_name: inviteName }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      setInviteEmail('');
      setInviteName('');
      await loadUsers();
      notify({ tone: 'success', title: 'Usuario invitado' });
    } catch (err) {
      notify({ tone: 'error', title: 'No se pudo invitar usuario', detail: errorMessage(err) });
    } finally {
      setInviting(false);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const res = await fetch(apiUrl(`api/admin/users/${userId}`), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      await loadUsers();
      notify({ tone: 'success', title: `Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'}` });
    } catch {
      notify({ tone: 'error', title: 'No se pudo cambiar estado' });
    }
  };

  if (!token) return <Navigate to="/login" replace />;

  return (
    <AppShell summary={null} userName={session?.userName ?? 'Admin'} onLogout={onLogout} breadcrumb="Administración">
      <main className="admin-page">
        <h1>Administración de usuarios</h1>
        <p>Invita, activa y desactiva usuarios de la plataforma.</p>

        <form className="assign-form" onSubmit={invite}>
          <label className="edit-field">
            <span>Nombre completo</span>
            <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Ana Torres" />
          </label>
          <label className="edit-field">
            <span>Email</span>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="ana@abax.local" />
          </label>
          <button className="primary-button" type="submit" disabled={inviting}>{inviting ? 'Invitando...' : 'Invitar usuario'}</button>
        </form>

        <hr style={{ margin: '20px 0', borderColor: 'var(--divider)' }} />

        {status === 'loading' && <p>Cargando usuarios...</p>}
        {status === 'error' && <p>No se pudieron cargar usuarios.</p>}
        {status === 'ready' && (() => {
          const filtered = users.filter((u) => {
            if (statusFilter !== 'all' && u.status !== statusFilter) return false;
            const q = filterText.trim().toLowerCase();
            if (!q) return true;
            return (u.full_name?.toLowerCase().includes(q) ?? false) || (u.email?.toLowerCase().includes(q) ?? false);
          });
          return (
            <>
              <div className="admin-filterbar">
                <input
                  className="admin-search"
                  type="search"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Buscar por nombre o email"
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                  <option value="invited">Invitados</option>
                  <option value="all">Todos</option>
                </select>
                <span className="admin-filter-count">{filtered.length} de {users.length} usuarios</span>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Estado</th>
                    <th>Admin</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>Sin usuarios que coincidan con el filtro.</td></tr>
                  ) : filtered.map((user) => (
                    <tr key={user.id}>
                      <td>{user.full_name}</td>
                      <td>{user.email}</td>
                      <td><span className={`status-pill status-pill--${user.status}`}>{statusLabel(user.status)}</span></td>
                      <td>{user.is_admin ? 'Sí' : 'No'}</td>
                      <td>
                        <button onClick={() => void toggleStatus(user.id, user.status)}>
                          {user.status === 'active' ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          );
        })()}
        <button className="ghost-button" style={{ marginTop: 16 }} onClick={() => navigate('/gantt')}>← Volver al Gantt</button>
      </main>
    </AppShell>
  );
}
