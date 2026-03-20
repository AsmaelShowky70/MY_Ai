import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, MessageSquareText, Film, FileSpreadsheet, ShieldCheck, KeyRound } from 'lucide-react';

export default function Layout() {
  const navItems = [
    { name: 'الرئيسية', path: '/', icon: <Home size={20} /> },
    { name: 'الشات العام', path: '/chat', icon: <MessageSquareText size={20} /> },
    { name: 'استوديو الشورتس', path: '/shorts', icon: <Film size={20} /> },
    { name: 'مساعد الإكسيل', path: '/excel', icon: <FileSpreadsheet size={20} /> },
    { name: 'جودة الأغذية', path: '/quality', icon: <ShieldCheck size={20} /> },
    { name: 'الإعدادات', path: '/settings', icon: <KeyRound size={20} /> },
  ];

  return (
    <>
      {/* Sidebar */}
      <aside style={{ width: '280px', borderLeft: '1px solid var(--glass-border)', background: 'rgba(5,5,5,0.7)', backdropFilter: 'blur(20px)', padding: '24px', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        <div style={{ paddingBottom: '32px', borderBottom: '1px solid var(--glass-border)', marginBottom: '24px' }}>
          <h1 className="text-gradient" style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquareText size={28} color="#6366f1" /> مساحة الذكاء الاصطناعي
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>شاتات متخصصة + حفظ محلي</p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
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
      <main className="page-container">
        <Outlet />
      </main>
    </>
  );
}
