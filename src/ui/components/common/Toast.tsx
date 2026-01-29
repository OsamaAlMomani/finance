import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import type { Notification, NotificationType } from '../../contexts/NotificationContext';
import './Toast.css';

/* ============================================
   FINANCE APP - TOAST NOTIFICATION COMPONENT
   ============================================ */

const iconMap: Record<NotificationType, React.ReactNode> = {
  success: <CheckCircle size={20} />,
  error: <AlertCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};

interface ToastItemProps {
  notification: Notification;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification.duration) return;

    const startTime = Date.now();
    const duration = notification.duration;

    // Update progress bar
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, ((duration - elapsed) / duration) * 100);
      setProgress(remaining);
    }, 50);

    // Auto dismiss timer
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300); // Wait for exit animation
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, [notification.duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div 
      className={`toast-item toast-${notification.type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-icon">
        {iconMap[notification.type]}
      </div>
      
      <div className="toast-content">
        <div className="toast-title">{notification.title}</div>
        {notification.message && (
          <div className="toast-message">{notification.message}</div>
        )}
        {notification.action && (
          <button 
            className="toast-action"
            onClick={() => {
              notification.action?.onClick();
              handleClose();
            }}
          >
            {notification.action.label}
          </button>
        )}
      </div>

      <button 
        className="toast-close"
        onClick={handleClose}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>

      {notification.duration && (
        <div 
          className="toast-progress"
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
};

interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxVisible?: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ 
  position = 'top-right',
  maxVisible = 5 
}) => {
  const { notifications, removeNotification } = useNotification();
  
  const visibleNotifications = notifications.slice(-maxVisible);

  if (visibleNotifications.length === 0) return null;

  return (
    <div className={`toast-container toast-${position}`}>
      {visibleNotifications.map(notification => (
        <ToastItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
