import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Target,
  CalendarDays,
  LineChart,
  Wallet,
  Settings,
  CreditCard,
  FileUp,
  ClipboardList,
  AlertTriangle,
  Scale,
  FileChartColumn,
  Share2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  type LucideIcon
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../contexts/useI18n';
import { BrandBadge } from './BrandBadge';

const MOBILE_BREAKPOINT = 1024;

interface SidebarNavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

interface SidebarNavGroup {
  titleKey: string;
  items: SidebarNavItem[];
}

const NAV_GROUPS: SidebarNavGroup[] = [
  {
    titleKey: 'sidebar.domain.dashboard',
    items: [{ to: '/', labelKey: 'sidebar.dashboard', icon: LayoutDashboard }]
  },
  {
    titleKey: 'sidebar.domain.money',
    items: [
      { to: '/transactions', labelKey: 'sidebar.transactions', icon: Receipt },
      { to: '/accounts', labelKey: 'sidebar.accounts', icon: Wallet },
      { to: '/budget', labelKey: 'sidebar.budget', icon: PiggyBank },
      { to: '/bills', labelKey: 'sidebar.bills', icon: CalendarDays },
      { to: '/loans', labelKey: 'sidebar.loans', icon: CreditCard }
    ]
  },
  {
    titleKey: 'sidebar.domain.planning',
    items: [
      { to: '/goals', labelKey: 'sidebar.goals', icon: Target },
      { to: '/plans', labelKey: 'sidebar.plans', icon: ClipboardList },
      { to: '/scenarios', labelKey: 'sidebar.scenarios', icon: LineChart }
    ]
  },
  {
    titleKey: 'sidebar.domain.alerts',
    items: [
      { to: '/alerts', labelKey: 'sidebar.alerts', icon: AlertTriangle },
      { to: '/settlement', labelKey: 'sidebar.settlement', icon: Scale }
    ]
  },
  {
    titleKey: 'sidebar.domain.analysis',
    items: [{ to: '/reports', labelKey: 'sidebar.reports', icon: FileChartColumn }]
  },
  {
    titleKey: 'sidebar.domain.sharing',
    items: [
      { to: '/sharing', labelKey: 'sidebar.sharing', icon: Share2 },
      { to: '/import-export', labelKey: 'sidebar.importExport', icon: FileUp }
    ]
  }
];

const FOOTER_LINKS: SidebarNavItem[] = [{ to: '/settings', labelKey: 'sidebar.settings', icon: Settings }];

export const Sidebar = () => {
  const { t, dir } = useI18n();
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem('sidebarCollapsed') === '1');
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= MOBILE_BREAKPOINT);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const shouldShowLabels = isMobile || !collapsed;
  const collapsedLabelOffset = dir === 'rtl' ? 8 : -8;
  const mobileHiddenX = dir === 'rtl' ? '106%' : '-106%';

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
      return;
    }
    setCollapsed((prev) => !prev);
  };

  const closeMobileIfNeeded = () => {
    if (isMobile) setMobileOpen(false);
  };

  const renderNavLink = (item: SidebarNavItem, index: number) => {
    const Icon = item.icon;
    return (
      <motion.div
        key={item.to}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: index * 0.03 }}
      >
        <NavLink
          to={item.to}
          className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          onClick={closeMobileIfNeeded}
        >
          <motion.span
            className="inline-flex"
            whileHover={{ rotate: isMobile ? 0 : -6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          >
            <Icon size={22} />
          </motion.span>
          <motion.span
            className="inline-block overflow-hidden whitespace-nowrap"
            initial={false}
            animate={
              shouldShowLabels
                ? { width: 'auto', opacity: 1, x: 0 }
                : { width: 0, opacity: 0, x: collapsedLabelOffset }
            }
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {t(item.labelKey)}
          </motion.span>
        </NavLink>
      </motion.div>
    );
  };

  const renderGroup = (group: SidebarNavGroup, groupIndex: number) => (
    <section key={group.titleKey} className="sidebar-section">
      {shouldShowLabels && <p className="sidebar-section-label">{t(group.titleKey)}</p>}
      <div className="sidebar-nav-stack">
        {group.items.map((item, itemIndex) => renderNavLink(item, groupIndex * 10 + itemIndex))}
      </div>
    </section>
  );

  return (
    <>
      <AnimatePresence>
        {isMobile && !mobileOpen && (
          <motion.button
            key="sidebar-open-fab"
            className="sidebar-mobile-fab"
            onClick={() => setMobileOpen(true)}
            aria-label={t('sidebar.show')}
            title={t('sidebar.show')}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 6 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            whileHover={{ y: -2, scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
          >
            <Menu size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMobile && mobileOpen && (
          <motion.button
            key="sidebar-backdrop"
            type="button"
            className="sidebar-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-label={t('sidebar.hide')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={`sidebar ${!isMobile && collapsed ? 'sidebar-collapsed' : ''} ${isMobile && !mobileOpen ? 'pointer-events-none' : ''}`}
        initial={false}
        animate={
          isMobile
            ? { x: mobileOpen ? 0 : mobileHiddenX, opacity: mobileOpen ? 1 : 0.98 }
            : { x: 0, width: collapsed ? 96 : 304, opacity: 1 }
        }
        transition={
          isMobile
            ? { type: 'spring', stiffness: 340, damping: 32, mass: 0.85 }
            : { type: 'spring', stiffness: 280, damping: 26, mass: 0.9 }
        }
      >
        <motion.button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={
            isMobile
              ? mobileOpen
                ? t('sidebar.hide')
                : t('sidebar.show')
              : collapsed
              ? t('sidebar.expand')
              : t('sidebar.collapse')
          }
          title={
            isMobile
              ? mobileOpen
                ? t('sidebar.hide')
                : t('sidebar.show')
              : collapsed
              ? t('sidebar.expand')
              : t('sidebar.collapse')
          }
          whileTap={{ scale: 0.92 }}
          whileHover={{ rotate: isMobile ? 0 : -8 }}
        >
          {isMobile ? <X size={16} /> : collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </motion.button>

        <motion.div className="sidebar-brand-shell" initial={false} animate={{ opacity: 1, y: 0 }}>
          <BrandBadge
            compact={!shouldShowLabels}
            className={`sidebar-brand ${shouldShowLabels ? '' : 'sidebar-brand-collapsed'}`}
            showTagline={shouldShowLabels}
          />
        </motion.div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map(renderGroup)}
        </nav>

        <div className="sidebar-footer">
          {FOOTER_LINKS.map((item, index) => renderNavLink(item, NAV_GROUPS.length * 10 + index))}
        </div>
      </motion.aside>
    </>
  );
};
