import { useRef, useState } from 'react';
import type { NodeType, Team, WbsNode } from '../lib/types';
import { normalizeNodeDates, validateNodeInput } from '../lib/validation';

type DialogMode = 'project' | 'child';

interface CreateDialogProps {
  mode: DialogMode | null;
  parent: WbsNode | null;
  onClose: () => void;
  /** Acepta team_id opcional para asignar el proyecto a un equipo al crearlo (Fase 9). */
  onCreateProject: (input: { name: string; team_id?: string | null }) => Promise<void>;
  onCreateChild: (input: { name: string; type: NodeType; start_date: string | null; end_date: string | null }) => Promise<void>;
  canEditStructure: boolean;
  /** Equipos activos disponibles para asignar (mode='project'). */
  teams?: Team[];
}

const childTypes: { value: NodeType; label: string }[] = [
  { value: 'stage', label: 'Etapa' },
  { value: 'group', label: 'Grupo' },
  { value: 'task', label: 'Tarea' },
  { value: 'milestone', label: 'Hito' },
];

export function CreateDialog({ mode, parent, onClose, onCreateProject, onCreateChild, canEditStructure, teams = [] }: CreateDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<NodeType>(() => defaultChildType(parent));
  const [scheduled, setScheduled] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teamId, setTeamId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Guard contra double-submit (doble click/Enter antes de que React aplique `disabled`).
  const submitLockRef = useRef(false);

  if (!mode || !canEditStructure) return null;

  const isProject = mode === 'project';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitLockRef.current) return;
    const cleanName = name.trim();
    const dates = normalizeNodeDates(type, scheduled ? startDate || null : null, scheduled ? endDate || null : null);
    const validation = validateNodeInput({ name: cleanName, type, start_date: dates.start_date, end_date: dates.end_date });
    if (!validation.ok) {
      setError(validation.message ?? 'Datos inválidos.');
      return;
    }

    submitLockRef.current = true;
    setSaving(true);
    setError(null);
    try {
      if (isProject) {
        await onCreateProject({ name: cleanName, team_id: teamId || null });
      } else {
        await onCreateChild({
          name: cleanName,
          type,
          start_date: dates.start_date,
          end_date: dates.end_date,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear.');
    } finally {
      setSaving(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="create-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={isProject ? 'Crear proyecto' : `Crear nodo bajo ${parent?.name ?? 'selección'}`}>
        <header>
          <div>
            <p>{isProject ? 'Nuevo proyecto' : `Nodo bajo ${parent?.name ?? 'selección'}`}</p>
            <h2>{isProject ? 'Crear proyecto' : 'Crear nodo hijo'}</h2>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>

        <label className="edit-field">
          <span>Nombre</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={isProject ? 'Ej. Torre Polaris' : 'Ej. Diseño estructural'} />
        </label>

        {isProject && (
          <label className="edit-field">
            <span>Equipo (opcional)</span>
            <select
              aria-label="Equipo del proyecto"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="">Sin equipo</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {teams.length === 0 && (
              <small style={{ color: 'var(--text-faint)', fontSize: 'var(--fs-11)' }}>
                Crea equipos desde Admin para poder agruparlos en el portafolio.
              </small>
            )}
          </label>
        )}

        {!isProject && (
          <>
            <label className="edit-field">
              <span>Tipo</span>
              <select value={type} onChange={(event) => setType(event.target.value as NodeType)}>
                {childTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="check-field">
              <input type="checkbox" checked={scheduled} onChange={(event) => setScheduled(event.target.checked)} />
              Programar en timeline ahora
            </label>
            {scheduled && (
              <div className="field-grid">
                <label className="edit-field">
                  <span>Inicio</span>
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label className="edit-field">
                  <span>Fin</span>
                  <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              </div>
            )}
          </>
        )}

        {error && <p className="form-error">{error}</p>}

        <footer>
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear'}</button>
        </footer>
      </form>
    </div>
  );
}

function defaultChildType(parent: WbsNode | null): NodeType {
  if (!parent) return 'task';
  if (parent.type === 'project') return 'stage';
  if (parent.type === 'stage') return 'group';
  return 'task';
}
