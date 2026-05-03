import { createContext, useContext, useReducer, useEffect } from 'react';
import { saveState, loadState, uid, today } from '../utils.js';

const INIT = {
  salary: { current:0, history:[] },
  allocs: [
    {id:'1',name:'Living Expenses',pct:35,color:'#C9A227'},
    {id:'2',name:'Savings',        pct:20,color:'#00D4A0'},
    {id:'3',name:'Trading Capital',pct:20,color:'#4A90E2'},
    {id:'4',name:'Business Fund',  pct:15,color:'#9B72D9'},
    {id:'5',name:'Emergency Fund', pct:10,color:'#F08B3A'},
  ],
  trades:     [],
  bizTx:      [],
  dailySpend: [],
  workEntries:[],
  deposits:   [],
  withdrawals:[],
  recurring:  [],
  goals:      [],
  settings:   { currency:'EUR', theme:'dark', notifications:true },
  _dup: null,
};

function reducer(s, a) {
  switch(a.type) {
    case 'SET_SALARY':      return {...s, salary:{...s.salary, current:a.p}};
    case 'ADD_PAYSLIP': {
      const dup = s.salary.history.find(h=>h.fileHash===a.p.fileHash);
      if(dup) return {...s, _dup:dup};
      return {...s, salary:{current:a.p.net, history:[a.p,...s.salary.history]}, _dup:null};
    }
    case 'REMOVE_PAYSLIP':  return {...s, salary:{...s.salary, history:s.salary.history.filter(h=>h.id!==a.p)}};
    case 'CLEAR_DUP':       return {...s, _dup:null};
    case 'SET_ALLOCS':      return {...s, allocs:a.p};
    case 'ADD_ALLOC':       return {...s, allocs:[...s.allocs, a.p]};
    case 'UPDATE_ALLOC':    return {...s, allocs:s.allocs.map(x=>x.id===a.p.id?{...x,...a.p}:x)};
    case 'REMOVE_ALLOC':    return {...s, allocs:s.allocs.filter(x=>x.id!==a.p)};
    case 'ADD_TRADE':       return {...s, trades:[a.p,...s.trades]};
    case 'ADD_TRADES_BULK': return {...s, trades:[...a.p,...s.trades]};
    case 'REMOVE_TRADE':    return {...s, trades:s.trades.filter(t=>t.id!==a.p)};
    case 'ADD_BIZ_TX':      return {...s, bizTx:[a.p,...s.bizTx]};
    case 'REMOVE_BIZ_TX':   return {...s, bizTx:s.bizTx.filter(t=>t.id!==a.p)};
    case 'ADD_DAILY':       return {...s, dailySpend:[a.p,...s.dailySpend]};
    case 'REMOVE_DAILY':    return {...s, dailySpend:s.dailySpend.filter(x=>x.id!==a.p)};
    case 'ADD_WORK':        return {...s, workEntries:[a.p,...s.workEntries]};
    case 'REMOVE_WORK':     return {...s, workEntries:s.workEntries.filter(x=>x.id!==a.p)};
    case 'ADD_DEPOSIT':     return {...s, deposits:[a.p,...s.deposits]};
    case 'REMOVE_DEPOSIT':  return {...s, deposits:s.deposits.filter(x=>x.id!==a.p)};
    case 'ADD_WITHDRAWAL':  return {...s, withdrawals:[a.p,...s.withdrawals]};
    case 'REMOVE_WITHDRAWAL':return {...s, withdrawals:s.withdrawals.filter(x=>x.id!==a.p)};
    case 'ADD_RECURRING':   return {...s, recurring:[a.p,...s.recurring]};
    case 'REMOVE_RECURRING':return {...s, recurring:s.recurring.filter(x=>x.id!==a.p)};
    case 'ADD_GOAL':        return {...s, goals:[a.p,...s.goals]};
    case 'REMOVE_GOAL':     return {...s, goals:s.goals.filter(x=>x.id!==a.p)};
    case 'UPDATE_GOAL':     return {...s, goals:s.goals.map(x=>x.id===a.p.id?{...x,...a.p}:x)};
    case 'SET_SETTINGS':    return {...s, settings:{...s.settings,...a.p}};
    case 'RESET':           return {...INIT};
    default:                return s;
  }
}

const Ctx = createContext(null);

export function AppProvider({children}) {
  const [state, dispatch] = useReducer(reducer, INIT, init => {
    const saved = loadState();
    return saved ? {...init,...saved,_dup:null} : init;
  });

  useEffect(() => { const {_dup,...toSave}=state; saveState(toSave); }, [state]);

  const act = {
    setSalary:        v  => dispatch({type:'SET_SALARY',  p:v}),
    addPayslip:       d  => dispatch({type:'ADD_PAYSLIP', p:{id:uid(),importedAt:today(),...d}}),
    removePayslip:    id => dispatch({type:'REMOVE_PAYSLIP',p:id}),
    clearDup:         () => dispatch({type:'CLEAR_DUP'}),
    setAllocs:        a  => dispatch({type:'SET_ALLOCS',  p:a}),
    addAlloc:         a  => dispatch({type:'ADD_ALLOC',   p:{id:uid(),color:'#C9A227',...a}}),
    updateAlloc:      a  => dispatch({type:'UPDATE_ALLOC',p:a}),
    removeAlloc:      id => dispatch({type:'REMOVE_ALLOC',p:id}),
    addTrade:         t  => dispatch({type:'ADD_TRADE',   p:{id:uid(),...t}}),
    addTradesBulk:    ts => dispatch({type:'ADD_TRADES_BULK',p:ts}),
    removeTrade:      id => dispatch({type:'REMOVE_TRADE',p:id}),
    addBizTx:         t  => dispatch({type:'ADD_BIZ_TX',  p:{id:uid(),...t}}),
    removeBizTx:      id => dispatch({type:'REMOVE_BIZ_TX',p:id}),
    addDailySpend:    d  => dispatch({type:'ADD_DAILY',   p:{id:uid(),date:today(),...d}}),
    removeDailySpend: id => dispatch({type:'REMOVE_DAILY',p:id}),
    addWorkEntry:     e  => dispatch({type:'ADD_WORK',    p:{id:uid(),...e}}),
    removeWorkEntry:  id => dispatch({type:'REMOVE_WORK', p:id}),
    addDeposit:       d  => dispatch({type:'ADD_DEPOSIT', p:{id:uid(),...d}}),
    removeDeposit:    id => dispatch({type:'REMOVE_DEPOSIT',p:id}),
    addWithdrawal:    w  => dispatch({type:'ADD_WITHDRAWAL',p:{id:uid(),...w}}),
    removeWithdrawal: id => dispatch({type:'REMOVE_WITHDRAWAL',p:id}),
    addRecurring:     r  => dispatch({type:'ADD_RECURRING',p:{id:uid(),...r}}),
    removeRecurring:  id => dispatch({type:'REMOVE_RECURRING',p:id}),
    addGoal:          g  => dispatch({type:'ADD_GOAL',    p:{id:uid(),...g}}),
    removeGoal:       id => dispatch({type:'REMOVE_GOAL', p:id}),
    updateGoal:       g  => dispatch({type:'UPDATE_GOAL', p:g}),
    setSettings:      s  => dispatch({type:'SET_SETTINGS',p:s}),
    reset: () => { if(confirm('Reset ALL APEX data? Cannot be undone.')) dispatch({type:'RESET'}); },
  };

  return <Ctx.Provider value={{state,...act}}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
