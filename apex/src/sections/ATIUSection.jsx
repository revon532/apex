import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { Card, StatBox, SectionHeader, AnimBar, EmptyState, ChartTip, Dots, stagger, fadeUp } from '../components/UI.jsx';
import { fmtEur, fmtPct, formatDate, today, monthKey, monthLabel, calcWorkStats, auditPayPeriods, overtimeRate, uid, hashFile } from '../utils.js';

const LEAVE_TYPES = ['Annual Leave','Sick Leave','Personal Day','Public Holiday','Unpaid Leave'];
const SHIFTS = ['Morning (06:00-14:00)','Afternoon (14:00-22:00)','Night (22:00-06:00)','Full Day (08:00-17:00)'];

async function extractCPeopleScreenshot(file) {
  const reader = new FileReader();
  const base64 = await new Promise((res,rej)=>{ reader.onload=e=>res(e.target.result.split(',')[1]); reader.onerror=rej; reader.readAsDataURL(file); });
  const resp = await fetch('/anthropic/v1/messages', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      model:'claude-sonnet-4-6', max_tokens:600,
      messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:file.type,data:base64}},
        {type:'text',text:`This is a screenshot from the C People HR/time-tracking app or a work attendance record. Extract all clock-in and clock-out entries visible.
Return ONLY valid JSON array (no markdown):
[{"date":"YYYY-MM-DD","clockIn":"HH:MM","clockOut":"HH:MM","hoursWorked":8.0,"lateMinutes":0,"type":"work","notes":""}]
- type can be: "work", "sick", "leave", "holiday"
- lateMinutes: minutes late (0 if on time)
- If multiple days visible, include all entries
- If clock-out missing, estimate based on standard shift`}
      ]}]
    })
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(()=>'');
    throw new Error(`API error ${resp.status}${resp.status===401?' — invalid or missing API key':resp.status===413?' — screenshot too large, try a cropped image':''}: ${errBody.slice(0,120)}`);
  }
  const data = await resp.json();
  const txt = data.content?.map(b=>b.text||'').join('')||'[]';
  return JSON.parse(txt.replace(/```json|```/g,'').trim());
}

export default function ATIUSection() {
  const { state, addWorkEntry, removeWorkEntry } = useApp();
  const { workEntries, salary } = state;
  const sal = salary.current;

  const [tab, setTab]             = useState('overview');
  const [scanning, setScanning]   = useState(false);
  const [scanMsg, setScanMsg]     = useState(null);
  const [form, setForm]           = useState({ date:today(), type:'work', clockIn:'08:00', clockOut:'17:00', shift:'Full Day (08:00-17:00)', lateMinutes:0, notes:'' });
  const [leaveForm, setLeaveForm] = useState({ date:today(), type:'Annual Leave', days:1, notes:'' });
  const [viewMode, setViewMode]   = useState('monthly');
  const [selMonth, setSelMonth]   = useState(today().slice(0,7));

  const ws        = useMemo(() => calcWorkStats(workEntries, sal), [workEntries, sal]);
  const auditData = useMemo(() => auditPayPeriods(workEntries, salary.history), [workEntries, salary.history]);

  // Month data
  const monthData = useMemo(() => {
    const months = {};
    workEntries.forEach(e => {
      const k = monthKey(e.date);
      if(!months[k]) months[k] = {hours:0,days:0,sick:0,leave:0,late:0,overtime:0};
      if(e.type==='work') { months[k].hours+=e.hoursWorked||0; months[k].days++; months[k].overtime+=Math.max(0,(e.hoursWorked||0)-8); if(e.lateMinutes>0) months[k].late++; }
      if(e.type==='sick')   months[k].sick++;
      if(e.type==='leave')  months[k].leave++;
    });
    return months;
  }, [workEntries]);

  const chartData = useMemo(() =>
    Object.entries(monthData).sort().slice(-6).map(([k,v])=>({
      month: monthLabel(k).slice(0,3), Hours:parseFloat(v.hours.toFixed(1)), Overtime:parseFloat(v.overtime.toFixed(1))
    }))
  , [monthData]);

  const currentMonthEntries = workEntries.filter(e=>e.date?.startsWith(selMonth));
  const attendancePct = ws.totalDays > 0 ? Math.min(100, (ws.totalDays/(ws.totalDays+ws.sickDays+ws.leaveDays))*100) : 100;

  // Overtime pay calculation (Italian law)
  const monthHours = monthData[selMonth]?.hours || 0;
  const overtimeHours = Math.max(0, monthHours - 160);
  const hourlyRate = sal > 0 ? sal / 160 : 0;
  const overtimePay = overtimeHours * hourlyRate * 1.25;

  // Underpayment detection
  const underpaymentGap = ws.expectedPay - sal;
  const isUnderpaid = sal > 0 && underpaymentGap > 50;

  function calcHours(clockIn, clockOut) {
    const [ih,im] = clockIn.split(':').map(Number);
    const [oh,om] = clockOut.split(':').map(Number);
    let h = (oh*60+om) - (ih*60+im);
    if(h < 0) h += 24*60;
    return parseFloat((h/60).toFixed(2));
  }

  function logWork() {
    const hoursWorked = calcHours(form.clockIn, form.clockOut);
    addWorkEntry({ ...form, hoursWorked, lateMinutes: Number(form.lateMinutes) });
    setForm(p=>({...p, date:today(), lateMinutes:0, notes:''}));
  }

  function logLeave() {
    for(let i=0;i<leaveForm.days;i++) {
      const d = new Date(leaveForm.date+'T00:00:00');
      d.setDate(d.getDate()+i);
      addWorkEntry({ date:d.toISOString().slice(0,10), type:leaveForm.type==='Sick Leave'?'sick':'leave', clockIn:'', clockOut:'', hoursWorked:0, lateMinutes:0, notes:`${leaveForm.type}: ${leaveForm.notes}` });
    }
    setLeaveForm(p=>({...p, notes:''}));
  }

  async function handleScreenshot(file) {
    setScanning(true); setScanMsg(null);
    try {
      const entries = await extractCPeopleScreenshot(file);
      if(!entries.length) throw new Error('No entries found in screenshot.');
      entries.forEach(e => addWorkEntry({...e, id:uid()}));
      setScanMsg({type:'ok', msg:`✓ Extracted ${entries.length} entries from C People screenshot`});
    } catch(e) {
      setScanMsg({type:'err', msg:`Failed to extract: ${e.message}`});
    }
    setScanning(false);
  }

  function exportPDF() {
    const rows = workEntries.map(e=>`${e.date},${e.type},${e.clockIn||''},${e.clockOut||''},${e.hoursWorked||0},${e.lateMinutes||0},${e.notes||''}`).join('\n');
    const csv = `Date,Type,Clock In,Clock Out,Hours,Late Minutes,Notes\n${rows}`;
    const a = document.createElement('a'); a.href='data:text/csv,'+encodeURIComponent(csv); a.download='atiu_attendance.csv'; a.click();
  }

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="stack gap-lg">
      <SectionHeader title="ATI U — Work & Attendance"
        sub="Clock-ins, shifts, overtime, leave tracking and payslip fraud detection"
        action={<button className="btn btn-ghost btn-sm" onClick={exportPDF}>↓ Export CSV</button>} />

      {/* Underpayment alert */}
      {isUnderpaid && (
        <motion.div variants={fadeUp} className="alert alert-err">
          ⛔ <strong>Underpayment detected:</strong> Based on {ws.totalHours.toFixed(0)}h worked at €{hourlyRate.toFixed(2)}/h, you should earn {fmtEur(ws.expectedPay)} but salary shows {fmtEur(sal)}. Gap: {fmtEur(underpaymentGap)}. Raise with HR immediately.
        </motion.div>
      )}

      {/* KPIs */}
      <motion.div variants={fadeUp} className="grid-4">
        {[
          {label:'Total Hours Worked', value:`${ws.totalHours.toFixed(1)}h`,     color:'var(--c-text)',  accent:'var(--c-info)'},
          {label:'Overtime',           value:`${ws.overtime.toFixed(1)}h`,       color:'var(--c-gold)', accent:'var(--c-gold)',  sub:`+${fmtEur(overtimePay,0)} extra pay due`},
          {label:'Attendance Rate',    value:fmtPct(attendancePct),              color:attendancePct>=95?'var(--c-win)':'var(--c-gold)', accent:attendancePct>=95?'var(--c-win)':'var(--c-gold)'},
          {label:'Sick / Leave Days',  value:`${ws.sickDays} / ${ws.leaveDays}`,color:'var(--c-sec)',   accent:'var(--c-purple)'},
        ].map((s,i)=><StatBox key={s.label} {...s} delay={i*0.06}/>)}
      </motion.div>

      {/* Sub tabs */}
      <div className="sub-tabs">
        {['overview','log','leave','scanner','audit'].map(t=>(
          <button key={t} className={`sub-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)} style={{textTransform:'capitalize'}}>{t}</button>
        ))}
      </div>

      {/* Overview */}
      {tab==='overview' && (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="stack gap-md">
          <div className="grid-2">
            <div className="card">
              <div className="sec-lbl" style={{marginBottom:16}}>Monthly Hours</div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                    <XAxis dataKey="month" stroke="var(--c-dim)" tick={{fontSize:11,fill:'var(--c-sec)'}}/>
                    <YAxis stroke="var(--c-dim)" tick={{fontSize:10,fill:'var(--c-sec)'}}/>
                    <Tooltip content={<ChartTip prefix="" />}/>
                    <Bar dataKey="Hours"    fill="var(--c-info)" radius={[4,4,0,0]}/>
                    <Bar dataKey="Overtime" fill="var(--c-gold)" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState icon="⏱" title="No entries yet" sub="Log your work hours to see monthly breakdown."/>}
            </div>
            <div className="card">
              <div className="sec-lbl" style={{marginBottom:16}}>Pay vs Hours Check</div>
              {[
                {l:'Expected Pay (hours worked)',   v:fmtEur(ws.expectedPay),   c:'var(--c-win)'},
                {l:'Actual Salary',                 v:fmtEur(sal),              c:'var(--c-gold)'},
                {l:'Overtime Pay Due',              v:fmtEur(overtimePay),      c:'var(--c-gold)'},
                {l:'Late Days',                     v:ws.lateDays,              c:ws.lateDays>3?'var(--c-loss)':'var(--c-sec)'},
                {l:'Hourly Rate',                   v:`${fmtEur(hourlyRate,2)}/h`, c:'var(--c-text)'},
              ].map(r=>(
                <div key={r.l} className="flex-between" style={{padding:'9px 0',borderBottom:'1px solid var(--c-bdr)'}}>
                  <span style={{fontSize:12,color:'var(--c-sec)'}}>{r.l}</span>
                  <span style={{fontSize:13,fontWeight:700,color:r.c,fontFamily:'Space Grotesk,sans-serif'}}>{r.v}</span>
                </div>
              ))}
              <div style={{marginTop:14}}>
                <div style={{marginBottom:6,fontSize:11,color:'var(--c-sec)'}}>Attendance Score</div>
                <AnimBar pct={attendancePct} color={attendancePct>=95?'var(--c-win)':attendancePct>=85?'var(--c-gold)':'var(--c-loss)'} height={6}/>
                <div className="flex-between" style={{marginTop:4,fontSize:11,color:'var(--c-sec)'}}>
                  <span>{ws.totalDays} days present</span><span>{fmtPct(attendancePct,1)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Month selector + cards */}
          <div className="card">
            <div className="flex-between" style={{marginBottom:16}}>
              <div className="sec-lbl" style={{marginBottom:0}}>Attendance Log</div>
              <input className="input" type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{width:150}}/>
            </div>
            {currentMonthEntries.length > 0 ? (
              <div className="record-list">
                {[...currentMonthEntries].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>(
                  <div key={e.id} className="record-card">
                    <div className="record-card-top">
                      <div>
                        <div className="record-card-title">{formatDate(e.date)}</div>
                        <div className="record-card-date" style={{display:'flex',gap:6,alignItems:'center',marginTop:3}}>
                          <span className={`badge badge-${e.type==='work'?'accent':e.type==='sick'?'loss':'gold'}`}>{e.type}</span>
                          {e.lateMinutes>0 && <span className="badge badge-loss">{e.lateMinutes}m late</span>}
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontFamily:'var(--font-head)',fontSize:15,fontWeight:800,color:'var(--c-info)'}}>{e.hoursWorked>0?`${e.hoursWorked}h`:'—'}</div>
                          {e.hoursWorked>8 && <div style={{fontSize:10,color:'var(--c-gold)'}}>+{(e.hoursWorked-8).toFixed(1)}h OT</div>}
                        </div>
                        <button onClick={()=>removeWorkEntry(e.id)} style={{background:'none',border:'none',color:'var(--c-dim)',cursor:'pointer',fontSize:20,lineHeight:1,padding:'0 4px'}}>×</button>
                      </div>
                    </div>
                    {(e.clockIn||e.clockOut||e.notes) && (
                      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                        {e.clockIn  && <span style={{fontSize:11,color:'var(--c-sec)',background:'rgba(255,255,255,0.04)',padding:'3px 8px',borderRadius:6}}>In: <strong style={{color:'var(--c-text)'}}>{e.clockIn}</strong></span>}
                        {e.clockOut && <span style={{fontSize:11,color:'var(--c-sec)',background:'rgba(255,255,255,0.04)',padding:'3px 8px',borderRadius:6}}>Out: <strong style={{color:'var(--c-text)'}}>{e.clockOut}</strong></span>}
                        {e.notes    && <span style={{fontSize:11,color:'var(--c-sec)',fontStyle:'italic'}}>{e.notes}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="📅" title="No entries this month"/>}
          </div>
        </motion.div>
      )}

      {/* Log work */}
      {tab==='log' && (
        <motion.div variants={fadeUp} className="card">
          <div className="sec-lbl" style={{marginBottom:18}}>Log Work Day</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:14}}>
            {[
              {lbl:'Date',key:'date',type:'date'},
              {lbl:'Shift',key:'shift',type:'select',opts:SHIFTS},
              {lbl:'Clock In',key:'clockIn',type:'time'},
              {lbl:'Clock Out',key:'clockOut',type:'time'},
              {lbl:'Late (minutes)',key:'lateMinutes',type:'number'},
            ].map(f=>(
              <div key={f.key}>
                <div className="input-lbl">{f.lbl}</div>
                {f.type==='select'
                  ? <select className="select" value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>
                  : <input className="input" type={f.type} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
                }
              </div>
            ))}
          </div>
          <div style={{marginBottom:14}}>
            <div className="input-lbl">Notes</div>
            <input className="input" placeholder="Optional notes" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&logWork()}/>
          </div>
          {form.clockIn && form.clockOut && (
            <div className="alert alert-info" style={{marginBottom:14}}>
              Calculated: <strong>{calcHours(form.clockIn,form.clockOut).toFixed(2)} hours</strong>
              {calcHours(form.clockIn,form.clockOut)>8 && <span style={{marginLeft:10,color:'var(--c-gold)'}}>· {(calcHours(form.clockIn,form.clockOut)-8).toFixed(2)}h overtime (25% premium)</span>}
            </div>
          )}
          <button className="btn btn-gold" onClick={logWork}>+ Log Work Day</button>
        </motion.div>
      )}

      {/* Leave */}
      {tab==='leave' && (
        <motion.div variants={fadeUp} className="card">
          <div className="sec-lbl" style={{marginBottom:18}}>Log Leave / Sick Day</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:14}}>
            <div><div className="input-lbl">Start Date</div><input className="input" type="date" value={leaveForm.date} onChange={e=>setLeaveForm(p=>({...p,date:e.target.value}))}/></div>
            <div><div className="input-lbl">Leave Type</div>
              <select className="select" value={leaveForm.type} onChange={e=>setLeaveForm(p=>({...p,type:e.target.value}))}>
                {LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div><div className="input-lbl">Number of Days</div><input className="input" type="number" min={1} value={leaveForm.days} onChange={e=>setLeaveForm(p=>({...p,days:Number(e.target.value)}))}/></div>
          </div>
          <div style={{marginBottom:14}}>
            <div className="input-lbl">Notes</div>
            <input className="input" placeholder="Doctor note, reason…" value={leaveForm.notes} onChange={e=>setLeaveForm(p=>({...p,notes:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&logLeave()}/>
          </div>
          <button className="btn btn-gold" onClick={logLeave}>+ Log Leave</button>
        </motion.div>
      )}

      {tab==='audit' && (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="stack gap-md">
          {auditData.length === 0 ? (
            <motion.div variants={fadeUp} className="card">
              <EmptyState icon="🔍" title="No payslips to audit"
                sub="Import payslips in Salary Intelligence and log attendance in the Log tab to enable payslip vs hours comparison."/>
            </motion.div>
          ) : (
            <>
              <motion.div variants={fadeUp} className="grid-4">
                {[
                  {label:'Months Audited',  value:auditData.length, color:'var(--c-text)', accent:'var(--c-accent)'},
                  {label:'Critical Issues', value:auditData.filter(a=>a.flags.some(f=>f.severity==='critical')).length, color:'var(--c-loss)', accent:'var(--c-loss)'},
                  {label:'Unpaid Overtime', value:fmtEur(auditData.reduce((s,a)=>s+a.overtimePremium,0)), color:'var(--c-gold)', accent:'var(--c-gold)'},
                  {label:'Months No Data',  value:auditData.filter(a=>!a.hasData).length, color:'var(--c-sec)', accent:'var(--c-purple)'},
                ].map((s,i)=><StatBox key={s.label} {...s} delay={i*0.06}/>)}
              </motion.div>

              {auditData.map((a,idx)=>(
                <motion.div variants={fadeUp} key={a.month} className="card" style={{borderColor: a.flags.some(f=>f.severity==='critical')?'rgba(255,82,82,0.25)':undefined}}>

                  {/* Header */}
                  <div className="flex-between" style={{marginBottom:16}}>
                    <div>
                      <div style={{fontFamily:'var(--font-head)',fontWeight:800,fontSize:16}}>{a.period}</div>
                      <div style={{fontSize:11,color:'var(--c-sec)',marginTop:2}}>Paid: {formatDate(a.payslip.date)}</div>
                    </div>
                    <div className="flex gap-sm">
                      {a.flags.some(f=>f.severity==='critical') && <span className="badge badge-loss">⛔ Issues</span>}
                      {!a.flags.some(f=>f.severity==='critical') && a.hasData && <span className="badge badge-win">✓ Clean</span>}
                      {!a.hasData && <span className="badge badge-dim">No clock data</span>}
                    </div>
                  </div>

                  {/* Side-by-side comparison */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                    {/* Clock-in data column */}
                    <div style={{background:'rgba(79,124,246,0.06)',border:'1px solid rgba(79,124,246,0.15)',borderRadius:12,padding:'12px 14px'}}>
                      <div style={{fontSize:9,color:'var(--c-accent)',textTransform:'uppercase',letterSpacing:1.5,fontWeight:700,marginBottom:10}}>⏱ Clock-in Records</div>
                      {a.hasData ? (
                        <div className="stack gap-sm">
                          {[
                            {l:'Hours Logged', v:`${a.totalHours.toFixed(1)}h`, c:a.totalHours>=155?'var(--c-text)':a.totalHours>0?'var(--c-gold)':'var(--c-sec)'},
                            {l:'Days Worked',  v:a.workDays,                    c:'var(--c-text)'},
                            {l:'Overtime',     v:`${a.overtimeHours.toFixed(1)}h`, c:a.overtimeHours>0?'var(--c-gold)':'var(--c-sec)'},
                            {l:'Sick Days',    v:a.sickDays,                    c:a.sickDays>3?'var(--c-loss)':'var(--c-sec)'},
                            {l:'Late (total)', v:`${a.totalLateMin}min`,        c:a.totalLateMin>60?'var(--c-loss)':'var(--c-sec)'},
                          ].map(r=>(
                            <div key={r.l} className="flex-between" style={{fontSize:12}}>
                              <span style={{color:'var(--c-sec)'}}>{r.l}</span>
                              <span style={{fontWeight:700,color:r.c,fontFamily:'var(--font-head)'}}>{r.v}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{fontSize:12,color:'var(--c-dim)',textAlign:'center',padding:'12px 0'}}>No clock-in data for this month.<br/>Log hours in the Log tab.</div>
                      )}
                    </div>

                    {/* Payslip data column */}
                    <div style={{background:'rgba(6,214,160,0.05)',border:'1px solid rgba(6,214,160,0.15)',borderRadius:12,padding:'12px 14px'}}>
                      <div style={{fontSize:9,color:'var(--c-win)',textTransform:'uppercase',letterSpacing:1.5,fontWeight:700,marginBottom:10}}>📄 Payslip Data</div>
                      <div className="stack gap-sm">
                        {[
                          {l:'Gross',    v:a.payslip.gross>0?fmtEur(a.payslip.gross):'—',       c:'var(--c-text)'},
                          {l:'Net',      v:fmtEur(a.payslip.net),                                c:'var(--c-win)'},
                          {l:'IRPEF',    v:a.payslip.incomeTax>0?fmtEur(a.payslip.incomeTax):'—', c:'var(--c-loss)'},
                          {l:'INPS',     v:a.payslip.socialSec>0?fmtEur(a.payslip.socialSec):'—', c:'var(--c-purple)'},
                          {l:'Employer', v:a.payslip.employer||'—',                              c:'var(--c-sec)'},
                        ].map(r=>(
                          <div key={r.l} className="flex-between" style={{fontSize:12}}>
                            <span style={{color:'var(--c-sec)'}}>{r.l}</span>
                            <span style={{fontWeight:700,color:r.c,fontFamily:'var(--font-head)',maxWidth:100,textOverflow:'ellipsis',overflow:'hidden',whiteSpace:'nowrap'}}>{r.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Expected vs actual gross */}
                  {a.hasData && a.payslip.gross > 0 && (
                    <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--c-bdr)',borderRadius:10,padding:'10px 14px',marginBottom:12}}>
                      <div style={{fontSize:9,color:'var(--c-sec)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8}}>Gross Comparison</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,textAlign:'center'}}>
                        <div>
                          <div style={{fontSize:10,color:'var(--c-sec)',marginBottom:3}}>Hours × Rate</div>
                          <div style={{fontFamily:'var(--font-head)',fontWeight:800,fontSize:14,color:'var(--c-accent)'}}>{fmtEur(a.totalHours * a.hourlyRate)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:'var(--c-sec)',marginBottom:3}}>+ OT Premium</div>
                          <div style={{fontFamily:'var(--font-head)',fontWeight:800,fontSize:14,color:'var(--c-gold)'}}>{fmtEur(a.overtimePremium)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:'var(--c-sec)',marginBottom:3}}>Payslip Gross</div>
                          <div style={{fontFamily:'var(--font-head)',fontWeight:800,fontSize:14,color: Math.abs((a.totalHours*a.hourlyRate+a.overtimePremium)-a.payslip.gross)>50?'var(--c-loss)':'var(--c-win)'}}>{fmtEur(a.payslip.gross)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Flags */}
                  <div className="stack gap-sm">
                    {a.flags.map((f,i)=>(
                      <div key={i} style={{
                        display:'flex',alignItems:'flex-start',gap:8,padding:'9px 12px',borderRadius:9,fontSize:12,lineHeight:1.6,
                        background:f.severity==='critical'?'var(--c-loss-dim)':f.severity==='warn'?'rgba(240,180,41,0.08)':f.severity==='ok'?'var(--c-win-dim)':'var(--c-accent-dim)',
                        border:`1px solid ${f.severity==='critical'?'rgba(255,82,82,0.25)':f.severity==='warn'?'rgba(240,180,41,0.22)':f.severity==='ok'?'rgba(6,214,160,0.22)':'rgba(79,124,246,0.2)'}`,
                        color:f.severity==='critical'?'var(--c-loss)':f.severity==='warn'?'var(--c-gold)':f.severity==='ok'?'var(--c-win)':'var(--c-accent)',
                      }}>
                        <span style={{flexShrink:0,fontSize:14}}>{f.severity==='critical'?'⛔':f.severity==='warn'?'⚠️':f.severity==='ok'?'✅':'ℹ️'}</span>
                        <span>{f.msg}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </>
          )}
        </motion.div>
      )}

      {tab==='scanner' && (
        <motion.div variants={fadeUp} className="stack gap-md">
          <div className="card">
            <div className="sec-lbl" style={{marginBottom:16}}>C People Screenshot Scanner</div>
            <div className="alert alert-info" style={{marginBottom:16}}>
              ℹ Take a screenshot from the C People app showing your attendance records, upload it here, and APEX will automatically extract all clock-in/out times.
            </div>
            {scanning ? (
              <div className="flex gap-md" style={{justifyContent:'center',padding:'28px 0',color:'var(--c-sec)',fontSize:13}}>
                <div className="spinner"/> Scanning with AI… extracting your attendance data
              </div>
            ) : (
              <div>
                <input type="file" accept="image/*" id="cpInput" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&handleScreenshot(e.target.files[0])}/>
                <label htmlFor="cpInput" className="upload-zone" style={{cursor:'pointer'}}>
                  <div style={{fontSize:28,opacity:0.6}}>📱</div>
                  <div style={{fontWeight:600,fontSize:13}}>Upload C People Screenshot</div>
                  <div style={{fontSize:11,color:'var(--c-sec)'}}>PNG or JPG · AI extracts all clock-in/out entries</div>
                </label>
              </div>
            )}
            {scanMsg && (
              <div className={`alert alert-${scanMsg.type==='ok'?'ok':'err'}`} style={{marginTop:14}}>{scanMsg.msg}</div>
            )}
          </div>
          <div className="card">
            <div className="sec-lbl" style={{marginBottom:14}}>Fraud Detection Rules</div>
            {[
              {icon:'⛔',rule:'Hours worked vs salary mismatch',desc:'If total hours × hourly rate differs from net salary by more than €50, APEX flags underpayment.'},
              {icon:'⚠',rule:'Overtime not compensated',desc:'Italian law requires 25% premium for hours 40-48/week, 50% above 48h. App checks your overtime pay.'},
              {icon:'🔍',rule:'Sick leave deductions',desc:'App matches sick leave entries against payslip deductions — checks if employer deducted correctly.'},
              {icon:'📊',rule:'Shift pattern anomalies',desc:'Detects if recorded shifts differ from C People data — possible time theft or manipulation.'},
            ].map((r,i)=>(
              <div key={i} className="flex gap-md" style={{padding:'12px 0',borderBottom:'1px solid var(--c-bdr)'}}>
                <span style={{fontSize:18,flexShrink:0}}>{r.icon}</span>
                <div>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{r.rule}</div>
                  <div style={{fontSize:12,color:'var(--c-sec)',lineHeight:1.7}}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
