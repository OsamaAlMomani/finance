import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, PiggyBank, Target, CalendarDays, Settings, CreditCard, FileUp, ClipboardList, LogOut } from 'lucide-react';

export const Sidebar = () => {
  const linkClass = ({ isActive }: { isActive: boolean }) => 
    `flex items-center gap-3 p-3 rounded-lg transition-colors mb-2 text-lg ${
      isActive 
        ? 'bg-blue-100 text-blue-700 font-bold border-2 border-blue-200 border-dashed' 
        : 'hover:bg-gray-100 text-gray-700'
    }`;

  return (
    <div className="sidebar">
      <div className="mb-8 p-2">
        <h1 className="text-2xl font-bold font-heading heading-font">
          SketchBoard <span className="text-blue-500">Pro</span>
        </h1>
      </div>
      
      <nav className="flex-1">
        <NavLink to="/" className={linkClass}>
          <LayoutDashboard size={22} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/transactions" className={linkClass}>
          <Receipt size={22} />
          <span>Transactions</span>
        </NavLink>
        <NavLink to="/budget" className={linkClass}>
          <PiggyBank size={22} />
          <span>Budget</span>
        </NavLink>
        <NavLink to="/goals" className={linkClass}>
          <Target size={22} />
          <span>Goals</span>
        </NavLink>
        <NavLink to="/bills" className={linkClass}>
          <CalendarDays size={22} />
          <span>Bills</span>
        </NavLink>
        <NavLink to="/loans" className={linkClass}>
          <CreditCard size={22} />
          <span>Loans</span>
        </NavLink>
        <NavLink to="/plans" className={linkClass}>
          <ClipboardList size={22} />
          <span>Plans</span>
        </NavLink>
        <NavLink to="/import-export" className={linkClass}>
          <FileUp size={22} />
          <span>Import/Export</span>
        </NavLink>
      </nav>

      <div className="mt-auto">
        <NavLink to="/settings" className={linkClass}>
          <Settings size={22} />
          <span>Settings</span>
        </NavLink>
        <button
          className={`${linkClass({ isActive: false })} w-full text-left`}
          onClick={() => {
            localStorage.removeItem('authUserId');
            window.location.reload();
          }}
        >
          <LogOut size={22} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};
