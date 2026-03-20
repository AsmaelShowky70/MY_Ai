import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, MessageSquareText, Film, FileSpreadsheet, ShieldCheck, KeyRound, Menu, X } from 'lucide-react';

export default function Layout() {
  const navItems = useMemo(() => ([
    { name: 'الرئيسية', path: '/', icon: <Home size={20} /> },
    { name: 'الشات العام', path: '/chat', icon: <MessageSquareText size={20} /> },
    { name: 'استوديو الشورتس', path: '/shorts', icon: <Film size={20} /> },
    { name: 'مساعد الإكسيل', path: '/excel', icon: <FileSpreadsheet size={20} /> },
    { name: 'جودة الأغذية', path: '/quality', icon: <ShieldCheck size={20} /> },
    { name: 'الإعدادات', path: '/settings', icon: <KeyRound size={20} /> },
  ]), []);

  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setIsMobileNavOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileNavOpen]);

  return (
    <>
      <button
        className="mobile-nav-toggle"
        onClick={() => setIsMobileNavOpen(true)}
        aria-label="فتح القائمة"
      >
        <Menu size={22} />
      </button>

      {isMobileNavOpen && (
        <div
          className="mobile-nav-overlay"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Drawer */}
      <aside className={`sidebar ${isMobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <h1 className="text-gradient" style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquareText size={28} color="#6366f1" /> مساحة الذكاء الاصطناعي
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>شاتات متخصصة + حفظ محلي</p>
          </div>

          <button className="mobile-nav-close" onClick={() => setIsMobileNavOpen(false)} aria-label="إغلاق القائمة">
            <X size={22} />
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileNavOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                color: isActive ? 'white' : 'var(--text-muted)',
                background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              })}
            >
              <span style={{ color: 'var(--primary)', opacity: 0.8 }}>{item.icon}</span>
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.6 }}>
          يعمل داخل المتصفح
          <br />
          أضف مفاتيح API من الإعدادات
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="page-container main-area">
        <Outlet />
      </main>
    </>
  );
}
