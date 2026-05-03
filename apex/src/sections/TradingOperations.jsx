import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { SectionHeader, StatBox, Card, EmptyState, ChartTip, Dots, stagger, fadeUp } from '../components/UI.jsx';
import { fmtEur, fmtUsd, fmtPct, calcTradeStats, parseCSV, uid, formatDate, today } from '../utils.js';

const PAIRS = ['XAUUSD','EURUSD','GBPUSD','USDJPY','XAGUSD','BTCUSD','NAS100','US30'];

async function extractTradesWithAI(text) {
  const preview = text.slice(0, 8000);
  const res = await fetch('/anthropic/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `This is an MT5/FxPro trading history export (CSV or HTML). Extract all closed trades.
Return ONLY a valid JSON array (no markdown, no explanation):
[{"date":"YYYY-MM-DD","pair":"XAUUSD","direction":"BUY","entry":2380.00,"exit":2395.00,"lots":0.10,"fees":2.50,"pnl":150.00,"note":""}]
- direction: "BUY" or "SELL" only
- pair: use the symbol/instrument column as-is
- pnl: net profit/loss in account currency (negative for losses)
- fees/commission: positive number
- If a field is missing, use 0 or ""
- Include ALL rows that look like closed trades
CSV content:
${preview}`
      }]
    })
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const txt = data.content?.map(b => b.text || '').join('') || '[]';
  const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
  return parsed.filter(t => t.entry > 0 || t.pnl !== 0);
}

export default function TradingOperations() {
  const { state, addTrade, addTradesBulk, removeTrade, addDeposit, removeDeposit, addWithdrawal, removeWithdrawal } = useApp();
  const { trades, deposits, withdrawals } = state;

  const [tab,       setTab]       = useState('journal');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [calcForm,  setCalcForm]  = useState({balance:5000,risk:1,entry:2380,sl:2370,tp:2400,pair:'XAUUSD'});
  const [calcRes,   setCalcRes]   = useState(null);
  const [nt,        setNt]        = useState({date:today(),pair:'XAUUSD',direction:'BUY',entry:'',exit:'',lots:'',fees:0,note:''});
  const [depForm,   setDepForm]   = useState({date:today(),amount:'',note:''});
  const [witForm,   setWitForm]   = useState({date:today(),amount:'',note:''});
  const [filterDir, setFilterDir] = useState('ALL');

  const stats = useMemo(() => calcTradeStats(trades), [trades]);
  const totalDeposited  = deposits.reduce((s,d)=>s+d.amount,0);
  const totalWithdrawn  = withdrawals.reduce((s,w)=>s+w.amount,0);
  const totalPnl        = stats.totalPnl;
  const accountBalance  = totalDeposited - totalWithdrawn + totalPnl;

  const eqCurve = useMemo(() => {
    let eq = totalDeposited;
    return [...trades].reverse().map((t,i)=>({n:`T${i+1}`,eq:parseFloat((eq+=t.pnl).toFixed(2)),pnl:t.pnl}));
  }, [trades, totalDeposited]);

  const filteredTrades = useMemo(() =>
    (filterDir==='ALL'?trades:trades.filter(t=>t.direction===filterDir)).sort((a,b)=>(b.date||'').localeCompare(a.date||''))
  , [trades, filterDir]);

  function calculate() {
    const {balance,risk,entry,sl,tp,pair}=calcForm;
    const b=parseFloat(balance),r=parseFloat(risk)/100,e=parseFloat(entry),s=parseFloat(sl),t=parseFloat(tp)||null;
    if(!b||!e||!s||!r) return;
    const riskAmt=b*r, dist=Math.abs(e-s);
    const pipVal = pair==='XAUUSD'?100:pair.includes('JPY')?1000:10;
    const lots=riskAmt/(dist*pipVal), margin=(pair==='XAUUSD'?(lots*100*e):lots*100000)/30;
    const reward=t?Math.abs(t-e)*lots*pipVal:null, rr=reward?reward/riskAmt:null;
    setCalcRes({riskAmt:riskAmt.toFixed(2),lots:lots.toFixed(3),margin:margin.toFixed(2),dist:dist.toFixed(2),reward:reward?.toFixed(2),rr:rr?.toFixed(2)});
  }

  function logTrade() {
    const e=parseFloat(nt.entry),x=parseFloat(nt.exit),l=parseFloat(nt.lots)||0.01;
    if(!e||!x) return;
    const pipVal=nt.pair==='XAUUSD'?100:nt.pair.includes('JPY')?1000:10;
    const pnl=parseFloat(((x-e)*(nt.direction==='BUY'?1:-1)*l*pipVal-(parseFloat(nt.fees)||0)).toFixed(2));
    addTrade({...nt,entry:e,exit:x,lots:l,pnl});
    setNt(p=>({...p,entry:'',exit:'',lots:'',fees:0,note:''}));
  }

  async function handleCSV(file) {
    setImporting(true); setImportMsg(null);
    try {
      const text = await file.text();

      // 1 — try local column mapping first
      const rows = parseCSV(text);
      let mapped = rows.map(r => {
        const entry = parseFloat(r.entry||r['open price']||r['price open']||r.open||0);
        const exit  = parseFloat(r.exit||r['close price']||r['price close']||r.close||0);
        const lots  = parseFloat(r.lots||r.volume||r.quantity||r.size||0.01);
        const pnl   = parseFloat(r.pnl||r.profit||r['net p&l']||r['p/l']||r.pl||0)||parseFloat(((exit-entry)*(r.direction?.toUpperCase()==='SELL'?-1:1)*lots*100).toFixed(2));
        return {id:uid(),date:r.date||r['open time']?.slice(0,10)||today(),pair:r.pair||r.symbol||r.instrument||'XAUUSD',direction:(r.direction||r.type||'BUY').toUpperCase(),entry,exit,lots,fees:parseFloat(r.fees||r.commission||0)||0,pnl:isNaN(pnl)?0:pnl,note:r.note||r.comment||'',source:'csv'};
      }).filter(t => t.entry > 0);

      // 2 — if local parse found nothing, fall back to AI extraction
      if (!mapped.length) {
        setImportMsg({ok:true, msg:'⏳ Local parse found no trades — trying AI extraction…'});
        const aiTrades = await extractTradesWithAI(text);
        if (!aiTrades.length) throw new Error('No valid trades found. Ensure this is an MT5 closed-positions export.');
        mapped = aiTrades.map(t => ({
          id: uid(),
          date: t.date || today(),
          pair: t.pair || 'XAUUSD',
          direction: (t.direction || 'BUY').toUpperCase(),
          entry: parseFloat(t.entry) || 0,
          exit:  parseFloat(t.exit)  || 0,
          lots:  parseFloat(t.lots)  || 0.01,
          fees:  parseFloat(t.fees)  || 0,
          pnl:   parseFloat(t.pnl)   || 0,
          note:  t.note || '',
          source: 'ai-csv',
        }));
      }

      addTradesBulk(mapped);
      setImportMsg({ok:true, msg:`✓ Imported ${mapped.length} trades from ${file.name}`});
    } catch(e) {
      setImportMsg({ok:false, msg:e.message});
    }
    setImporting(false);
  }

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="stack gap-lg">
      <SectionHeader title="Trading Operations" sub="XAUUSD · FxPro · 1:30 leverage · journal, calculator, and account analytics"/>

      {/* Account overview */}
      <motion.div variants={fadeUp} className="grid-4">
        {[
          {label:'Account Balance',    value:fmtUsd(accountBalance),             color:accountBalance>=0?'var(--c-win)':'var(--c-loss)',  accent:accountBalance>=0?'var(--c-win)':'var(--c-loss)'},
          {label:'Total Deposited',    value:fmtUsd(totalDeposited),             color:'var(--c-info)',   accent:'var(--c-info)'},
          {label:'Total Withdrawn',    value:fmtUsd(totalWithdrawn),             color:'var(--c-gold)',   accent:'var(--c-gold)'},
          {label:'Net Trading P&L',    value:`${totalPnl>=0?'+':''}${fmtUsd(totalPnl)}`, color:totalPnl>=0?'var(--c-win)':'var(--c-loss)', accent:totalPnl>=0?'var(--c-win)':'var(--c-loss)', sub:`${stats.total} trades · ${fmtPct(stats.winRate,0)} win`},
        ].map((s,i)=><StatBox key={s.label} {...s} delay={i*0.06}/>)}
      </motion.div>

      {/* Sub tabs */}
      <div className="sub-tabs">
        {['journal','calculator','account','analytics','import'].map(t=>(
          <button key={t} className={`sub-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {/* Journal */}
      {tab==='journal' && (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="stack gap-md">
          <Card>
            <div className="sec-lbl" style={{marginBottom:14}}>Log Trade</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8,marginBottom:10}}>
              <div><div className="input-lbl">Date</div><input className="input" type="date" value={nt.date} onChange={e=>setNt(p=>({...p,date:e.target.value}))}/></div>
              <div><div className="input-lbl">Pair</div><select className="select" value={nt.pair} onChange={e=>setNt(p=>({...p,pair:e.target.value}))}>{PAIRS.map(p=><option key={p}>{p}</option>)}</select></div>
              <div><div className="input-lbl">Direction</div><select className="select" value={nt.direction} onChange={e=>setNt(p=>({...p,direction:e.target.value}))} style={{color:nt.direction==='BUY'?'var(--c-win)':'var(--c-loss)'}}><option>BUY</option><option>SELL</option></select></div>
              <div><div className="input-lbl">Entry</div><input className="input" type="number" placeholder="2380.00" value={nt.entry} onChange={e=>setNt(p=>({...p,entry:e.target.value}))}/></div>
              <div><div className="input-lbl">Exit</div><input className="input" type="number" placeholder="2395.00" value={nt.exit} onChange={e=>setNt(p=>({...p,exit:e.target.value}))}/></div>
              <div><div className="input-lbl">Lots</div><input className="input" type="number" placeholder="0.10" step="0.01" value={nt.lots} onChange={e=>setNt(p=>({...p,lots:e.target.value}))}/></div>
              <div><div className="input-lbl">Fees $</div><input className="input" type="number" placeholder="0" value={nt.fees} onChange={e=>setNt(p=>({...p,fees:e.target.value}))}/></div>
            </div>
            <div className="flex gap-sm">
              <input className="input" placeholder="Note (optional)" value={nt.note} onChange={e=>setNt(p=>({...p,note:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&logTrade()}/>
              <button className="btn btn-gold" onClick={logTrade}>+ Log Trade</button>
            </div>
          </Card>

          <div className="flex gap-sm">
            {['ALL','BUY','SELL'].map(d=>(
              <button key={d} className={`chip ${filterDir===d?'active':''}`} onClick={()=>setFilterDir(d)}>{d}</button>
            ))}
          </div>

          {filteredTrades.length>0 ? (
            <Card style={{padding:0,overflow:'hidden'}}>
              <div className="scrollable" style={{maxHeight:380}}>
                <table className="apex-table">
                  <thead><tr><th>Date</th><th>Pair</th><th>Dir</th><th>Entry</th><th>Exit</th><th>Lots</th><th>Note</th><th>P&L</th><th></th></tr></thead>
                  <tbody>
                    {filteredTrades.map(t=>(
                      <tr key={t.id}>
                        <td style={{color:'var(--c-sec)',fontSize:12}}>{formatDate(t.date)}</td>
                        <td><span className="badge badge-dim">{t.pair}</span></td>
                        <td><span className={`badge badge-${t.direction==='BUY'?'win':'loss'}`}>{t.direction}</span></td>
                        <td style={{fontFamily:'Space Grotesk,sans-serif'}}>{t.entry}</td>
                        <td style={{fontFamily:'Space Grotesk,sans-serif'}}>{t.exit}</td>
                        <td style={{color:'var(--c-sec)'}}>{t.lots}L</td>
                        <td style={{fontSize:11,color:'var(--c-sec)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.note||'—'}</td>
                        <td style={{fontWeight:700,color:t.pnl>=0?'var(--c-win)':'var(--c-loss)',fontFamily:'Space Grotesk,sans-serif'}}>{t.pnl>=0?'+':''}${t.pnl.toFixed(2)}</td>
                        <td><button onClick={()=>removeTrade(t.id)} style={{background:'none',border:'none',color:'var(--c-dim)',cursor:'pointer',fontSize:17}}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : <Card><EmptyState icon="📊" title="No trades yet" sub="Log your first XAUUSD trade above or import a CSV."/></Card>}
        </motion.div>
      )}

      {/* Calculator */}
      {tab==='calculator' && (
        <motion.div variants={fadeUp} className="grid-2" style={{alignItems:'start'}}>
          <Card>
            <div className="sec-lbl" style={{marginBottom:16}}>Position Size Calculator</div>
            <div className="alert alert-info" style={{marginBottom:16,fontSize:12}}>1:30 leverage · FxPro · Standard lots</div>
            <div className="stack gap-md" style={{gap:12}}>
              {[['pair','Instrument','select'],['balance','Account Balance ($)','number'],['risk','Risk % Per Trade','number'],['entry','Entry Price','number'],['sl','Stop Loss','number'],['tp','Take Profit (optional)','number']].map(([key,label,type])=>(
                <div key={key}>
                  <div className="input-lbl">{label}</div>
                  {type==='select'
                    ? <select className="select" value={calcForm[key]} onChange={e=>setCalcForm(p=>({...p,[key]:e.target.value}))}>{PAIRS.map(p=><option key={p}>{p}</option>)}</select>
                    : <input className="input" type="number" value={calcForm[key]} onChange={e=>setCalcForm(p=>({...p,[key]:e.target.value}))}/>
                  }
                </div>
              ))}
              <button className="btn btn-gold btn-block btn-lg" onClick={calculate}>Calculate Position</button>
            </div>
          </Card>
          <div className="stack gap-md">
            {calcRes && (
              <Card className="card-gold">
                <div className="sec-lbl" style={{marginBottom:14}}>Position Details</div>
                <div className="grid-2" style={{gap:8}}>
                  {[['Max Risk',`$${calcRes.riskAmt}`,'var(--c-loss)'],['Lot Size',`${calcRes.lots} lots`,'var(--c-gold)'],['Margin Req.',`$${calcRes.margin}`,'var(--c-info)'],['SL Distance',`$${calcRes.dist}`,'var(--c-sec)'],...(calcRes.reward?[['Potential Gain',`$${calcRes.reward}`,'var(--c-win)'],['Risk:Reward',`1:${calcRes.rr}`,Number(calcRes.rr)>=2?'var(--c-win)':'var(--c-gold)']]:[])]
                    .map(([l,v,c])=>(
                      <div key={l} style={{background:'rgba(10,10,24,0.8)',borderRadius:8,padding:'10px 12px'}}>
                        <div style={{fontSize:9,color:'var(--c-sec)',textTransform:'uppercase',letterSpacing:1.2,marginBottom:3}}>{l}</div>
                        <div style={{fontFamily:'Space Grotesk,sans-serif',fontSize:17,fontWeight:800,color:c}}>{v}</div>
                      </div>
                    ))}
                </div>
              </Card>
            )}
            <Card>
              <div className="sec-lbl" style={{marginBottom:12}}>Trading Rules</div>
              {['Never risk more than 1-2% per trade','Max 3 open positions simultaneously','Stop after 2 consecutive losses','Always set SL before entering','Avoid XAUUSD during NFP/CPI/FOMC','Review trades weekly for patterns'].map((r,i)=>(
                <div key={i} style={{padding:'8px 0',borderBottom:'1px solid var(--c-bdr)',fontSize:12,color:'var(--c-sec)'}}>{r}</div>
              ))}
            </Card>
          </div>
        </motion.div>
      )}

      {/* Account (deposits/withdrawals) */}
      {tab==='account' && (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="stack gap-md">
          <div className="grid-2">
            <Card>
              <div className="sec-lbl" style={{marginBottom:14}}>Log Deposit</div>
              <div className="flex gap-sm" style={{marginBottom:10}}>
                <div style={{flex:1}}><div className="input-lbl">Date</div><input className="input" type="date" value={depForm.date} onChange={e=>setDepForm(p=>({...p,date:e.target.value}))}/></div>
                <div style={{flex:1}}><div className="input-lbl">Amount ($)</div><input className="input" type="number" value={depForm.amount} onChange={e=>setDepForm(p=>({...p,amount:e.target.value}))}/></div>
              </div>
              <input className="input" placeholder="Note" value={depForm.note} onChange={e=>setDepForm(p=>({...p,note:e.target.value}))} style={{marginBottom:10}} onKeyDown={e=>{if(e.key==='Enter'&&depForm.amount){addDeposit({date:depForm.date,amount:parseFloat(depForm.amount),note:depForm.note});setDepForm(p=>({...p,amount:'',note:''}));}}}/>
              <button className="btn btn-gold" onClick={()=>{if(!depForm.amount)return;addDeposit({date:depForm.date,amount:parseFloat(depForm.amount),note:depForm.note});setDepForm(p=>({...p,amount:'',note:''}));}}>+ Add Deposit</button>
            </Card>
            <Card>
              <div className="sec-lbl" style={{marginBottom:14}}>Log Withdrawal</div>
              <div className="flex gap-sm" style={{marginBottom:10}}>
                <div style={{flex:1}}><div className="input-lbl">Date</div><input className="input" type="date" value={witForm.date} onChange={e=>setWitForm(p=>({...p,date:e.target.value}))}/></div>
                <div style={{flex:1}}><div className="input-lbl">Amount ($)</div><input className="input" type="number" value={witForm.amount} onChange={e=>setWitForm(p=>({...p,amount:e.target.value}))}/></div>
              </div>
              <input className="input" placeholder="Note" value={witForm.note} onChange={e=>setWitForm(p=>({...p,note:e.target.value}))} style={{marginBottom:10}} onKeyDown={e=>{if(e.key==='Enter'&&witForm.amount){addWithdrawal({date:witForm.date,amount:parseFloat(witForm.amount),note:witForm.note});setWitForm(p=>({...p,amount:'',note:''}));}}}/>
              <button className="btn btn-danger" onClick={()=>{if(!witForm.amount)return;addWithdrawal({date:witForm.date,amount:parseFloat(witForm.amount),note:witForm.note});setWitForm(p=>({...p,amount:'',note:''}));}}>- Add Withdrawal</button>
            </Card>
          </div>
          <div className="grid-2">
            <Card style={{padding:0,overflow:'hidden'}}>
              <div style={{padding:'16px 18px 10px',borderBottom:'1px solid var(--c-bdr)'}}><div className="sec-lbl" style={{marginBottom:0}}>Deposit History</div></div>
              <div className="scrollable" style={{maxHeight:260}}>
                <table className="apex-table">
                  <thead><tr><th>Date</th><th>Note</th><th style={{textAlign:'right'}}>Amount</th><th></th></tr></thead>
                  <tbody>
                    {deposits.length ? [...deposits].reverse().map(d=>(
                      <tr key={d.id}>
                        <td style={{fontSize:12,color:'var(--c-sec)'}}>{formatDate(d.date)}</td>
                        <td style={{fontSize:12,color:'var(--c-sec)'}}>{d.note||'—'}</td>
                        <td style={{textAlign:'right',fontWeight:700,color:'var(--c-win)',fontFamily:'Space Grotesk,sans-serif'}}>${d.amount.toFixed(2)}</td>
                        <td><button onClick={()=>removeDeposit(d.id)} style={{background:'none',border:'none',color:'var(--c-dim)',cursor:'pointer',fontSize:17}}>×</button></td>
                      </tr>
                    )) : <tr><td colSpan={4} style={{textAlign:'center',color:'var(--c-sec)',padding:28}}>No deposits yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card style={{padding:0,overflow:'hidden'}}>
              <div style={{padding:'16px 18px 10px',borderBottom:'1px solid var(--c-bdr)'}}><div className="sec-lbl" style={{marginBottom:0}}>Withdrawal History</div></div>
              <div className="scrollable" style={{maxHeight:260}}>
                <table className="apex-table">
                  <thead><tr><th>Date</th><th>Note</th><th style={{textAlign:'right'}}>Amount</th><th></th></tr></thead>
                  <tbody>
                    {withdrawals.length ? [...withdrawals].reverse().map(w=>(
                      <tr key={w.id}>
                        <td style={{fontSize:12,color:'var(--c-sec)'}}>{formatDate(w.date)}</td>
                        <td style={{fontSize:12,color:'var(--c-sec)'}}>{w.note||'—'}</td>
                        <td style={{textAlign:'right',fontWeight:700,color:'var(--c-loss)',fontFamily:'Space Grotesk,sans-serif'}}>-${w.amount.toFixed(2)}</td>
                        <td><button onClick={()=>removeWithdrawal(w.id)} style={{background:'none',border:'none',color:'var(--c-dim)',cursor:'pointer',fontSize:17}}>×</button></td>
                      </tr>
                    )) : <tr><td colSpan={4} style={{textAlign:'center',color:'var(--c-sec)',padding:28}}>No withdrawals yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Analytics */}
      {tab==='analytics' && (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="stack gap-md">
          <div className="grid-2">
            <Card>
              <div className="sec-lbl" style={{marginBottom:14}}>Equity Curve</div>
              {eqCurve.length>1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={eqCurve}>
                    <defs><linearGradient id="eqG2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={totalPnl>=0?'var(--c-win)':'var(--c-loss)'} stopOpacity={0.2}/><stop offset="95%" stopColor={totalPnl>=0?'var(--c-win)':'var(--c-loss)'} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                    <XAxis dataKey="n" stroke="var(--c-dim)" tick={{fontSize:9,fill:'var(--c-sec)'}}/>
                    <YAxis stroke="var(--c-dim)" tick={{fontSize:9,fill:'var(--c-sec)'}}/>
                    <Tooltip content={<ChartTip prefix="$"/>}/>
                    <Area type="monotone" dataKey="eq" name="Balance" stroke={totalPnl>=0?'var(--c-win)':'var(--c-loss)'} fill="url(#eqG2)" strokeWidth={2} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyState icon="📈" title="Log at least 2 trades to see curve"/>}
            </Card>
            <Card>
              <div className="sec-lbl" style={{marginBottom:14}}>Performance Metrics</div>
              {[['Wins',stats.wins,'var(--c-win)'],['Losses',stats.losses,'var(--c-loss)'],['Win Rate',fmtPct(stats.winRate),stats.winRate>=50?'var(--c-win)':'var(--c-loss)'],['Avg Win',`$${stats.avgWin.toFixed(2)}`,'var(--c-win)'],['Avg Loss',`-$${stats.avgLoss.toFixed(2)}`,'var(--c-loss)'],['Expectancy',`$${stats.expectancy.toFixed(2)}/trade`,stats.expectancy>=0?'var(--c-win)':'var(--c-loss)'],['Max Drawdown',fmtPct(stats.drawdown),stats.drawdown>20?'var(--c-loss)':'var(--c-sec)'],['Best Trade',`$${stats.maxWin.toFixed(2)}`,'var(--c-win)'],['Worst Trade',`-$${Math.abs(stats.maxLoss).toFixed(2)}`,'var(--c-loss)'],['Best Pair',stats.bestPair,'var(--c-gold)']]
                .map(([l,v,c])=>(
                  <div key={l} className="flex-between" style={{padding:'7px 0',borderBottom:'1px solid var(--c-bdr)'}}>
                    <span style={{fontSize:12,color:'var(--c-sec)'}}>{l}</span>
                    <span style={{fontSize:13,fontWeight:700,color:c,fontFamily:'Space Grotesk,sans-serif'}}>{v}</span>
                  </div>
                ))}
            </Card>
          </div>
        </motion.div>
      )}

      {/* Import */}
      {tab==='import' && (
        <motion.div variants={fadeUp} className="stack gap-md">
          <Card>
            <div className="sec-lbl" style={{marginBottom:14}}>Import from MT5/FxPro CSV</div>
            <div className="alert alert-info" style={{marginBottom:16}}>
              In MT5: Account History → right-click → Save as Report (CSV). Expected columns: <strong>date, pair, direction, entry, exit, lots, fees, pnl</strong>
            </div>
            {importing ? (
              <div className="flex gap-md" style={{justifyContent:'center',padding:28,color:'var(--c-sec)',fontSize:13}}>
                <div className="spinner"/> Parsing trade data…
              </div>
            ) : (
              <>
                <input type="file" accept=".csv,.txt" id="csvIn" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&handleCSV(e.target.files[0])}/>
                <label htmlFor="csvIn" className="upload-zone" style={{cursor:'pointer'}}>
                  <div style={{fontSize:28,opacity:0.6}}>📁</div>
                  <div style={{fontWeight:600,fontSize:13}}>Drop MT5 CSV or click to browse</div>
                  <div style={{fontSize:12,color:'var(--c-sec)'}}>MT5 · FxPro · cTrader export format</div>
                </label>
              </>
            )}
            {importMsg && <div className={`alert alert-${importMsg.ok?'info':'err'}`} style={{marginTop:14}}>{importMsg.msg}</div>}
          </Card>
          <Card>
            <div className="sec-lbl" style={{marginBottom:14}}>MT5 Live Sync — Architecture (Coming Soon)</div>
            {[
              {step:'1',title:'Enable MT5 WebSocket',desc:'Tools → Options → Expert Advisors → Allow automated trading and WebSocket connections on port 8080.'},
              {step:'2',title:'Install APEX Bridge EA',desc:'A custom Expert Advisor runs inside MT5 and streams account data (trades, deposits, balance) to APEX in real-time.'},
              {step:'3',title:'Connect & Authorize',desc:'APEX connects to MT5 WebSocket, authenticates with your account number + server name. No password stored.'},
              {step:'4',title:'Live Sync Active',desc:'All closed trades, open positions, deposits, and withdrawals sync automatically. Balance updates every 5 seconds.'},
            ].map(s=>(
              <div key={s.step} className="flex gap-md" style={{padding:'12px 0',borderBottom:'1px solid var(--c-bdr)'}}>
                <div style={{width:26,height:26,borderRadius:7,background:'var(--c-gold-dim)',border:'1px solid rgba(201,162,39,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'var(--c-gold)',flexShrink:0,fontFamily:'Space Grotesk,sans-serif'}}>{s.step}</div>
                <div><div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{s.title}</div><div style={{fontSize:12,color:'var(--c-sec)',lineHeight:1.7}}>{s.desc}</div></div>
              </div>
            ))}
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
