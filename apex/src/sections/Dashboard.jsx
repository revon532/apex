import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { AnimBar, HealthRing, ChartTip, EmptyState, StatBox, Card, stagger, fadeUp } from '../components/UI.jsx';
import { fmtEur, fmtUsd, fmtPct, calcTradeStats, calcBizStats, calcHealthScore, calcWorkStats, monthLabel, today } from '../utils.js';

const PAL = ['#C9A227','#00D4A0','#4A90E2','#9B72D9','#FF4757','#F08B3A','#00D4FF'];

export default function Dashboard() {
  const { state } = useApp();
  const { salary, allocs, trades, bizTx, dailySpend, workEntries, deposits, withdrawals } = state;
  const sal = salary.current;

  const ts  = useMemo(() => calcTradeStats(trades), [trades]);
  const bs  = useMemo(() => calcBizStats(bizTx),    [bizTx]);
  const ws  = useMemo(() => calcWorkStats(workEntries, sal), [workEntries, sal]);
  const health = useMemo(() => calcHealthScore({salary:sal,allocs,trades,bizTx}), [sal,allocs,trades,bizTx]);

  const livingPct = allocs.find(a=>a.name.toLowerCase().includes('living'))?.pct || 35;
  const dailyLimit = sal * (livingPct/100) / 30;
  const todayKey   = today();
  const todaySpend = dailySpend.filter(d=>d.date===todayKey).reduce((s,d)=>s+d.amount,0);
  const dailyUsedPct = dailyLimit > 0 ? Math.min(100,(todaySpend/dailyLimit)*100) : 0;

  const totalDeposited   = deposits.reduce((s,d)=>s+d.amount,0);
  const totalWithdrawn   = withdrawals.reduce((s,w)=>s+w.amount,0);
  const allocTotal       = allocs.reduce((s,a)=>s+a.pct,0);

  const eqCurve = useMemo(() => {
    let eq=0;
    return [...trades].reverse().map((t,i)=>({n:`T${i+1}`,eq:parseFloat((eq+=t.pnl).toFixed(2))}));
  },[trades]);

  const alerts = [];
  if (allocTotal !== 100) alerts.push({t:'warn',m:`Budget allocations sum to ${allocTotal}% — go to Salary Intelligence to fix.`});
  if (ts.drawdown > 25)   alerts.push({t:'err', m:`Trading drawdown at ${fmtPct(ts.drawdown)} — reduce position sizes immediately.`});
  if (dailyUsedPct > 85)  alerts.push({t:'warn',m:`Daily spending at ${fmtPct(dailyUsedPct)} of limit (${fmtEur(todaySpend)} / ${fmtEur(dailyLimit,0)}).`});
  if (sal === 0)           alerts.push({t:'info',m:`Set your salary in Salary Intelligence to unlock full analytics.`});

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="stack gap-lg">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="stack gap-sm">
          {alerts.map((a,i) => (
            <motion.div key={i} variants={fadeUp} className={`alert alert-${a.t}`}>
              <span>{a.t==='warn'?'⚠':a.t==='err'?'⛔':'ℹ'}</span>{a.m}
            </motion.div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <motion.div variants={fadeUp} className="grid-4">
        {[
          {label:'Monthly Salary',  value:fmtEur(sal),              color:'var(--c-gold)',  accent:'var(--c-gold)',  sub:sal>0?`${fmtEur(sal*12)} /year`:'Set in Salary Intelligence'},
          {label:'Trading P&L',     value:`${ts.totalPnl>=0?'+':''}${fmtUsd(ts.totalPnl)}`, color:ts.totalPnl>=0?'var(--c-win)':'var(--c-loss)', accent:ts.totalPnl>=0?'var(--c-win)':'var(--c-loss)', sub:`${ts.total} trades · ${fmtPct(ts.winRate,0)} win rate`},
          {label:'Business Net',    value:fmtEur(bs.net),           color:bs.net>=0?'var(--c-win)':'var(--c-loss)', accent:bs.net>=0?'var(--c-win)':'var(--c-loss)', sub:`Rev ${fmtEur(bs.rev)} · Exp ${fmtEur(bs.exp)}`},
          {label:'Financial Health',value:`${health}/100`,          color:health>=65?'var(--c-win)':health>=40?'var(--c-gold)':'var(--c-loss)', accent:health>=65?'var(--c-win)':health>=40?'var(--c-gold)':'var(--c-loss)', sub:health>=80?'Excellent':health>=65?'Good':health>=45?'Fair':'Needs Work'},
        ].map((s,i) => <StatBox key={s.label} {...s} delay={i*0.06} />)}
      </motion.div>

      {/* Daily limit + Health */}
      <motion.div variants={fadeUp} className="grid-2">
        <div className="card card-gold">
          <div className="flex-between" style={{marginBottom:16}}>
            <div>
              <div className="sec-lbl">Daily Spending Limit</div>
              <div style={{fontFamily:'Space Grotesk,sans-serif',fontSize:36,fontWeight:900,color:'var(--c-gold)',letterSpacing:-1.5,lineHeight:1}}>
                {fmtEur(dailyLimit,0)}
              </div>
              <div style={{fontSize:11,color:'var(--c-sec)',marginTop:4}}>per day · from living allocation</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:10,color:'var(--c-sec)',marginBottom:2}}>Spent Today</div>
              <div style={{fontFamily:'Space Grotesk,sans-serif',fontSize:22,fontWeight:800,color:dailyUsedPct>85?'var(--c-loss)':'var(--c-text)'}}>{fmtEur(todaySpend,0)}</div>
            </div>
          </div>
          <AnimBar pct={dailyUsedPct} color={dailyUsedPct>90?'var(--c-loss)':dailyUsedPct>70?'var(--c-gold)':'var(--c-win)'} height={6} />
          <div className="flex-between" style={{marginTop:8,fontSize:11,color:'var(--c-sec)'}}>
            <span>Remaining: {fmtEur(Math.max(0,dailyLimit-todaySpend),0)}</span>
            <span>{fmtPct(dailyUsedPct,0)} used</span>
          </div>
        </div>

        <div className="card flex" style={{gap:22,alignItems:'center'}}>
          <HealthRing score={health} />
          <div style={{flex:1}}>
            <div className="sec-lbl" style={{marginBottom:12}}>Health Breakdown</div>
            {[
              {l:'Savings Rate',   v:`${allocs.find(a=>a.name.toLowerCase().includes('sav'))?.pct||0}%`,    ok:(allocs.find(a=>a.name.toLowerCase().includes('sav'))?.pct||0)>=20},
              {l:'Budget Balanced',v:allocTotal===100?'Yes':`${allocTotal}%`,                               ok:allocTotal===100},
              {l:'Win Rate',       v:trades.length?fmtPct(ts.winRate):'—',                                  ok:ts.winRate>=50},
              {l:'Business',       v:bizTx.length?(bs.net>=0?'Profitable':'Loss'):'—',                     ok:bs.net>=0},
            ].map(r => (
              <div key={r.l} className="flex-between" style={{marginBottom:8}}>
                <span style={{fontSize:12,color:'var(--c-sec)'}}>{r.l}</span>
                <span style={{fontSize:12,fontWeight:700,color:r.v==='—'?'var(--c-dim)':r.ok?'var(--c-win)':'var(--c-loss)'}}>{r.v} {r.v!=='—'&&(r.ok?'✓':'✗')}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Trading + Allocation */}
      <motion.div variants={fadeUp} className="grid-2">
        <div className="card">
          <div className="sec-lbl" style={{marginBottom:16}}>Equity Curve</div>
          {eqCurve.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={eqCurve}>
                <defs>
                  <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={ts.totalPnl>=0?'var(--c-win)':'var(--c-loss)'} stopOpacity={0.22}/>
                    <stop offset="95%" stopColor={ts.totalPnl>=0?'var(--c-win)':'var(--c-loss)'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="n" stroke="var(--c-dim)" tick={{fontSize:9,fill:'var(--c-sec)'}}/>
                <YAxis stroke="var(--c-dim)" tick={{fontSize:9,fill:'var(--c-sec)'}}/>
                <Tooltip content={<ChartTip prefix="$" />}/>
                <Area type="monotone" dataKey="eq" name="P&L" stroke={ts.totalPnl>=0?'var(--c-win)':'var(--c-loss)'} fill="url(#eqG)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState icon="📈" title="No trades yet" sub="Log trades in Trading Operations."/>}
        </div>

        <div className="card">
          <div className="sec-lbl" style={{marginBottom:16}}>Salary Allocation</div>
          {sal > 0 ? (
            <div className="flex gap-md">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={allocs.map(a=>({...a,value:a.pct}))} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={3} dataKey="value">
                    {allocs.map((a,i)=><Cell key={i} fill={a.color||PAL[i%PAL.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v,_,p)=>[`${v}% · ${fmtEur(sal*v/100,0)}`,p.payload.name]}
                    contentStyle={{background:'rgba(6,6,16,0.97)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="stack gap-sm" style={{flex:1}}>
                {allocs.map((a,i)=>(
                  <div key={a.id}>
                    <div className="flex-between" style={{marginBottom:4}}>
                      <div className="flex gap-sm">
                        <div style={{width:8,height:8,borderRadius:'50%',background:a.color||PAL[i%PAL.length],boxShadow:`0 0 6px ${a.color||PAL[i%PAL.length]}88`,flexShrink:0}}/>
                        <span style={{fontSize:11}}>{a.name}</span>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:a.color||PAL[i%PAL.length]}}>{fmtEur(sal*a.pct/100,0)}</span>
                    </div>
                    <AnimBar pct={a.pct} color={a.color||PAL[i%PAL.length]} delay={i*60}/>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyState icon="💰" title="No salary set" sub="Add salary in Salary Intelligence."/>}
        </div>
      </motion.div>

      {/* Summary row */}
      <motion.div variants={fadeUp} className="grid-3">
        {[
          {title:'Trading Summary', rows:[
            {l:'Avg Win',    v:`$${ts.avgWin.toFixed(2)}`,              c:'var(--c-win)'},
            {l:'Avg Loss',   v:`-$${ts.avgLoss.toFixed(2)}`,            c:'var(--c-loss)'},
            {l:'Expectancy', v:`$${ts.expectancy.toFixed(2)}/trade`,    c:ts.expectancy>=0?'var(--c-win)':'var(--c-loss)'},
            {l:'Max Drawdown',v:fmtPct(ts.drawdown),                   c:ts.drawdown>20?'var(--c-loss)':'var(--c-sec)'},
            {l:'Best Pair',  v:ts.bestPair,                             c:'var(--c-gold)'},
          ]},
          {title:'Business Summary', rows:[
            {l:'Revenue',    v:fmtEur(bs.rev),                          c:'var(--c-win)'},
            {l:'Expenses',   v:fmtEur(bs.exp),                          c:'var(--c-loss)'},
            {l:'Net Profit', v:fmtEur(bs.net),                          c:bs.net>=0?'var(--c-win)':'var(--c-loss)'},
            {l:'Margin',     v:fmtPct(bs.margin),                       c:bs.margin>=20?'var(--c-win)':'var(--c-gold)'},
            {l:'Runway',     v:isFinite(bs.runway)?`${bs.runway.toFixed(1)} mo`:'∞', c:'var(--c-info)'},
          ]},
          {title:'ATI U Summary', rows:[
            {l:'Hours Worked',v:`${ws.totalHours.toFixed(1)}h`,         c:'var(--c-text)'},
            {l:'Overtime',    v:`${ws.overtime.toFixed(1)}h`,           c:ws.overtime>0?'var(--c-gold)':'var(--c-sec)'},
            {l:'Sick Days',   v:ws.sickDays,                            c:ws.sickDays>3?'var(--c-loss)':'var(--c-sec)'},
            {l:'Late Days',   v:ws.lateDays,                            c:ws.lateDays>2?'var(--c-loss)':'var(--c-sec)'},
            {l:'Expected Pay',v:fmtEur(ws.expectedPay),                 c:'var(--c-win)'},
          ]},
        ].map((g,gi)=>(
          <div key={g.title} className="card card-sm" style={{marginBottom:0}}>
            <div className="sec-lbl">{g.title}</div>
            {g.rows.map(r=>(
              <div key={r.l} className="flex-between" style={{padding:'7px 0',borderBottom:'1px solid var(--c-bdr)'}}>
                <span style={{fontSize:12,color:'var(--c-sec)'}}>{r.l}</span>
                <span style={{fontSize:12,fontWeight:700,color:r.c,fontFamily:'Space Grotesk,sans-serif'}}>{r.v}</span>
              </div>
            ))}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
