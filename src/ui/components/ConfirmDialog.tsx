import React, { useEffect, useId } from 'react';
import { useI18n } from '../contexts/useI18n';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useI18n();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="app-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="app-modal-title">{title}</h3>
        <p className="app-modal-message">{message}</p>
        <div className="app-modal-actions">
          <button type="button" className="btn app-modal-btn-secondary" onClick={onCancel}>
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            className={`btn ${destructive ? 'app-modal-btn-danger' : 'app-modal-btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
