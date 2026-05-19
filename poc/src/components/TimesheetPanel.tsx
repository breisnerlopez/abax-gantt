import { useCallback, useEffect, useState } from 'react';
import { listTimeEntries, createTimeEntry } from '../lib/api';
import { errorMessage, useToast } from '../lib/toast';
import type { WbsNode } from '../lib/types';

interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  hours: number;
  notes: string | null;
  entry_date: string;
  profiles: { id: string; full_name: string; avatar_url: string | null } | null;
}

export function TimesheetPanel({ node, token }: { node: WbsNode; token: string }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hours, setHours] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setEntries(await listTimeEntries(token, node.id));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [node.id, token]);

  useEffect(() => { void reload(); }, [reload]); // eslint-disable-line react-hooks/set-state-in-effect

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = Number(hours);
    if (!hoursNum || hoursNum <= 0) return;
    setSaving(true);
    try {
      await createTimeEntry(token, { task_id: node.id, hours: hoursNum, notes: notes || undefined });
      setHours('1');
      setNotes('');
      await reload();
      notify({ tone: 'success', title: 'Horas registradas' });
    } catch (err) {
      notify({ tone: 'error', title: 'No se pudieron registrar horas', detail: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="detail-content">
      <form className="assign-form" onSubmit={submit}>
        <label className="edit-field">
          <span>Horas trabajadas</span>
          <input type="number" min="0.25" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} disabled={saving} />
        </label>
        <label className="edit-field">
          <span>Notas opcionales</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Descripcion breve..." disabled={saving} />
        </label>
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Registrar horas'}</button>
      </form>

      <hr style={{ borderColor: 'var(--divider)' }} />

      {status === 'loading' && <p>Consultando registros...</p>}
      {status === 'error' && <p>No se pudieron cargar horas.</p>}
      {status === 'ready' && entries.length === 0 && <p>Sin horas registradas en esta tarea.</p>}
      {status === 'ready' && (
        <div className="timesheet-panel">
          {entries.map((entry) => (
            <div key={entry.id} className="timesheet-row">
              <div>
                <b>{entry.profiles?.full_name ?? entry.user_id}</b>
                <br />
                <span>{entry.entry_date}</span>
              </div>
              <b>{entry.hours}h</b>
              {entry.notes && <span>{entry.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
