/**
 * V-19: Skeleton de carga del Gantt.
 * Reemplaza el spinner genérico durante `portfolio.status === 'loading'` con
 * placeholders animados que mimic la estructura final (toolbar+grid+timeline).
 */
export function GanttSkeleton() {
  return (
    <div className="gantt-skeleton" aria-busy="true" aria-label="Cargando datos del Gantt">
      <div className="gantt-skeleton-grid">
        {/* Encabezados de columnas */}
        <div className="gantt-skeleton-header">
          <span className="sk-bar sk-bar--header" style={{ width: '40%' }} />
          <span className="sk-bar sk-bar--header" style={{ width: '14%' }} />
          <span className="sk-bar sk-bar--header" style={{ width: '8%' }} />
          <span className="sk-bar sk-bar--header" style={{ width: '8%' }} />
          <span className="sk-bar sk-bar--header" style={{ width: '10%' }} />
        </div>
        {/* Filas con anchos variados */}
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="gantt-skeleton-row" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="sk-bar" style={{ width: `${[68, 50, 54, 44, 60, 48, 62, 52, 70][i]}%` }} />
            <span className="sk-bar" style={{ width: '14%' }} />
            <span className="sk-bar" style={{ width: '6%' }} />
            <span className="sk-bar" style={{ width: '8%' }} />
            <span className="sk-bar sk-bar--badge" />
          </div>
        ))}
      </div>
      <div className="gantt-skeleton-timeline">
        <div className="gantt-skeleton-scale">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="sk-bar sk-bar--scale" />
          ))}
        </div>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="gantt-skeleton-tlrow" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="sk-bar sk-bar--task" style={{ marginLeft: `${i * 6}%`, width: `${10 + (i % 4) * 8}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
