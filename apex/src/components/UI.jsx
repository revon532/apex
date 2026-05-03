import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Framer variants ───────────────────────────────────────────────
export const fadeUp = { hidden:{opacity:0,y:16}, show:{opacity:1,y:0,transition:{duration:0.38,ease:[0.25,0.46,0.45,0.94]}} };
export const stagger = (d=0.07) => ({ hidden:{}, show:{transition:{staggerChildren:d}} });
export const scaleIn = { hidden:{opacity:0,scale:0.95}, show:{opacity:1,scale:1,transition:{duration:0.3,ease:[0.34,1.56,0.64,1]}} };

// ── Animated card ─────────────────────────────────────────────────
export function Card({children, style, className='', delay=0, hover=true}) {
  return (
    <motion.div
      className={`card ${className}`}
      style={style}
      initial={{opacity:0,y:14}}
      animate={{opacity:1,y:0}}
      transition={{duration:0.38,delay,ease:[0.25,0.46,0.45,0.94]}}
      whileHover={hover?{y:-2,boxShadow:'0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)'}:{}}
    >
      {children}
    </motion.div>
  );
}

// ── Animated stat box ─────────────────────────────────────────────
export function StatBox({label, value, sub, color='var(--c-text)', accent, delay=0}) {
  return (
    <motion.div
      className="stat-box"
      style={{borderTop:accent?`2px solid ${accent}`:undefined, boxShadow:accent?`0 4px 20px ${accent}18`:undefined}}
      initial={{opacity:0,y:14}}
      animate={{opacity:1,y:0}}
      transition={{duration:0.38,delay,ease:[0.25,0.46,0.45,0.94]}}
      whileHover={{y:-2,scale:1.01}}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{color}}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </motion.div>
  );
}

// ── Animated progress ─────────────────────────────────────────────
export function AnimBar({pct, color, delay=0, height=4}) {
  const [w,setW] = useState(0);
  useEffect(()=>{ const t=setTimeout(()=>setW(Math.min(100,pct||0)),100+delay); return()=>clearTimeout(t); },[pct,delay]);
  return (
    <div className="progress" style={{height}}>
      <div className="progress-fill" style={{width:`${w}%`,background:color,boxShadow:`0 0 8px ${color}44`}} />
    </div>
  );
}

// ── Health ring ───────────────────────────────────────────────────
export function HealthRing({score, size=100}) {
  const r=42, circ=2*Math.PI*r;
  const [offset,setOffset]=useState(circ);
  useEffect(()=>{ const t=setTimeout(()=>setOffset(circ-(score/100)*circ),400); return()=>clearTimeout(t); },[score,circ]);
  const col=score>=75?'var(--c-win)':score>=50?'var(--c-gold)':'var(--c-loss)';
  const label=score>=80?'Excellent':score>=65?'Good':score>=45?'Fair':'Needs Work';
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6}/>
        <circle cx={50} cy={50} r={r} fill="none" stroke={col} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{transform:'rotate(-90deg)',transformOrigin:'50% 50%',transition:'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1),stroke 0.5s',filter:`drop-shadow(0 0 6px ${col}88)`}}/>
        <text x={50} y={47} textAnchor="middle" fill={col} fontSize={17} fontWeight={800} fontFamily="Space Grotesk,sans-serif">{score}</text>
        <text x={50} y={61} textAnchor="middle" fill="var(--c-sec)" fontSize={9} fontFamily="Inter,sans-serif">/100</text>
      </svg>
      <span style={{fontSize:11,color:col,fontWeight:700}}>{label}</span>
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────
export function ChartTip({active,payload,label,prefix='€'}) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:'rgba(6,6,16,0.98)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'10px 14px',fontSize:12}}>
      {label&&<div style={{color:'var(--c-sec)',marginBottom:6,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>{label}</div>}
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||p.fill,fontWeight:700,marginBottom:2}}>
          {p.name}: {prefix}{typeof p.value==='number'?p.value.toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:2}):p.value}
        </div>
      ))}
    </div>
  );
}

// ── Dots ──────────────────────────────────────────────────────────
export function Dots() {
  return <span className="dots"><span className="dot"/><span className="dot"/><span className="dot"/></span>;
}

// ── Spinner ───────────────────────────────────────────────────────
export function Spinner({size=18}) {
  return <div className="spinner" style={{width:size,height:size}}/>;
}

// ── Section header ────────────────────────────────────────────────
export function SectionHeader({title,sub,action}) {
  return (
    <motion.div className="flex-between section-hdr" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} transition={{duration:0.3}}>
      <div>
        <h1 className="section-title">{title}</h1>
        {sub&&<p className="section-sub">{sub}</p>}
      </div>
      {action&&<div>{action}</div>}
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────
export function EmptyState({icon,title,sub,action}) {
  return (
    <div style={{textAlign:'center',padding:'48px 24px',color:'var(--c-sec)'}}>
      {icon&&<div style={{fontSize:32,marginBottom:14,opacity:0.35}}>{icon}</div>}
      <div style={{fontWeight:700,fontSize:14,color:'var(--c-text)',marginBottom:6}}>{title}</div>
      {sub&&<div style={{fontSize:12,marginBottom:20,maxWidth:300,margin:'0 auto 20px'}}>{sub}</div>}
      {action}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────
export function Alert({type='info',children,onClose}) {
  return (
    <motion.div className={`alert alert-${type}`} initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
      <span style={{flex:1}}>{children}</span>
      {onClose&&<button onClick={onClose} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>}
    </motion.div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────
export function Modal({open,onClose,title,children,width=520}) {
  useEffect(()=>{ document.body.style.overflow=open?'hidden':''; return()=>{document.body.style.overflow=''}; },[open]);
  if(!open) return null;
  return (
    <AnimatePresence>
      <motion.div onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        style={{position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <motion.div onClick={e=>e.stopPropagation()}
          initial={{opacity:0,scale:0.95,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95}}
          transition={{duration:0.25,ease:[0.34,1.56,0.64,1]}}
          style={{background:'rgba(14,14,28,0.98)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:18,padding:28,width:'100%',maxWidth:width,boxShadow:'0 24px 80px rgba(0,0,0,0.7)',maxHeight:'90vh',overflowY:'auto'}}>
          <div className="flex-between" style={{marginBottom:22}}>
            <div style={{fontFamily:'Space Grotesk,sans-serif',fontWeight:800,fontSize:16}}>{title}</div>
            <button onClick={onClose} style={{background:'none',border:'none',color:'var(--c-sec)',cursor:'pointer',fontSize:22,lineHeight:1}}>×</button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Upload zone ───────────────────────────────────────────────────
export function UploadZone({onFile,accept='*',label,sublabel,icon='↑'}) {
  const [drag,setDrag]=useState(false);
  const ref=useRef(null);
  const onDrop=e=>{ e.preventDefault(); setDrag(false); const f=e.dataTransfer.files?.[0]; if(f) onFile(f); };
  return (
    <>
      <input ref={ref} type="file" accept={accept} style={{display:'none'}} onChange={e=>e.target.files?.[0]&&onFile(e.target.files[0])}/>
      <div className={`upload-zone ${drag?'drag':''}`} onClick={()=>ref.current?.click()}
        onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}>
        <div style={{fontSize:26,color:'var(--c-gold)',opacity:0.7}}>{icon}</div>
        <div style={{fontWeight:600,fontSize:13,color:'var(--c-text)'}}>{label}</div>
        {sublabel&&<div style={{fontSize:11,color:'var(--c-sec)'}}>{sublabel}</div>}
      </div>
    </>
  );
}

// ── Anomaly flag ──────────────────────────────────────────────────
export function AnomalyFlag({severity,msg}) {
  return (
    <motion.div className={`anomaly-flag anomaly-${severity}`} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}>
      <span style={{fontSize:14,flexShrink:0}}>{severity==='critical'?'⛔':'⚠'}</span>
      <span style={{fontSize:12,lineHeight:1.6}}>{msg}</span>
    </motion.div>
  );
}
