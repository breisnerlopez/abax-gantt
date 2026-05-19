import { useEffect } from 'react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface Group {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const GROUPS: Group[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Abrir este panel de atajos' },
      { keys: ['⌘', 'K'], description: 'Buscar tareas, proyectos, personas' },
      { keys: ['Esc'], description: 'Cerrar diálogos y modales' },
    ],
  },
  {
    title: 'Estructura WBS',
    shortcuts: [
      { keys: ['⌘', '⇧', 'N'], description: 'Crear proyecto nuevo' },
      { keys: ['Enter'], description: 'Crear tarea hija del nodo seleccionado' },
      { keys: ['⌘', '⌫'], description: 'Enviar tarea al backlog' },
    ],
  },
  {
    title: 'Navegación temporal del Gantt',
    shortcuts: [
      { keys: ['+'], description: 'Zoom in (acercar)' },
      { keys: ['-'], description: 'Zoom out (alejar)' },
      { keys: ['→'], description: 'Avanzar en el tiempo' },
      { keys: ['←'], description: 'Retroceder en el tiempo' },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Atajos de teclado">
        <header className="shortcuts-header">
          <div>
            <p>AYUDA</p>
            <h2>Atajos de teclado</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="shortcuts-body">
          {GROUPS.map((group) => (
            <section key={group.title} className="shortcuts-group">
              <h3>{group.title}</h3>
              <ul>
                {group.shortcuts.map((s) => (
                  <li key={s.description}>
                    <span>{s.description}</span>
                    <span className="shortcut-keys">
                      {s.keys.map((k, i) => (
                        <kbd key={i}>{k}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <footer className="shortcuts-footer">
          <small>En macOS, ⌘ es <kbd>Cmd</kbd>; en Windows/Linux, usa <kbd>Ctrl</kbd>.</small>
        </footer>
      </div>
    </div>
  );
}
