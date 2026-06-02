import { Navigate, useNavigate } from 'react-router';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { apiUrl, createTeam, listAdminTeams, updateTeam } from '../lib/api';
import { errorMessage, useToast } from '../lib/toast';
import type { AuthSession, Profile, Team } from '../lib/types';

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

  // Fase 9 — sección de equipos. El admin los crea, los desactiva y asigna lead.
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsStatus, setTeamsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#4f5bd5');
  const [teamLead, setTeamLead] = useState<string>('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamFilter, setTeamFilter] = useState<'active' | 'inactive' | 'all'>('active');

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

  const loadTeams = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listAdminTeams(token);
      setTeams(data);
      setTeamsStatus('ready');
    } catch {
      setTeamsStatus('error');
    }
  }, [token]);

  useEffect(() => { void loadTeams(); }, [loadTeams]); // eslint-disable-line react-hooks/set-state-in-effect

  const submitTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !teamName.trim()) return;
    setCreatingTeam(true);
    try {
      await createTeam(token, { name: teamName.trim(), color: teamColor, lead_id: teamLead || null });
      setTeamName('');
      setTeamLead('');
      await loadTeams();
      notify({ tone: 'success', title: 'Equipo creado' });
    } catch (err) {
      notify({ tone: 'error', title: 'No se pudo crear el equipo', detail: errorMessage(err) });
    } finally {
      setCreatingTeam(false);
    }
  };

  const toggleTeamActive = async (team: Team) => {
    if (!token) return;
    try {
      await updateTeam(token, team.id, { is_active: !(team.is_active ?? true) });
      await loadTeams();
      notify({ tone: 'success', title: `Equipo ${team.is_active === false ? 'activado' : 'desactivado'}` });
    } catch (err) {
      notify({ tone: 'error', title: 'No se pudo cambiar el equipo', detail: errorMessage(err) });
    }
  };

  const filteredTeams = teams.filter((t) => {
    if (teamFilter === 'all') return true;
    if (teamFilter === 'active') return t.is_active !== false;
    return t.is_active === false;
  });
  const userById = new Map(users.map((u) => [u.id, u]));

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
        <h1>Administración</h1>
        <p>Gestiona usuarios y equipos de la plataforma.</p>

        <h2 className="admin-section-h">Usuarios</h2>
        <p className="admin-section-sub">Invita, activa y desactiva usuarios.</p>

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
                <select aria-label="Filtrar por estado de usuario" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
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
        <h2 className="admin-section-h">Equipos</h2>
        <p className="admin-section-sub">Crea equipos para agrupar proyectos por área u oficina. Asigna un lead (admin/responsable) opcional.</p>

        <form className="assign-form admin-team-form" onSubmit={submitTeam}>
          <label className="edit-field">
            <span>Nombre del equipo</span>
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Equipo Producto" />
          </label>
          <label className="edit-field admin-color-field">
            <span>Color</span>
            <input
              type="color"
              aria-label="Color del equipo"
              value={teamColor}
              onChange={(e) => setTeamColor(e.target.value)}
            />
          </label>
          <label className="edit-field">
            <span>Lead (opcional)</span>
            <select
              aria-label="Lead del equipo"
              value={teamLead}
              onChange={(e) => setTeamLead(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {users
                .filter((u) => u.status === 'active' && (u.is_admin || true))
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name ?? u.email ?? u.id}</option>
                ))}
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={creatingTeam || !teamName.trim()}>
            {creatingTeam ? 'Creando...' : 'Crear equipo'}
          </button>
        </form>

        {teamsStatus === 'loading' && <p>Cargando equipos...</p>}
        {teamsStatus === 'error' && <p>No se pudieron cargar los equipos.</p>}
        {teamsStatus === 'ready' && (
          <>
            <div className="admin-filterbar">
              <select
                aria-label="Filtrar por estado de equipo"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value as typeof teamFilter)}
              >
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="all">Todos</option>
              </select>
              <span className="admin-filter-count">{filteredTeams.length} de {teams.length} equipos</span>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Lead</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-faint)' }}>Sin equipos. Crea el primero con el formulario de arriba.</td></tr>
                ) : filteredTeams.map((team) => {
                  const lead = team.lead_id ? userById.get(team.lead_id) : null;
                  const active = team.is_active !== false;
                  return (
                    <tr key={team.id}>
                      <td>
                        <span className="admin-team-name">
                          <span className="admin-team-swatch" style={{ background: team.color }} aria-hidden="true" />
                          {team.name}
                        </span>
                      </td>
                      <td>{lead?.full_name ?? lead?.email ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                      <td><span className={`status-pill status-pill--${active ? 'active' : 'inactive'}`}>{active ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        <button onClick={() => void toggleTeamActive(team)}>
                          {active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        <button className="ghost-button" style={{ marginTop: 16 }} onClick={() => navigate('/gantt')}>← Volver al Gantt</button>
      </main>
    </AppShell>
  );
}
