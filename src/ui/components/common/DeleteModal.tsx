
interface DeleteModalProps {
  isOpen: boolean
  eventTitle: string
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}

export default function DeleteModal({
  isOpen,
  eventTitle,
  onClose,
  onConfirm,
  isLoading = false
}: DeleteModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header delete-header">
          <div className="delete-icon-wrapper">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <h3>Delete Event?</h3>
        </div>

        <div className="modal-body delete-body">
          <p>Are you sure you want to delete this event?</p>
          <p className="event-title">"{eventTitle}"</p>
          <p className="warning-text">This action cannot be undone.</p>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Deleting...
              </>
            ) : (
              <>
                <i className="fas fa-trash"></i> Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
