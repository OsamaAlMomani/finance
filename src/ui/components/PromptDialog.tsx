import React, { useEffect, useId, useRef } from 'react';
import { useI18n } from '../contexts/useI18n';

type PromptDialogProps = {
  open: boolean;
  title: string;
  message: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export const PromptDialog: React.FC<PromptDialogProps> = ({
  open,
  title,
  message,
  placeholder,
  initialValue = '',
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

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

  const handleCancel = () => {
    if (inputRef.current) {
      inputRef.current.value = initialValue;
    }
    onCancel();
  };

  const handleConfirm = () => {
    const next = inputRef.current?.value ?? initialValue;
    onConfirm(next);
  };

  if (!open) return null;

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={handleCancel}>
      <div
        className="app-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="app-modal-title">{title}</h3>
        <p className="app-modal-message">{message}</p>
        <input
          key={`${open}-${initialValue}`}
          ref={inputRef}
          className="app-modal-input"
          placeholder={placeholder}
          defaultValue={initialValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleConfirm();
            }
          }}
        />
        <div className="app-modal-actions">
          <button
            type="button"
            className="btn app-modal-btn-secondary"
            onClick={handleCancel}
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn app-modal-btn-primary"
            onClick={handleConfirm}
          >
            {confirmLabel || t('common.create')}
          </button>
        </div>
      </div>
    </div>
  );
};
