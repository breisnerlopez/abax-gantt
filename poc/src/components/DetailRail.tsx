import type { WbsNode } from '../lib/types';

interface DetailRailProps {
  selectedNode: WbsNode | null;
  onOpen: () => void;
}

/**
 * Rail vertical lateral derecho (mirror del backlog rail), siempre visible cuando el
 * panel de detalle está colapsado. Muestra icono + label "Detalle" y, si hay nodo
 * seleccionado, su nombre rotado para conservar contexto.
 */
export function DetailRail({ selectedNode, onOpen }: DetailRailProps) {
  const title = selectedNode
    ? `Abrir detalle de ${selectedNode.name}`
    : 'Abrir panel de detalle (selecciona un nodo primero)';
  return (
    <aside className="detail-rail" aria-label="Panel de detalle (colapsado)">
      <button
        className="detail-rail-toggle"
        title={title}
        aria-label={title}
        onClick={onOpen}
      >
        <span className="detail-rail-icon" aria-hidden>📋</span>
      </button>
      <span className="detail-rail-label">
        {selectedNode ? selectedNode.name : 'Detalle'}
      </span>
      {selectedNode && (
        <span className={`detail-rail-dot type-dot--${selectedNode.type}`} aria-hidden />
      )}
    </aside>
  );
}
