import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { SectionHeader, StatBox, Card, EmptyState, ChartTip, AnimBar, stagger, fadeUp } from '../components/UI.jsx';
import { fmtEur, fmtPct, calcBizStats, formatDate, monthLabel, monthKey, today } from '../utils.js';

const PAL = ['#C9A227','#00D4A0','#4A90E2','#9B72D9','#FF4757','#F08B3A','#00D4FF'];
const BIZ_CATS = {
  revenue: ['Client Invoice','Consulting','Product Sales','Freelance','Retainer','Other Revenue'],
  expense: ['Rent','Software/SaaS','Marketing','Equipment','Travel','Taxes','Salaries','Other Expense'],
};

export default function BusinessAccounting() {
  const { state, addBizTx, removeBizTx } = useApp();
  const { bizTx } = state;

  const [form,   setForm]   = useState({ date:today(), type:'revenue', amount:'', category:'Client Invoice', description:'' });
  const [filter, setFilter] = useState('ALL');

  const stats = useMemo(() => calcBizStats(bizTx), [bizTx]);

  const monthlyChart = useMemo(() =>
    Object.entries(stats.months).sort().slice(-12).map(([k,v])=>({
      month: monthLabel(k).slice(0,3),
      Revenue:  parseFloat(v.rev.toFixed(0)),
      Expenses: parseFloat(v.exp.toFixed(0)),
      Net:      parseFloat((v.rev-v.exp).toFixed(0)),
    }))
  , [stats]);

  const expByCategory = useMemo(() => {
    const cats = {};
    bizTx.filter(t=>t.type==='expense').forEach(t=>{ cats[t.category]=(cats[t.category]||0)+t.amount; });
    return Object.entries(cats).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  }, [bizTx]);

  const filtered = useMemo(() =>
    filter==='ALL' ? [...bizTx] : bizTx.filter(t=>t.type===filter.toLowerCase())
  , [bizTx, filter]);

  function submit() {
    if(!form.amount||!form.description) return;
    addBizTx({...form, amount:parseFloat(form.amount)});
    setForm(p=>({...p, amount:'', description:''}));
  }

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="stack gap-lg">
      <SectionHeader title="Business Accounting" sub="Revenue, expenses, cash flow and profitability metrics"/>

      {/* KPIs */}
      <motion.div variants={fadeUp} className="grid-4">
        {[
          {label:'Total Revenue',  value:fmtEur(stats.rev),    color:'var(--c-win)',  accent:'var(--c-win)'},
          {label:'Total Expenses', value:fmtEur(stats.exp),    color:'var(--c-loss)', accent:'var(--c-loss)'},
          {label:'Net Profit',     value:fmtEur(stats.net),    color:stats.net>=0?'var(--c-win)':'var(--c-loss)', accent:stats.net>=0?'var(--c-win)':'var(--c-loss)'},
          {label:'Profit Margin',  value:fmtPct(stats.margin), color:stats.margin>=20?'var(--c-win)':stats.margin>=0?'var(--c-gold)':'var(--c-loss)', accent:'var(--c-gold)',
           sub:`Runway: ${isFinite(stats.runway)?stats.runway.toFixed(1)+' mo':'∞'}`},
        ].map((s,i)=><StatBox key={s.label} {...s} delay={i*0.06}/>)}
      </motion.div>

      {/* Add transaction */}
      <Card>
        <div className="sec-lbl" style={{marginBottom:14}}>Log Transaction</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:12}}>
          <div><div className="input-lbl">Date</div><input className="input" type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
          <div>
            <div className="input-lbl">Type</div>
            <select className="select" value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value,category:BIZ_CATS[e.target.value][0]}))} style={{color:form.type==='revenue'?'var(--c-win)':'var(--c-loss)'}}>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div><div className="input-lbl">Category</div>
            <select className="select" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
              {BIZ_CATS[form.type].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="input-lbl">Amount (€)</div>
            <div className="input-prefix">
              <span className="input-prefix-sym">€</span>
              <input className="input" type="number" value={form.amount} placeholder="0.00" onChange={e=>setForm(p=>({...p,amount:e.target.value}))}/>
            </div>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <div className="input-lbl">Description</div>
            <input className="input" value={form.description} placeholder="e.g. Client invoice #001, Adobe subscription…"
              onChange={e=>setForm(p=>({...p,description:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&submit()}/>
          </div>
        </div>
        <button className="btn btn-gold" onClick={submit}>+ Add Transaction</button>
      </Card>

      {/* Charts */}
      {monthlyChart.length>0 && (
        <motion.div variants={fadeUp} className="grid-2">
          <Card>
            <div className="sec-lbl" style={{marginBottom:16}}>Monthly P&L</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyChart} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="month" stroke="var(--c-dim)" tick={{fontSize:11,fill:'var(--c-sec)'}}/>
                <YAxis stroke="var(--c-dim)" tick={{fontSize:10,fill:'var(--c-sec)'}}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="Revenue"  fill="var(--c-win)"  radius={[4,4,0,0]}/>
                <Bar dataKey="Expenses" fill="var(--c-loss)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <div className="sec-lbl" style={{marginBottom:16}}>Expense Breakdown</div>
            {expByCategory.length>0 ? (
              <div className="flex gap-md">
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie data={expByCategory} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={3}>
                      {expByCategory.map((_,i)=><Cell key={i} fill={PAL[i%PAL.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v,_,p)=>[fmtEur(v),p.payload.name]} contentStyle={{background:'rgba(6,6,16,0.97)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,fontSize:12}}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="stack gap-sm" style={{flex:1}}>
                  {expByCategory.slice(0,6).map((c,i)=>(
                    <div key={c.name}>
                      <div className="flex-between" style={{marginBottom:3}}>
                        <div className="flex gap-sm"><div style={{width:7,height:7,borderRadius:'50%',background:PAL[i%PAL.length],flexShrink:0}}/><span style={{fontSize:11}}>{c.name}</span></div>
                        <span style={{fontSize:11,fontWeight:700,color:PAL[i%PAL.length]}}>{fmtEur(c.value,0)}</span>
                      </div>
                      <AnimBar pct={stats.exp>0?(c.value/stats.exp)*100:0} color={PAL[i%PAL.length]} delay={i*60}/>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyState icon="🍕" title="No expenses yet"/>}
          </Card>
        </motion.div>
      )}

      {/* Transaction table */}
      <Card style={{padding:0,overflow:'hidden'}}>
        <div className="flex-between" style={{padding:'16px 20px 12px',borderBottom:'1px solid var(--c-bdr)'}}>
          <div className="sec-lbl" style={{marginBottom:0}}>Transaction History</div>
          <div className="flex gap-sm">
            {['ALL','Revenue','Expense'].map(f=>(
              <button key={f} className={`chip ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        {filtered.length>0 ? (
          <div className="scrollable" style={{maxHeight:340}}>
            <table className="apex-table">
              <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th style={{textAlign:'right'}}>Amount</th><th></th></tr></thead>
              <tbody>
                {[...filtered].reverse().map(t=>(
                  <tr key={t.id}>
                    <td style={{color:'var(--c-sec)',fontSize:12}}>{formatDate(t.date)}</td>
                    <td><span className={`badge badge-${t.type==='revenue'?'win':'loss'}`}>{t.type}</span></td>
                    <td><span className="badge badge-dim">{t.category}</span></td>
                    <td>{t.description}</td>
                    <td style={{textAlign:'right',fontWeight:700,color:t.type==='revenue'?'var(--c-win)':'var(--c-loss)',fontFamily:'Space Grotesk,sans-serif'}}>
                      {t.type==='revenue'?'+':'-'}{fmtEur(t.amount)}
                    </td>
                    <td><button onClick={()=>removeBizTx(t.id)} style={{background:'none',border:'none',color:'var(--c-dim)',cursor:'pointer',fontSize:17}}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="🏢" title="No transactions yet" sub="Log your first revenue or expense above."/>}
      </Card>
    </motion.div>
  );
}
