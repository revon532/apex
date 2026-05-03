import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { SectionHeader, StatBox, Card, EmptyState, ChartTip, stagger, fadeUp } from '../components/UI.jsx';
import { fmtEur, fmtPct, calcTaxStats, formatDate, monthLabel } from '../utils.js';

export default function TaxHistory() {
  const { state } = useApp();
  const { salary } = state;
  const history = salary.history;
  const stats = useMemo(() => calcTaxStats(history), [history]);

  const chartData = useMemo(() =>
    Object.entries(stats.months).sort().slice(-12).map(([k, v]) => ({
      month: monthLabel(k).slice(0, 3),
      IRPEF: parseFloat(v.incomeTax.toFixed(0)),
      INPS:  parseFloat(v.socialSec.toFixed(0)),
    }))
  , [stats]);

  function exportCSV() {
    const rows = [['Date','Period','Employer','Gross','Net','IRPEF','INPS','Other','Total Tax']];
    history.forEach(h => rows.push([h.date,h.period,h.employer,h.gross||0,h.net,h.incomeTax||0,h.socialSec||0,h.deductions||0,((h.incomeTax||0)+(h.socialSec||0))]));
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(rows.map(r => r.join(',')).join('\n'));
    a.download = 'apex_tax.csv'; a.click();
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
          { label:'YTD Tax Paid',     value:fmtEur(stats.ytdTax), color:'var(--c-loss)' },
          { label:'All-Time Tax',     value:fmtEur(stats.allTax), color:'var(--c-loss)' },
          { label:'Tax Burden',       value:fmtPct(stats.burden), color:stats.burden>40?'var(--c-loss)':'var(--c-gold)' },
          { label:'Total Net Earned', value:fmtEur(history.reduce((s,h)=>s+h.net,0)), color:'var(--c-win)' },
        ].map((s,i) => <StatBox key={s.label} {...s} delay={i*0.06}/>)}
      </motion.div>

      {chartData.length > 0 && (
        <Card>
          <div className="sec-lbl" style={{marginBottom:16}}>Monthly Tax Breakdown</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4} margin={{left:-10,right:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="month" stroke="var(--c-dim)" tick={{fontSize:10,fill:'var(--c-sec)'}}/>
              <YAxis stroke="var(--c-dim)" tick={{fontSize:10,fill:'var(--c-sec)'}} width={44}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="IRPEF" fill="var(--c-loss)"   radius={[4,4,0,0]}/>
              <Bar dataKey="INPS"  fill="var(--c-purple)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-lg" style={{justifyContent:'center',marginTop:12}}>
            {[['IRPEF','var(--c-loss)'],['INPS','var(--c-purple)']].map(([l,c]) => (
              <div key={l} className="flex gap-sm" style={{fontSize:12,color:'var(--c-sec)'}}>
                <div style={{width:10,height:10,background:c,borderRadius:3,flexShrink:0}}/>{l}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex-between" style={{marginBottom:16}}>
          <div className="sec-lbl" style={{marginBottom:0}}>Full Tax Records</div>
          <span className="badge badge-dim">{history.length} records</span>
        </div>

        <div className="record-list">
          {history.map((h, i) => {
            const totalTax = (h.incomeTax||0) + (h.socialSec||0);
            const burden   = h.gross > 0 ? (totalTax / h.gross) * 100 : 0;
            return (
              <motion.div
                key={h.id}
                initial={{opacity:0, y:12}}
                animate={{opacity:1, y:0}}
                transition={{delay: i * 0.04, duration:0.3}}
                className="record-card"
              >
                <div className="record-card-top">
                  <div>
                    <div className="record-card-title">{h.period || formatDate(h.date)}</div>
                    <div className="record-card-date">{h.employer || '—'} · {formatDate(h.date)}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="record-card-net">{fmtEur(h.net)}</div>
                    <span className={`badge badge-${burden>40?'loss':'dim'}`} style={{marginTop:4}}>
                      {fmtPct(burden,1)} tax
                    </span>
                  </div>
                </div>

                <div className="record-card-grid">
                  <div className="record-card-item">
                    <div className="record-card-item-lbl">Gross</div>
                    <div className="record-card-item-val" style={{color:'var(--c-sec)'}}>
                      {h.gross > 0 ? fmtEur(h.gross) : '—'}
                    </div>
                  </div>
                  <div className="record-card-item">
                    <div className="record-card-item-lbl">IRPEF</div>
                    <div className="record-card-item-val" style={{color:'var(--c-loss)'}}>
                      {h.incomeTax > 0 ? fmtEur(h.incomeTax) : '—'}
                    </div>
                  </div>
                  <div className="record-card-item">
                    <div className="record-card-item-lbl">INPS</div>
                    <div className="record-card-item-val" style={{color:'var(--c-purple)'}}>
                      {h.socialSec > 0 ? fmtEur(h.socialSec) : '—'}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
