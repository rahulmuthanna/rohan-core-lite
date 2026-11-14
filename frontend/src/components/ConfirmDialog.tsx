import { type ReactNode, useState } from 'react';
import { type ApiError, toApiError } from '../api/client';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Makes the confirm button red, for actions that remove something. */
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Asks "are you sure?" before an action, and shows the server's message if the action fails. */
export function ConfirmDialog({ title, children, confirmLabel, danger, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | undefined>(undefined);

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm();
    } catch (failure) {
      setError(toApiError(failure));
      setBusy(false);
    }
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="dialog-body">{children}</div>
      {error && (
        <p className="form-error" role="alert">
          {error.message}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={danger ? 'button button-danger' : 'button button-primary'}
          onClick={confirm}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
