// ── Formatting ───────────────────────────────────────────────────
export const fmtEur = (n, d=0) => `€${Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d})}`;
export const fmtUsd = (n, d=2) => `$${Number(n||0).toFixed(d)}`;
export const fmtPct = (n, d=1) => `${Number(n||0).toFixed(d)}%`;
export const fmtK   = (n) => Math.abs(n)>=1000 ? `€${(n/1000).toFixed(1)}k` : fmtEur(n);
export const clamp  = (v,min,max) => Math.max(min,Math.min(max,v));

// ── Dates ────────────────────────────────────────────────────────
export const today    = () => new Date().toISOString().slice(0,10);
export const monthKey = (d) => (d||today()).slice(0,7);
export const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d+'T00:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'});
};
export const monthLabel = (k) => {
  const [y,m] = k.split('-');
  const months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  return `${months[parseInt(m)-1]} ${y}`;
};
export const currentYear = () => new Date().getFullYear().toString();

// ── File hashing ─────────────────────────────────────────────────
export async function hashFile(file) {
  const buf  = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ── Encrypted local storage ──────────────────────────────────────
const SALT = 'apex_v3_itgold_2026';
const KEY  = 'apex_v3';
function xor(str, key) { return str.split('').map((c,i)=>String.fromCharCode(c.charCodeAt(0)^key.charCodeAt(i%key.length))).join(''); }
export function saveState(s) { try { localStorage.setItem(KEY, btoa(xor(JSON.stringify(s), SALT))); } catch {} }
export function loadState() { try { const r=localStorage.getItem(KEY); return r?JSON.parse(xor(atob(r),SALT)):null; } catch { return null; } }

// ── UID ──────────────────────────────────────────────────────────
export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

// ── Trade stats ──────────────────────────────────────────────────
export function calcTradeStats(trades) {
  if (!trades.length) return {total:0,wins:0,losses:0,winRate:0,avgWin:0,avgLoss:0,expectancy:0,totalPnl:0,maxWin:0,maxLoss:0,drawdown:0,bestPair:'—',worstPair:'—'};
  const wins   = trades.filter(t=>t.pnl>0);
  const losses = trades.filter(t=>t.pnl<=0);
  const totalPnl   = trades.reduce((s,t)=>s+t.pnl,0);
  const avgWin     = wins.length   ? wins.reduce((s,t)=>s+t.pnl,0)/wins.length : 0;
  const avgLoss    = losses.length ? Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length) : 0;
  const winRate    = (wins.length/trades.length)*100;
  const expectancy = (winRate/100)*avgWin - ((100-winRate)/100)*avgLoss;
  const maxWin     = wins.length   ? Math.max(...wins.map(t=>t.pnl))   : 0;
  const maxLoss    = losses.length ? Math.min(...losses.map(t=>t.pnl)) : 0;
  // Max drawdown
  let peak=0, eq=0, maxDD=0;
  [...trades].reverse().forEach(t => { eq+=t.pnl; if(eq>peak)peak=eq; const dd=peak>0?((peak-eq)/peak)*100:0; if(dd>maxDD)maxDD=dd; });
  // Best/worst pair
  const pairPnl = {};
  trades.forEach(t => { pairPnl[t.pair]=(pairPnl[t.pair]||0)+t.pnl; });
  const pairs = Object.entries(pairPnl);
  const bestPair  = pairs.length ? pairs.sort((a,b)=>b[1]-a[1])[0][0] : '—';
  const worstPair = pairs.length ? pairs.sort((a,b)=>a[1]-b[1])[0][0] : '—';
  return {total:trades.length,wins:wins.length,losses:losses.length,winRate,avgWin,avgLoss,expectancy,totalPnl,maxWin,maxLoss,drawdown:maxDD,bestPair,worstPair};
}

// ── Biz stats ─────────────────────────────────────────────────────
export function calcBizStats(bizTx) {
  const rev = bizTx.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
  const exp = bizTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const net = rev-exp;
  const margin = rev>0?(net/rev)*100:0;
  const months = {};
  bizTx.forEach(t => {
    const k=monthKey(t.date);
    if(!months[k]) months[k]={rev:0,exp:0};
    if(t.type==='revenue') months[k].rev+=t.amount; else months[k].exp+=t.amount;
  });
  const avgMonthlyExp = Object.values(months).reduce((s,m)=>s+m.exp,0)/Math.max(Object.keys(months).length,1);
  const runway = avgMonthlyExp>0?net/avgMonthlyExp:Infinity;
  return {rev,exp,net,margin,months,avgMonthlyExp,runway};
}

// ── Tax stats ─────────────────────────────────────────────────────
export function calcTaxStats(payslips) {
  const ytd    = payslips.filter(p=>(p.date||'').startsWith(currentYear()));
  const ytdTax = ytd.reduce((s,p)=>s+(p.incomeTax||0)+(p.socialSec||0),0);
  const allTax = payslips.reduce((s,p)=>s+(p.incomeTax||0)+(p.socialSec||0),0);
  const allGross = payslips.reduce((s,p)=>s+(p.gross||0),0);
  const months = {};
  payslips.forEach(p => {
    const k=monthKey(p.date);
    if(!months[k]) months[k]={incomeTax:0,socialSec:0,total:0};
    months[k].incomeTax+=p.incomeTax||0; months[k].socialSec+=p.socialSec||0;
    months[k].total+=(p.incomeTax||0)+(p.socialSec||0);
  });
  return {ytdTax,allTax,allGross,burden:allGross>0?(allTax/allGross)*100:0,months};
}

// ── Health score ─────────────────────────────────────────────────
export function calcHealthScore({salary,allocs,trades,bizTx}) {
  let score=0;
  const savPct  = allocs.find(a=>a.name.toLowerCase().includes('sav'))?.pct||0;
  const emgPct  = allocs.find(a=>a.name.toLowerCase().includes('emerg'))?.pct||0;
  const total   = allocs.reduce((s,a)=>s+a.pct,0);
  const ts      = calcTradeStats(trades);
  const bs      = calcBizStats(bizTx);
  if(savPct>=20)score+=25; else if(savPct>=10)score+=12;
  if(total===100)score+=20; else if(total>=95)score+=8;
  if(emgPct>=10)score+=15; else if(emgPct>=5)score+=7;
  if(trades.length>=5){ if(ts.winRate>=55)score+=20; else if(ts.winRate>=45)score+=10; } else score+=8;
  if(bizTx.length>0){ if(bs.net>=0)score+=15; else score+=3; } else score+=8;
  if(salary>0) score+=5;
  return Math.min(100,Math.round(score));
}

// ── ATI U stats ──────────────────────────────────────────────────
export function calcWorkStats(entries, salary) {
  const totalHours = entries.filter(e=>e.type==='work').reduce((s,e)=>s+(e.hoursWorked||0),0);
  const totalDays  = entries.filter(e=>e.type==='work').length;
  const sickDays   = entries.filter(e=>e.type==='sick').length;
  const leaveDays  = entries.filter(e=>e.type==='leave').length;
  const lateDays   = entries.filter(e=>e.type==='work'&&e.lateMinutes>0).length;
  const overtime   = entries.filter(e=>e.type==='work').reduce((s,e)=>s+Math.max(0,(e.hoursWorked||0)-8),0);
  const expectedHours = totalDays*8;
  const hourlyRate = salary>0?(salary/160):0; // approx 160h/month
  const expectedPay = totalHours*hourlyRate;
  return {totalHours,totalDays,sickDays,leaveDays,lateDays,overtime,expectedHours,hourlyRate,expectedPay};
}

// ── Anomaly detection ────────────────────────────────────────────
export function detectPayslipAnomalies(current, history) {
  const flags = [];
  if(!current) return flags;
  const prev = history.filter(h=>h.id!==current.id);
  if(!prev.length) return flags;

  const avgNet = prev.reduce((s,h)=>s+h.net,0)/prev.length;
  const avgTax = prev.reduce((s,h)=>s+(h.incomeTax||0),0)/prev.length;

  // Salary drop >20%
  if(current.net < avgNet*0.8) flags.push({severity:'critical',msg:`Net salary dropped ${((1-current.net/avgNet)*100).toFixed(0)}% below average (avg: €${avgNet.toFixed(0)})`});
  // Salary spike (could be bonus — just warn)
  if(current.net > avgNet*1.5) flags.push({severity:'warn',msg:`Net salary is ${((current.net/avgNet-1)*100).toFixed(0)}% above average — verify if bonus is included`});
  // Tax jump >30%
  if(avgTax>0 && current.incomeTax > avgTax*1.3) flags.push({severity:'warn',msg:`IRPEF increased by ${((current.incomeTax/avgTax-1)*100).toFixed(0)}% vs average — check tax bracket change`});
  // Missing social security
  if(current.gross>0 && (!current.socialSec||current.socialSec<10)) flags.push({severity:'critical',msg:'Social security (INPS) deduction appears missing or very low'});
  // Math check: gross - taxes ≠ net
  if(current.gross>0) {
    const expectedNet = current.gross - (current.incomeTax||0) - (current.socialSec||0) - (current.deductions||0);
    if(Math.abs(expectedNet-current.net)>50) flags.push({severity:'critical',msg:`Tax math doesn't balance: Gross(€${current.gross}) - deductions = €${expectedNet.toFixed(0)}, but net shows €${current.net} — possible fraud`});
  }
  // Tax rate check (Italian IRPEF: 23-43%)
  if(current.gross>0&&current.incomeTax>0) {
    const rate=(current.incomeTax/current.gross)*100;
    if(rate>45) flags.push({severity:'critical',msg:`Tax rate of ${rate.toFixed(1)}% exceeds maximum Italian IRPEF bracket — investigate immediately`});
    if(rate<5)  flags.push({severity:'warn',msg:`Tax rate of ${rate.toFixed(1)}% appears unusually low — verify deductions applied correctly`});
  }
  return flags;
}

// ── CSV parser ───────────────────────────────────────────────────
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  if(lines.length<2) return [];
  const headers = lines[0].split(',').map(h=>h.trim().replace(/"/g,'').toLowerCase());
  return lines.slice(1).map(line=>{
    const vals = line.split(',').map(v=>v.trim().replace(/"/g,''));
    const obj = {};
    headers.forEach((h,i)=>{ obj[h]=vals[i]||''; });
    return obj;
  }).filter(row=>Object.values(row).some(v=>v));
}

// ── Overtime rate (Italian law) ──────────────────────────────────
export function overtimeRate(hours) {
  if(hours<=40) return 1;
  if(hours<=48) return 1.25; // 25% premium first 8h overtime
  return 1.5; // 50% premium beyond
}

// ── Payslip × attendance cross-reference ─────────────────────────
export function auditPayPeriods(workEntries, payslips) {
  const byMonth = {}
  workEntries.forEach(e => {
    const k = monthKey(e.date)
    if (!byMonth[k]) byMonth[k] = []
    byMonth[k].push(e)
  })

  return payslips.map(payslip => {
    const mk      = monthKey(payslip.date)
    const entries = byMonth[mk] || []
    const works   = entries.filter(e => e.type === 'work')
    const sicks   = entries.filter(e => e.type === 'sick')
    const leaves  = entries.filter(e => e.type === 'leave')

    const totalHours      = works.reduce((s, e) => s + (e.hoursWorked || 0), 0)
    const totalLateMin    = works.reduce((s, e) => s + (e.lateMinutes  || 0), 0)
    const overtimeHours   = Math.max(0, totalHours - 160)
    const hourlyRate      = payslip.gross > 0 ? payslip.gross / 160 : 0
    const overtimePremium = overtimeHours * hourlyRate * 0.25
    const expectedGross   = payslip.gross > 0 ? payslip.gross + overtimePremium : 0

    const flags = []
    if (!entries.length) {
      flags.push({ severity: 'warn', msg: 'No attendance data — upload C People screenshot to enable full audit' })
    } else {
      if (overtimeHours > 0 && payslip.gross > 0 && overtimePremium > 20)
        flags.push({ severity: 'critical', msg: `${overtimeHours.toFixed(1)}h overtime — €${overtimePremium.toFixed(0)} premium (25%) not reflected in payslip gross` })
      if (totalHours > 0 && totalHours < 140 && payslip.gross > 0 && payslip.gross > totalHours * hourlyRate * 1.15)
        flags.push({ severity: 'warn', msg: `Only ${totalHours.toFixed(0)}h logged vs 160h standard — verify all clock-ins are recorded` })
      if (sicks.length > 3)
        flags.push({ severity: 'info', msg: `${sicks.length} sick days — verify INPS malattia indemnity after 3-day carenza is correctly applied` })
      if (totalLateMin > 60 && hourlyRate > 0)
        flags.push({ severity: 'info', msg: `${totalLateMin} min late — verify deduction ~€${((totalLateMin / 60) * hourlyRate).toFixed(0)} is correct (not over-deducted)` })
      if (!flags.length)
        flags.push({ severity: 'ok', msg: 'No anomalies detected — hours and gross appear consistent' })
    }

    return {
      month: mk, period: payslip.period || mk, payslip,
      totalHours, workDays: works.length, sickDays: sicks.length, leaveDays: leaves.length,
      totalLateMin, overtimeHours, overtimePremium, expectedGross, hourlyRate,
      hasData: entries.length > 0, flags,
    }
  }).sort((a, b) => b.month.localeCompare(a.month))
}
