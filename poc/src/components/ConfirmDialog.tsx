interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ title, description, confirmLabel = 'Confirmar', busy = false, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
        <header>
          <p>Confirmacion requerida</p>
          <h2 id="confirm-title">{title}</h2>
        </header>
        <p id="confirm-desc">{description}</p>
        <footer>
          <button type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={busy} autoFocus>{busy ? 'Procesando...' : confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}
