import { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { Dots, SectionHeader, stagger, fadeUp } from '../components/UI.jsx';
import { calcTradeStats, calcBizStats, calcWorkStats, auditPayPeriods, fmtEur, fmtPct, fmtUsd } from '../utils.js';

const SUGGESTIONS = [
  'Give me a full financial health review',
  'Am I being underpaid at ATI U?',
  'Give me an institutional XAUUSD analysis right now',
  'Should I increase my trading capital?',
  'How do I legally reduce my Italian tax burden?',
  'Review my budget allocation',
  'What are my biggest financial risks?',
  'Build me a weekly gold trading plan with risk rules',
  'Analyse my business cash flow',
  'What is gold likely to do this week — technical + fundamental?',
];

function renderMD(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(201,162,39,0.12);padding:1px 5px;border-radius:4px;font-size:11.5px;color:var(--c-gold)">$1</code>')
    .replace(/^• (.+)/gm, '<div style="display:flex;gap:6px;margin-bottom:3px"><span style="color:var(--c-gold);flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/^- (.+)/gm, '<div style="display:flex;gap:6px;margin-bottom:3px"><span style="color:var(--c-gold);flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/\n/g, '<br>');
}

export default function AISecretary() {
  const { state } = useApp();
  const { salary, allocs, trades, bizTx, workEntries, deposits, withdrawals } = state;
  const sal = salary.current;

  const ts    = useMemo(() => calcTradeStats(trades), [trades]);
  const bs    = useMemo(() => calcBizStats(bizTx),    [bizTx]);
  const ws    = useMemo(() => calcWorkStats(workEntries, sal), [workEntries, sal]);
  const audit = useMemo(() => auditPayPeriods(workEntries, salary.history), [workEntries, salary.history]);

  const totalDeposited = deposits.reduce((s,d)=>s+d.amount,0);
  const totalWithdrawn = withdrawals.reduce((s,w)=>s+w.amount,0);
  const tradCap = sal * ((allocs.find(a=>a.name.toLowerCase().includes('trad'))?.pct||0)/100);
  const savPct  = allocs.find(a=>a.name.toLowerCase().includes('sav'))?.pct||0;
  const allocTotal = allocs.reduce((s,a)=>s+a.pct,0);
  const isUnderpaid = sal>0 && ws.expectedPay>sal && (ws.expectedPay-sal)>50;

  const [msgs,    setMsgs]    = useState([]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if(msgs.length===0) {
      setMsgs([{role:'assistant',content:`Benvenuto. I'm **APEX Intelligence** — your elite personal financial secretary.\n\nI have live visibility into your complete financial picture:\n\n• **Salary:** ${fmtEur(sal)}/month · Savings rate: ${savPct}%\n• **Trading:** ${trades.length} trades · ${fmtPct(ts.winRate)} win rate · P&L: ${fmtUsd(ts.totalPnl)} · Deposited: ${fmtUsd(totalDeposited)}\n• **ATI U:** ${ws.totalHours.toFixed(0)}h worked · ${ws.overtime.toFixed(1)}h overtime${isUnderpaid?' · ⚠ Possible underpayment detected':''}\n• **Business:** ${fmtEur(bs.rev)} revenue · ${fmtEur(bs.net)} net profit\n\nAsk me anything — gold analysis, trading strategy, tax planning, underpayment investigation, or a full financial review.`}]);
    }
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}); }, [msgs, loading]);

  const systemPrompt = `You are APEX Intelligence — an elite personal financial secretary and advisor for an Italian factory worker and gold trader. You are direct, precise, institutional-grade, and genuinely helpful. Reference the live data in every relevant response.

LIVE FINANCIAL DATA (use these exact numbers):
- Monthly net salary: €${sal} | Annual: €${sal*12}
- Budget allocation: ${allocs.map(a=>`${a.name} ${a.pct}% (€${(sal*a.pct/100).toFixed(0)})`).join(' | ')}
- Savings rate: ${savPct}% | Budget total: ${allocTotal}% (${allocTotal===100?'balanced':allocTotal>100?'OVER-ALLOCATED':'under-allocated'})
- Trading capital/month: €${tradCap.toFixed(0)}
- Trading: ${trades.length} trades | Win rate: ${fmtPct(ts.winRate)} | Total P&L: ${fmtUsd(ts.totalPnl)} | Expectancy: ${fmtUsd(ts.expectancy)}/trade | Max drawdown: ${fmtPct(ts.drawdown)} | Best pair: ${ts.bestPair}
- Account: Deposited ${fmtUsd(totalDeposited)} | Withdrawn ${fmtUsd(totalWithdrawn)} | Balance: ${fmtUsd(totalDeposited-totalWithdrawn+ts.totalPnl)}
- ATI U work: ${ws.totalHours.toFixed(1)}h total | ${ws.overtime.toFixed(1)}h overtime | ${ws.sickDays} sick days | ${ws.lateDays} late days | Hourly rate: €${ws.hourlyRate.toFixed(2)}/h | Expected pay: €${ws.expectedPay.toFixed(0)} vs actual €${sal}${isUnderpaid?` ← UNDERPAYMENT GAP: €${(ws.expectedPay-sal).toFixed(0)}`:''}
- Business: Revenue €${bs.rev.toFixed(2)} | Expenses €${bs.exp.toFixed(2)} | Net €${bs.net.toFixed(2)} | Margin ${fmtPct(bs.margin)} | Runway: ${isFinite(bs.runway)?bs.runway.toFixed(1)+' months':'∞'}
- Payslips imported: ${salary.history.length}
- Payroll audit: ${audit.length} months cross-referenced | ${audit.filter(a=>a.flags.some(f=>f.severity==='critical')).length} with critical issues | Total unpaid overtime detected: €${audit.reduce((s,a)=>s+a.overtimePremium,0).toFixed(0)}
${audit.filter(a=>a.hasData).map(a=>`  • ${a.period}: ${a.totalHours.toFixed(0)}h worked | ${a.overtimeHours.toFixed(1)}h OT | gross €${a.payslip.gross} vs expected €${a.expectedGross.toFixed(0)} | ${a.flags.filter(f=>f.severity==='critical'||f.severity==='warn').map(f=>f.msg).join('; ') || 'clean'}`).join('\n')}

TRADER PROFILE:
- Location: Italy | Factory worker at ATI U
- Instrument: XAUUSD | Broker: FxPro | Leverage: 1:30 | Platform: MT5
- Background: Previously invested entire salary into trading without budget structure — caused monthly cash flow crises. Now rebuilding with disciplined approach.
- Business: Early-stage Italian business

YOUR EXPERTISE — respond at institutional/professional level:
1. ITALIAN PERSONAL FINANCE: salary management, budgeting, IRPEF tax optimization, INPS, Italian labor law rights
2. XAUUSD INSTITUTIONAL ANALYSIS: smart money concepts, order blocks, liquidity sweeps, supply/demand zones, multi-timeframe confluence, volume profile, market structure, Fibonacci, session analysis (London/NY/Asian)
3. FUNDAMENTAL ANALYSIS: Fed policy impact on gold, USD strength, CPI/NFP/FOMC interpretation, real yields, geopolitical factors, DXY inverse correlation
4. ATI U WORK RIGHTS: Italian labor law, overtime pay calculation (25% premium 40-48h, 50% above 48h), underpayment investigation steps, sick leave rights
5. BUSINESS FINANCE: cash flow, profitability, Italian VAT (IVA), growth strategy for early-stage business
6. BEHAVIORAL FINANCE: prevent revenge trading, over-leverage, emotional decisions

RESPONSE STYLE:
- Direct, data-driven, institutional quality
- Reference actual numbers from the live data above
- Use **bold** for key insights
- Bullet points (• ) for action items
- For trading: always state risk management first
- For underpayment: give specific legal steps
- For technical analysis: give specific price levels, not vague descriptions
- Be honest about problems in the data — no sugarcoating`;

  async function send() {
    const text = input.trim();
    if(!text||loading) return;
    setMsgs(prev=>[...prev,{role:'user',content:text}]);
    setInput(''); setLoading(true);
    try {
      const history = msgs.map(m=>({role:m.role,content:m.content}));
      const res = await fetch('/anthropic/v1/messages',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,system:systemPrompt,messages:[...history,{role:'user',content:text}]})
      });
      const data = await res.json();
      const reply = data.content?.map(b=>b.text||'').join('')||'Unable to respond. Please try again.';
      setMsgs(prev=>[...prev,{role:'assistant',content:reply}]);
    } catch {
      setMsgs(prev=>[...prev,{role:'assistant',content:'Connection error. Check your .env API key and try again.'}]);
    }
    setLoading(false);
    setTimeout(()=>inputRef.current?.focus(),50);
  }

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="stack gap-lg">
      <SectionHeader title="AI Secretary" sub="APEX Intelligence — institutional-grade advisor with live access to all your data"/>

      {/* Context pills */}
      <motion.div variants={fadeUp} className="flex gap-sm" style={{flexWrap:'wrap'}}>
        {[
          {l:'Salary',    v:fmtEur(sal),                          c:'var(--c-gold)'},
          {l:'Win Rate',  v:fmtPct(ts.winRate),                   c:ts.winRate>=50?'var(--c-win)':'var(--c-loss)'},
          {l:'P&L',       v:fmtUsd(ts.totalPnl),                  c:ts.totalPnl>=0?'var(--c-win)':'var(--c-loss)'},
          {l:'Business',  v:fmtEur(bs.net),                       c:bs.net>=0?'var(--c-win)':'var(--c-loss)'},
          {l:'ATI U',     v:`${ws.totalHours.toFixed(0)}h worked`, c:'var(--c-info)'},
        ].map(s=>(
          <div key={s.l} style={{padding:'4px 12px',background:'rgba(255,255,255,0.04)',border:'1px solid var(--c-bdr)',borderRadius:99,display:'flex',gap:6,alignItems:'center',fontSize:12}}>
            <span style={{color:'var(--c-sec)'}}>{s.l}:</span>
            <span style={{fontWeight:700,color:s.c,fontFamily:'Space Grotesk,sans-serif'}}>{s.v}</span>
          </div>
        ))}
        <div style={{padding:'4px 12px',background:'rgba(0,212,160,0.07)',border:'1px solid rgba(0,212,160,0.2)',borderRadius:99,display:'flex',alignItems:'center',gap:6}}>
          <div className="live-dot"/><span style={{fontSize:12,color:'var(--c-sec)'}}>Live context active</span>
        </div>
        {isUnderpaid && (
          <div style={{padding:'4px 12px',background:'var(--c-loss-dim)',border:'1px solid rgba(255,71,87,0.3)',borderRadius:99,fontSize:12,color:'var(--c-loss)',fontWeight:600}}>
            ⚠ Underpayment detected at ATI U
          </div>
        )}
      </motion.div>

      {/* Chat window */}
      <motion.div variants={fadeUp} className="card" style={{padding:0,overflow:'hidden',display:'flex',flexDirection:'column',height:560}}>
        {/* Messages */}
        <div className="scrollable" style={{flex:1,padding:'22px 22px 8px'}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',marginBottom:16,gap:10,animation:'fadeUp 0.3s ease both'}}>
              {m.role==='assistant' && (
                <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,var(--c-goldL),var(--c-gold))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#060610',flexShrink:0,marginTop:2,fontFamily:'Space Grotesk,sans-serif'}}>A</div>
              )}
              <div style={{
                maxWidth:'78%',padding:'11px 15px',
                borderRadius:m.role==='user'?'14px 4px 14px 14px':'4px 14px 14px 14px',
                background:m.role==='user'?'linear-gradient(135deg,var(--c-goldL),var(--c-gold))':'rgba(20,20,40,0.9)',
                border:m.role==='assistant'?'1px solid var(--c-bdr)':'none',
                color:m.role==='user'?'#060610':'var(--c-text)',
                fontSize:13,lineHeight:1.85,
                boxShadow:m.role==='user'?'0 4px 16px rgba(201,162,39,0.25)':'none',
              }}>
                {m.role==='user'
                  ? <span style={{fontWeight:600}}>{m.content}</span>
                  : <span dangerouslySetInnerHTML={{__html:renderMD(m.content)}}/>
                }
              </div>
              {m.role==='user' && (
                <div style={{width:28,height:28,borderRadius:8,background:'rgba(20,20,40,0.9)',border:'1px solid var(--c-bdr)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--c-gold)',flexShrink:0,marginTop:2,fontWeight:700}}>U</div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
              <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,var(--c-goldL),var(--c-gold))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#060610',fontFamily:'Space Grotesk,sans-serif'}}>A</div>
              <div style={{padding:'11px 16px',background:'rgba(20,20,40,0.9)',border:'1px solid var(--c-bdr)',borderRadius:'4px 14px 14px 14px',display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:13,color:'var(--c-sec)'}}>APEX is thinking</span><Dots/>
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>

        {/* Suggestions */}
        {msgs.length<=1 && (
          <div style={{padding:'0 20px 14px',display:'flex',flexWrap:'wrap',gap:6}}>
            {SUGGESTIONS.map((s,i)=>(
              <button key={i} className="chip" onClick={()=>setInput(s)} style={{fontSize:11}}>{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{padding:'14px 18px',borderTop:'1px solid var(--c-bdr)',display:'flex',gap:10}}>
          <input ref={inputRef} className="input" value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Ask APEX anything — gold analysis, tax planning, ATI U rights, business strategy…"
            style={{fontSize:13.5,padding:'12px 16px'}}/>
          <button className="btn btn-gold btn-lg" onClick={send} disabled={loading}>Send</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
