import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { AnimBar, UploadZone, Alert, Dots, SectionHeader, Card, StatBox, EmptyState, AnomalyFlag, stagger, fadeUp } from '../components/UI.jsx';
import { fmtEur, fmtPct, hashFile, formatDate, today, uid, detectPayslipAnomalies } from '../utils.js';

const PAL = ['#C9A227','#00D4A0','#4A90E2','#9B72D9','#FF4757','#F08B3A','#00D4FF'];

async function extractPayslip(file) {
  const reader = new FileReader();
  const base64 = await new Promise((res,rej)=>{ reader.onload=e=>res(e.target.result.split(',')[1]); reader.onerror=rej; reader.readAsDataURL(file); });
  const isPDF = file.type==='application/pdf';
  const res = await fetch('/anthropic/v1/messages', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      model:'claude-sonnet-4-20250514', max_tokens:500,
      messages:[{role:'user',content:[
        {type:isPDF?'document':'image',source:{type:'base64',media_type:file.type,data:base64}},
        {type:'text',text:`This is an Italian payslip (busta paga). Extract all financial data precisely.
Return ONLY valid JSON (no markdown):
{"net":2500,"gross":3200,"incomeTax":450,"socialSec":280,"deductions":0,"paymentDate":"2025-03-31","employer":"Company Srl","period":"March 2025"}
All numbers in EUR. 0 if not found. Empty string if text not found.`}
      ]}]
    })
  });
  const data = await res.json();
  const txt = data.content?.map(b=>b.text||'').join('')||'{}';
  return JSON.parse(txt.replace(/```json|```/g,'').trim());
}

export default function SalaryIntelligence() {
  const { state, setSalary, addPayslip, removePayslip, clearDup, setAllocs, addAlloc, updateAlloc, removeAlloc, addDailySpend } = useApp();
  const { salary, allocs } = state;
  const sal = salary.current;
  const dup = state._dup;

  const [uploading, setUploading]   = useState(false);
  const [uploadErr, setUploadErr]   = useState(null);
  const [uploadOk,  setUploadOk]    = useState(null);
  const [manualSal, setManualSal]   = useState(sal||'');
  const [newCat,    setNewCat]      = useState({name:'',pct:0,color:'#C9A227'});
  const [spendForm, setSpendForm]   = useState({amount:'',category:'Food',description:''});
  const [anomalies, setAnomalies]   = useState([]);

  const allocTotal = allocs.reduce((s,a)=>s+a.pct,0);
  const livingPct  = allocs.find(a=>a.name.toLowerCase().includes('living'))?.pct||35;
  const dailyLimit = sal*(livingPct/100)/30;
  const todayKey   = today();
  const todaySpend = state.dailySpend.filter(d=>d.date===todayKey).reduce((s,d)=>s+d.amount,0);

  async function handlePayslip(file) {
    setUploading(true); setUploadErr(null); setUploadOk(null); setAnomalies([]);
    try {
      const fileHash   = await hashFile(file);
      const extracted  = await extractPayslip(file);
      if(!extracted.net||extracted.net<=0) throw new Error('Could not detect net salary. Try a clearer image.');
      const payslip = { fileHash, fileName:file.name, net:extracted.net, gross:extracted.gross||0, incomeTax:extracted.incomeTax||0, socialSec:extracted.socialSec||0, deductions:extracted.deductions||0, date:extracted.paymentDate||todayKey, employer:extracted.employer||'', period:extracted.period||'' };
      addPayslip(payslip);
      const flags = detectPayslipAnomalies(payslip, salary.history);
      setAnomalies(flags);
      setUploadOk(extracted);
    } catch(e) { setUploadErr(e.message||'Extraction failed.'); }
    setUploading(false);
  }

  function autoBalance() {
    const n=allocs.length, base=Math.floor(100/n), rem=100-base*n;
    setAllocs(allocs.map((a,i)=>({...a,pct:base+(i<rem?1:0)})));
  }

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="stack gap-lg">
      <SectionHeader title="Salary Intelligence" sub="Payslip AI analysis, budget allocation, and daily spending"/>

      {/* Duplicate warning */}
      <AnimatePresence>
        {dup && (
          <motion.div key="dup" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <Alert type="warn" onClose={clearDup}>
              ⚠ This payslip was already imported on {formatDate(dup.importedAt)}. Duplicate prevented.
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid-2" style={{alignItems:'start'}}>
        {/* Left column */}
        <div className="stack gap-md">
          <Card className="card-gold">
            <div className="sec-lbl">Monthly Net Salary</div>
            <div className="input-prefix" style={{marginBottom:14}}>
              <span className="input-prefix-sym">€</span>
              <input className="input" type="number" placeholder="0" value={manualSal}
                onChange={e=>setManualSal(e.target.value)}
                style={{fontSize:22,fontWeight:800,color:'var(--c-gold)',letterSpacing:-0.5,border:'none',borderRadius:0,background:'transparent'}}/>
            </div>
            <button className="btn btn-gold btn-block" onClick={()=>{ setSalary(Number(manualSal)); }}>Save Salary</button>
            {sal>0 && (
              <div className="flex gap-sm" style={{marginTop:12,flexWrap:'wrap'}}>
                {[['Daily',sal/30],['Weekly',sal/4.33],['Annual',sal*12]].map(([l,v])=>(
                  <div key={l} style={{background:'rgba(201,162,39,0.08)',border:'1px solid rgba(201,162,39,0.2)',borderRadius:8,padding:'8px 14px'}}>
                    <div style={{fontSize:9,color:'var(--c-sec)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:2}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:800,color:'var(--c-gold)',fontFamily:'Space Grotesk,sans-serif'}}>{fmtEur(v,0)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="sec-lbl">AI Payslip Scanner</div>
            <UploadZone onFile={handlePayslip} accept="image/*,application/pdf"
              label={uploading?'Scanning payslip…':'Upload Italian Payslip (Busta Paga)'}
              sublabel="PDF or image · AI extracts salary, taxes, and deductions"
              icon={uploading?'⟳':'📄'}/>
            {uploading && (
              <div className="flex gap-md" style={{marginTop:14,color:'var(--c-sec)',fontSize:13}}>
                <div className="spinner"/> Reading and extracting data with AI…
              </div>
            )}
            {uploadOk && (
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className="alert alert-ok" style={{marginTop:14,flexDirection:'column',gap:8}}>
                <div style={{fontWeight:700}}>✓ Payslip imported — net {fmtEur(uploadOk.net)}</div>
                <div className="flex gap-md" style={{flexWrap:'wrap',fontSize:12}}>
                  {uploadOk.gross>0 && <span>Gross: {fmtEur(uploadOk.gross)}</span>}
                  {uploadOk.incomeTax>0 && <span>IRPEF: {fmtEur(uploadOk.incomeTax)}</span>}
                  {uploadOk.socialSec>0 && <span>INPS: {fmtEur(uploadOk.socialSec)}</span>}
                  {uploadOk.employer && <span>{uploadOk.employer}</span>}
                </div>
              </motion.div>
            )}
            {uploadErr && <div className="alert alert-err" style={{marginTop:14}}>⛔ {uploadErr}</div>}
            {/* Anomaly flags */}
            {anomalies.length>0 && (
              <div className="stack gap-sm" style={{marginTop:14}}>
                {anomalies.map((a,i)=><AnomalyFlag key={i} severity={a.severity} msg={a.msg}/>)}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex-between" style={{marginBottom:12}}>
              <div className="sec-lbl" style={{marginBottom:0}}>Daily Spending Tracker</div>
              <div style={{fontFamily:'Space Grotesk,sans-serif',fontSize:20,fontWeight:800,color:'var(--c-gold)'}}>{fmtEur(dailyLimit,0)}<span style={{fontSize:11,fontWeight:400,color:'var(--c-sec)',marginLeft:4}}>/day</span></div>
            </div>
            <AnimBar pct={dailyLimit>0?Math.min(100,(todaySpend/dailyLimit)*100):0} color={todaySpend>dailyLimit?'var(--c-loss)':'var(--c-win)'} height={6}/>
            <div className="flex-between" style={{fontSize:11,color:'var(--c-sec)',margin:'6px 0 14px'}}>
              <span>{fmtEur(todaySpend,0)} spent</span>
              <span>{fmtEur(Math.max(0,dailyLimit-todaySpend),0)} remaining</span>
            </div>
            <div className="flex gap-sm">
              <input className="input" type="number" placeholder="Amount €" value={spendForm.amount} onChange={e=>setSpendForm(p=>({...p,amount:e.target.value}))} style={{width:110}}/>
              <select className="select" value={spendForm.category} onChange={e=>setSpendForm(p=>({...p,category:e.target.value}))} style={{flex:1}}>
                {['Food','Transport','Shopping','Entertainment','Health','Other'].map(c=><option key={c}>{c}</option>)}
              </select>
              <button className="btn btn-gold" onClick={()=>{ if(!spendForm.amount) return; addDailySpend({amount:parseFloat(spendForm.amount),category:spendForm.category}); setSpendForm(p=>({...p,amount:''})); }}>+ Log</button>
            </div>
          </Card>
        </div>

        {/* Allocation editor */}
        <Card>
          <div className="flex-between" style={{marginBottom:20}}>
            <div className="sec-lbl" style={{marginBottom:0}}>Budget Allocation</div>
            <div className="flex gap-sm">
              <button className="btn btn-surface btn-sm" onClick={autoBalance}>Auto Balance</button>
              <div style={{padding:'3px 12px',borderRadius:99,fontSize:12,fontWeight:800,fontFamily:'Space Grotesk,sans-serif',background:allocTotal===100?'var(--c-win-dim)':'var(--c-loss-dim)',color:allocTotal===100?'var(--c-win)':'var(--c-loss)',border:`1px solid ${allocTotal===100?'rgba(0,212,160,0.3)':'rgba(255,71,87,0.3)'}`}}>
                {allocTotal}%
              </div>
            </div>
          </div>

          <div className="flex gap-md" style={{marginBottom:22,alignItems:'center'}}>
            <div style={{width:110,height:110,flexShrink:0}}>
              <ResponsiveContainer width="100%" height={110}>
                <PieChart>
                  <Pie data={allocs.map(a=>({...a,value:a.pct}))} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={3} dataKey="value">
                    {allocs.map((a,i)=><Cell key={i} fill={a.color||PAL[i%PAL.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v,_,p)=>[`${v}% · ${fmtEur(sal*v/100,0)}`,p.payload.name]} contentStyle={{background:'rgba(6,6,16,0.97)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{flex:1,fontSize:12,color:'var(--c-sec)',lineHeight:1.8}}>
              {allocTotal===100 ? <span style={{color:'var(--c-win)'}}>✓ Perfectly balanced</span>
                : allocTotal>100 ? <span style={{color:'var(--c-loss)'}}>⚠ {allocTotal-100}% over-allocated</span>
                : <span style={{color:'var(--c-info)'}}>ℹ {100-allocTotal}% unallocated</span>}
              <div style={{marginTop:6}}>Daily limit: <strong style={{color:'var(--c-gold)'}}>{fmtEur(dailyLimit,0)}</strong></div>
            </div>
          </div>

          <div className="scrollable" style={{maxHeight:360,display:'flex',flexDirection:'column',gap:14}}>
            {allocs.map((a,i)=>(
              <div key={a.id}>
                <div className="flex gap-sm" style={{marginBottom:7}}>
                  <input type="color" value={a.color||PAL[i%PAL.length]} onChange={e=>updateAlloc({id:a.id,color:e.target.value})} style={{width:22,height:22,border:'none',background:'none',cursor:'pointer',borderRadius:4,flexShrink:0}}/>
                  <span style={{flex:1,fontSize:12.5,fontWeight:500}}>{a.name}</span>
                  <input className="input" type="number" value={a.pct} min={0} max={100} onChange={e=>updateAlloc({id:a.id,pct:Math.max(0,Math.min(100,Number(e.target.value)))})} style={{width:55,textAlign:'center',fontWeight:800,color:'var(--c-gold)',padding:'5px 6px'}}/>
                  <span style={{fontSize:11,color:'var(--c-sec)',width:12}}>%</span>
                  <span style={{fontSize:12,fontWeight:700,color:a.color||PAL[i%PAL.length],minWidth:68,textAlign:'right',fontFamily:'Space Grotesk,sans-serif'}}>{sal>0?fmtEur(sal*a.pct/100,0):'—'}</span>
                  <button onClick={()=>removeAlloc(a.id)} style={{background:'none',border:'none',color:'var(--c-dim)',cursor:'pointer',fontSize:17,lineHeight:1,padding:'0 2px'}}>×</button>
                </div>
                <input type="range" min={0} max={100} value={a.pct} onChange={e=>updateAlloc({id:a.id,pct:Number(e.target.value)})} style={{width:'100%',accentColor:a.color||PAL[i%PAL.length],cursor:'pointer'}}/>
              </div>
            ))}
          </div>
          <hr className="divider"/>
          <div className="flex gap-sm">
            <input className="input" placeholder="New category name" value={newCat.name} onChange={e=>setNewCat(p=>({...p,name:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&newCat.name){addAlloc({name:newCat.name,pct:0,color:newCat.color});setNewCat({name:'',pct:0,color:'#C9A227'});}}}/>
            <input type="color" value={newCat.color} onChange={e=>setNewCat(p=>({...p,color:e.target.value}))} style={{width:36,border:'none',background:'none',cursor:'pointer',flexShrink:0}}/>
            <button className="btn btn-gold" onClick={()=>{if(!newCat.name)return;addAlloc({name:newCat.name,pct:0,color:newCat.color});setNewCat({name:'',pct:0,color:'#C9A227'});}}>+ Add</button>
          </div>
        </Card>
      </div>

      {/* Payslip history */}
      {salary.history.length > 0 && (
        <Card>
          <div className="flex-between" style={{marginBottom:16}}>
            <div className="sec-lbl" style={{marginBottom:0}}>Payslip History</div>
            <span className="badge badge-dim">{salary.history.length} imported</span>
          </div>
          <div className="record-list">
            {salary.history.map((h, i) => (
              <motion.div
                key={h.id}
                initial={{opacity:0, y:10}}
                animate={{opacity:1, y:0}}
                transition={{delay: i * 0.04, duration:0.3}}
                className="record-card"
              >
                <div className="record-card-top">
                  <div>
                    <div className="record-card-title">{h.period || '—'}</div>
                    <div className="record-card-date">{h.employer || '—'} · {formatDate(h.date)}</div>
                  </div>
                  <div style={{textAlign:'right',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                    <div className="record-card-net">{fmtEur(h.net)}</div>
                    <button onClick={()=>removePayslip(h.id)} className="btn btn-danger btn-sm">Remove</button>
                  </div>
                </div>
                <div className="record-card-grid">
                  <div className="record-card-item">
                    <div className="record-card-item-lbl">Gross</div>
                    <div className="record-card-item-val" style={{color:'var(--c-sec)'}}>{h.gross>0?fmtEur(h.gross):'—'}</div>
                  </div>
                  <div className="record-card-item">
                    <div className="record-card-item-lbl">IRPEF</div>
                    <div className="record-card-item-val" style={{color:'var(--c-loss)'}}>{h.incomeTax>0?fmtEur(h.incomeTax):'—'}</div>
                  </div>
                  <div className="record-card-item">
                    <div className="record-card-item-lbl">INPS</div>
                    <div className="record-card-item-val" style={{color:'var(--c-purple)'}}>{h.socialSec>0?fmtEur(h.socialSec):'—'}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
