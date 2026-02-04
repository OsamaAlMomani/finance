import { useEffect, useState } from 'react';

export const TitleBar = ({ userName }: { userName?: string }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [loadedName, setLoadedName] = useState('User');
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!window.electron?.windowControl) return;
    window.electron.windowControl.isMaximized().then(setIsMaximized);
  }, []);

  useEffect(() => {
    if (userName) return undefined;

    const loadUserName = async () => {
      if (!window.electron?.invoke) return;
      const data = await window.electron.invoke('user-get-all');
      const authUserId = localStorage.getItem('authUserId');
      const user = data?.users?.find((u: { id: string; name: string }) => u.id === authUserId)
        || data?.users?.find((u: { id: string; name: string }) => u.id === data?.activeUserId);
      if (user?.name) setLoadedName(user.name);
    };

    loadUserName();
    return undefined;
  }, [userName]);

  useEffect(() => {
    if (!helpOpen) return undefined;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.titlebar-help')) setHelpOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [helpOpen]);

  const handleMaximize = async () => {
    if (!window.electron?.windowControl) return;
    const next = await window.electron.windowControl.toggleMaximize();
    setIsMaximized(next);
  };

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-user">{userName || loadedName || 'User'}</div>
      </div>

      <div className="titlebar-controls">
        <div className="titlebar-help">
          <button
            className="titlebar-help-btn"
            aria-label="Help"
            onClick={() => setHelpOpen((prev) => !prev)}
          >
            ?
          </button>
          {helpOpen && (
            <div className="titlebar-help-menu" role="list">
              <div className="titlebar-help-title">Help</div>
              <div className="titlebar-help-item" role="listitem">
                <span>Dashboard</span>
                <small>Overview of balances, alerts, and recent activity.</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>Transactions</span>
                <small>Record income/expense/transfer and filter history.</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>Budget</span>
                <small>Create budgets and track spending vs limits.</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>Goals</span>
                <small>Set savings goals and monitor progress.</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>Bills</span>
                <small>Manage recurring bills and due dates.</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>Loans</span>
                <small>Track loans, interest, and payoff progress.</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>Plans</span>
                <small>Compare what‑if scenarios and outcomes.</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>Users</span>
                <small>Create users and profiles for separate data.</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>Import/Export</span>
                <small>Import files or export/backup your data.</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>Settings</span>
                <small>Change preferences like currency and privacy.</small>
              </div>
            </div>
          )}
        </div>
        <button
          className="titlebar-control"
          aria-label="Minimize"
          onClick={() => window.electron?.windowControl?.minimize()}
        >
          —
        </button>
        <button
          className="titlebar-control"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          onClick={handleMaximize}
        >
          {isMaximized ? '❐' : '□'}
        </button>
        <button
          className="titlebar-control close"
          aria-label="Close"
          onClick={() => window.electron?.windowControl?.close()}
        >
          ✕
        </button>
      </div>
    </div>
  );
};
