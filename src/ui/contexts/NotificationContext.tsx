import React, { createContext, useContext, useState, useCallback } from 'react';

/* ============================================
   FINANCE APP - NOTIFICATION/TOAST SYSTEM
   ============================================ */

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  success: (title: string, message?: string, duration?: number) => string;
  error: (title: string, message?: string, duration?: number) => string;
  warning: (title: string, message?: string, duration?: number) => string;
  info: (title: string, message?: string, duration?: number) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const generateId = () => `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000,
    };

    setNotifications(prev => [...prev, newNotification]);
    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Helper methods for common notification types
  const success = useCallback((title: string, message?: string, duration?: number) => {
    return addNotification({ type: 'success', title, message, duration });
  }, [addNotification]);

  const error = useCallback((title: string, message?: string, duration?: number) => {
    return addNotification({ type: 'error', title, message, duration: duration ?? 8000 }); // Errors show longer
  }, [addNotification]);

  const warning = useCallback((title: string, message?: string, duration?: number) => {
    return addNotification({ type: 'warning', title, message, duration });
  }, [addNotification]);

  const info = useCallback((title: string, message?: string, duration?: number) => {
    return addNotification({ type: 'info', title, message, duration });
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll,
      success,
      error,
      warning,
      info,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
