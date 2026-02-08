import { useEffect, useState } from 'react';
import { useI18n } from '../contexts/useI18n';

export const TitleBar = ({ userName }: { userName?: string }) => {
  const { t } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);
  const [loadedName, setLoadedName] = useState('');
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
        <div className="titlebar-user">{userName || loadedName || t('titlebar.userFallback')}</div>
      </div>

      <div className="titlebar-controls">
        <div className="titlebar-help">
          <button
            className="titlebar-help-btn"
            aria-label={t('titlebar.help')}
            onClick={() => setHelpOpen((prev) => !prev)}
          >
            ?
          </button>
          {helpOpen && (
            <div className="titlebar-help-menu" role="list">
              <div className="titlebar-help-title">{t('help.title')}</div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.dashboard.title')}</span>
                <small>{t('help.dashboard.desc')}</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.transactions.title')}</span>
                <small>{t('help.transactions.desc')}</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.budget.title')}</span>
                <small>{t('help.budget.desc')}</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.goals.title')}</span>
                <small>{t('help.goals.desc')}</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.bills.title')}</span>
                <small>{t('help.bills.desc')}</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.loans.title')}</span>
                <small>{t('help.loans.desc')}</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.plans.title')}</span>
                <small>{t('help.plans.desc')}</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.users.title')}</span>
                <small>{t('help.users.desc')}</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.importExport.title')}</span>
                <small>{t('help.importExport.desc')}</small>
              </div>
              <div className="titlebar-help-item" role="listitem">
                <span>{t('help.settings.title')}</span>
                <small>{t('help.settings.desc')}</small>
              </div>
            </div>
          )}
        </div>
        <button
          className="titlebar-control"
          aria-label={t('titlebar.minimize')}
          onClick={() => window.electron?.windowControl?.minimize()}
        >
          —
        </button>
        <button
          className="titlebar-control"
          aria-label={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
          onClick={handleMaximize}
        >
          {isMaximized ? '❐' : '□'}
        </button>
        <button
          className="titlebar-control close"
          aria-label={t('titlebar.close')}
          onClick={() => window.electron?.windowControl?.close()}
        >
          ✕
        </button>
      </div>
    </div>
  );
};
