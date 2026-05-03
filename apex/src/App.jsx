import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext.jsx';
import Dashboard         from './sections/Dashboard.jsx';
import SalaryIntelligence from './sections/SalaryIntelligence.jsx';
import TaxHistory        from './sections/TaxHistory.jsx';
import ATIUSection       from './sections/ATIUSection.jsx';
import TradingOperations from './sections/TradingOperations.jsx';
import BusinessAccounting from './sections/BusinessAccounting.jsx';
import AISecretary       from './sections/AISecretary.jsx';
import './App.css';

const NAV = [
  { id:'dashboard', label:'Dashboard',          icon:'⊞', group:'Overview' },
  { id:'salary',    label:'Salary Intelligence', icon:'€', group:'Finance' },
  { id:'tax',       label:'Tax History',         icon:'🧾', group:'Finance' },
  { id:'atiu',      label:'ATI U',               icon:'🏭', group:'Work' },
  { id:'trading',   label:'Trading Operations',  icon:'◈', group:'Markets' },
  { id:'business',  label:'Business Accounting', icon:'▦', group:'Business' },
  { id:'ai',        label:'AI Secretary',        icon:'✦', group:'Intelligence' },
];

const SECTIONS = { dashboard:Dashboard, salary:SalaryIntelligence, tax:TaxHistory, atiu:ATIUSection, trading:TradingOperations, business:BusinessAccounting, ai:AISecretary };
const PAGE_TRANSITIONS = { initial:{opacity:0,x:12}, animate:{opacity:1,x:0,transition:{duration:0.25,ease:[0.25,0.46,0.45,0.94]}}, exit:{opacity:0,x:-12,transition:{duration:0.18}} };

function Background() {
  return (
    <div className="apex-bg">
      <div className="apex-grid"/>
      <div className="apex-orb apex-orb-1"/>
      <div className="apex-orb apex-orb-2"/>
      <div className="apex-orb apex-orb-3"/>
    </div>
  );
}

function Sidebar({ active, setActive }) {
  const { state, reset } = useApp();
  const { salary } = state;
  const groups = [...new Set(NAV.map(n=>n.group))];
  return (
    <aside className="apex-sidebar">
      {/* Logo */}
      <div className="apex-logo">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div className="apex-logo-mark">A</div>
          <div>
            <div className="apex-logo-name gold-text">APEX</div>
            <div className="apex-logo-sub">Financial OS</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      {groups.map(group=>(
        <div key={group} className="apex-nav-section">
          <div className="apex-nav-lbl">{group}</div>
          {NAV.filter(n=>n.group===group).map(item=>(
            <motion.button key={item.id}
              className={`apex-nav-btn ${active===item.id?'active':''}`}
              onClick={()=>setActive(item.id)}
              whileHover={{x:2}} whileTap={{scale:0.98}} transition={{duration:0.12}}>
              <span className="apex-nav-icon">{item.icon}</span>
              {item.label}
            </motion.button>
          ))}
        </div>
      ))}

      {/* Footer */}
      <div className="apex-sidebar-footer">
        <div style={{fontSize:10,color:'var(--c-dim)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6}}>Storage</div>
        <div style={{fontSize:12,color:'var(--c-sec)',marginBottom:12,lineHeight:1.6}}>
          {salary.history.length} payslip{salary.history.length!==1?'s':''} · Encrypted local storage
        </div>
        <motion.button className="btn btn-danger btn-sm btn-block" onClick={reset} whileTap={{scale:0.97}}>
          Reset All Data
        </motion.button>
      </div>
    </aside>
  );
}

function Topbar({ active }) {
  const { state } = useApp();
  const { salary } = state;
  const item = NAV.find(n=>n.id===active);
  return (
    <header className="apex-topbar apex-scan">
      <div className="apex-topbar-title">{item?.icon} {item?.label}</div>
      <div className="flex gap-sm" style={{flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px',background:'rgba(0,212,160,0.07)',border:'1px solid rgba(0,212,160,0.2)',borderRadius:99}}>
          <div className="live-dot"/><span style={{fontSize:11,color:'var(--c-sec)'}}>XAUUSD · FxPro · 1:30</span>
        </div>
        <div style={{padding:'4px 14px',background:'var(--c-gold-dim)',border:'1px solid rgba(201,162,39,0.2)',borderRadius:99}}>
          <span style={{fontSize:11,color:'var(--c-sec)'}}>Net: </span>
          <span style={{fontFamily:'Space Grotesk,sans-serif',fontWeight:800,fontSize:13,color:'var(--c-gold)'}}>€{(salary.current||0).toLocaleString()}</span>
        </div>
      </div>
    </header>
  );
}

function MobileNav({ active, setActive }) {
  const items = NAV.filter(n=>['dashboard','salary','atiu','trading','ai'].includes(n.id));
  return (
    <nav className="apex-mobile-nav">
      {items.map(item=>(
        <button key={item.id} className={`apex-mobile-btn ${active===item.id?'active':''}`} onClick={()=>setActive(item.id)}>
          <span style={{fontSize:18}}>{item.icon}</span>
          <span>{item.label.split(' ')[0]}</span>
        </button>
      ))}
    </nav>
  );
}

function AppShell() {
  const [active, setActive] = useState('dashboard');
  const Section = SECTIONS[active] || Dashboard;

  return (
    <>
      <Background/>
      <div className="apex-layout">
        <Sidebar active={active} setActive={setActive}/>
        <div className="apex-main">
          <Topbar active={active}/>
          <main className="apex-content">
            <AnimatePresence mode="wait">
              <motion.div key={active} {...PAGE_TRANSITIONS}>
                <Section/>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <MobileNav active={active} setActive={setActive}/>
    </>
  );
}

export default function App() {
  return <AppProvider><AppShell/></AppProvider>;
}
