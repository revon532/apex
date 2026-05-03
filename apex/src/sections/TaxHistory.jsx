import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { SectionHeader, StatBox, Card, EmptyState, ChartTip, AnimBar, stagger, fadeUp } from '../components/UI.jsx';
import { fmtEur, fmtPct, calcTaxStats, formatDate, monthLabel } from '../utils.js';

export default function TaxHistory() {
  const { state } = useApp();
  const { salary } = state;
  const history = salary.history;
  const stats = useMemo(() => calcTaxStats(history), [history]);

  const chartData = useMemo(() =>
    Object.entries(stats.months).sort().slice(-12).map(([k,v])=>({
      month: monthLabel(k).slice(0,3), IRPEF:parseFloat(v.incomeTax.toFixed(0)), INPS:parseFloat(v.socialSec.toFixed(0))
    }))
  , [stats]);

  function exportCSV() {
    const rows=[['Date','Period','Employer','Gross','Net','IRPEF','INPS','Other','Total Tax']];
    history.forEach(h=>rows.push([h.date,h.period,h.employer,h.gross||0,h.net,h.incomeTax||0,h.socialSec||0,h.deductions||0,((h.incomeTax||0)+(h.socialSec||0))]));
    const a=document.createElement('a');a.href='data:text/csv,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n'));a.download='apex_tax.csv';a.click();
  }

  if (!history.length) return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="stack gap-lg">
      <SectionHeader title="Tax History" sub="IRPEF, INPS contributions and cumulative tax burden"/>
      <Card><EmptyState icon="🧾" title="No payslips imported yet" sub="Upload payslips in Salary Intelligence — APEX automatically logs your tax data from each payslip."/></Card>
    </motion.div>
  );

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="stack gap-lg">
      <SectionHeader title="Tax History" sub="IRPEF, INPS contributions and cumulative tax burden"
        action={<button className="btn btn-ghost btn-sm" onClick={exportCSV}>↓ Export CSV</button>}/>

      <motion.div variants={fadeUp} className="grid-4">
        {[
          {label:'YTD Tax Paid',     value:fmtEur(stats.ytdTax),  color:'var(--c-loss)', accent:'var(--c-loss)'},
          {label:'All-Time Tax',     value:fmtEur(stats.allTax),  color:'var(--c-loss)', accent:'var(--c-loss)'},
          {label:'Tax Burden',       value:fmtPct(stats.burden),  color:stats.burden>40?'var(--c-loss)':'var(--c-gold)', accent:'var(--c-gold)'},
          {label:'Total Net Earned', value:fmtEur(history.reduce((s,h)=>s+h.net,0)), color:'var(--c-win)', accent:'var(--c-win)'},
        ].map((s,i)=><StatBox key={s.label} {...s} delay={i*0.06}/>)}
      </motion.div>

      {chartData.length>0 && (
        <Card>
          <div className="sec-lbl" style={{marginBottom:16}}>Monthly Tax Breakdown</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="month" stroke="var(--c-dim)" tick={{fontSize:11,fill:'var(--c-sec)'}}/>
              <YAxis stroke="var(--c-dim)" tick={{fontSize:10,fill:'var(--c-sec)'}}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="IRPEF" fill="var(--c-loss)"   radius={[4,4,0,0]}/>
              <Bar dataKey="INPS"  fill="var(--c-purple)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-lg" style={{justifyContent:'center',marginTop:10}}>
            {[['IRPEF','var(--c-loss)'],['INPS','var(--c-purple)']].map(([l,c])=>(
              <div key={l} className="flex gap-sm" style={{fontSize:12,color:'var(--c-sec)'}}>
                <div style={{width:10,height:10,background:c,borderRadius:3}}/>{l}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="sec-lbl" style={{marginBottom:16}}>Full Tax Records</div>
        <div className="scrollable" style={{maxHeight:380}}>
          <table className="apex-table">
            <thead><tr><th>Period</th><th>Employer</th><th>Gross</th><th>IRPEF</th><th>INPS</th><th>Net Received</th><th>Tax Burden</th></tr></thead>
            <tbody>
              {history.map(h=>{
                const totalTax=(h.incomeTax||0)+(h.socialSec||0);
                const burden=h.gross>0?(totalTax/h.gross)*100:0;
                return (
                  <tr key={h.id}>
                    <td><div style={{fontWeight:600}}>{h.period||'—'}</div><div style={{fontSize:10,color:'var(--c-sec)'}}>{formatDate(h.date)}</div></td>
                    <td style={{color:'var(--c-sec)',fontSize:12}}>{h.employer||'—'}</td>
                    <td style={{color:'var(--c-sec)'}}>{h.gross>0?fmtEur(h.gross):'—'}</td>
                    <td style={{color:'var(--c-loss)',fontWeight:600}}>{h.incomeTax>0?fmtEur(h.incomeTax):'—'}</td>
                    <td style={{color:'var(--c-purple)',fontWeight:600}}>{h.socialSec>0?fmtEur(h.socialSec):'—'}</td>
                    <td style={{fontWeight:700,color:'var(--c-win)',fontFamily:'Space Grotesk,sans-serif'}}>{fmtEur(h.net)}</td>
                    <td><span className={`badge badge-${burden>40?'loss':'dim'}`}>{fmtPct(burden,1)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}
