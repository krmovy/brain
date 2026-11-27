'use strict';
/* ===== Мозг 3.0 · ядро: утилиты, вход, база, запись в рабочую таблицу ===== */
const C={SVC:'SVC',JB:'JB',ME:/ерназар|yernazar|karimovy/i,GOALS:[[3000,'2026-11-30'],[10000,'2026-12-31']],BIZ_GOAL:500000,BIZ_DL:'2026-12-23'};
const XP={'Мини':10,'Задача':25,'Большая':50,'Эпик':150,'Босс':300};
const S={view:'today',auth:null,conn:null,err:{},sheet:null,goals:'blog',blogTab:'shoot',syncedAt:0};
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>/^https:\/\//.test(String(u||''))?String(u):'';
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const ru=d=>pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear();
const today=()=>iso(new Date());
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
const fromRu=s=>{const m=String(s||'').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?m[3]+'-'+pad(m[2])+'-'+pad(m[1]):''};
const toRu=s=>s?s.slice(8,10)+'.'+s.slice(5,7)+'.'+s.slice(0,4):'';
const short=s=>s?s.slice(8,10)+'.'+s.slice(5,7):'';
const pid=u=>{const m=String(u||'').match(/([0-9a-f]{32})/i);return m?m[1]:u};
const yes=v=>v==='__YES__'||v===true;
const MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const WD=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const hm=dt=>{const d=new Date(dt);return pad(d.getHours())+':'+pad(d.getMinutes())};
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2600)}
const LS={get(k,d){try{const v=localStorage.getItem('brain_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('brain_'+k,JSON.stringify(v))}catch(e){}}};
const SB={url:'https://vawqjgehztbspusjojxl.supabase.co',key:'sb_publishable_j3t35SYYwqEQcXnqWhbaMw_N7r3yeFe'};
const ERR_TXT=[[/auth_none|auth_expired|refresh_token|Invalid Refresh/i,'Войди заново'],[/supabase_/,'База не ответила, попробуй ещё раз'],[/no_server/,'Для рабочей таблицы подключи сервер Apps Script (⚙️)'],[/row_not_found|row_ambiguous|bad_match/,'Таблица поменялась — обновил данные, нажми ещё раз'],[/bad_key/,'Неверный ключ сервера (⚙️)'],[/calendar_no_access/,'Нет доступа к рабочему календарю'],[/permission|доступ|not found|Unexpected error while getting/i,'Нет доступа к таблице — расшарь её на личный Gmail'],[/column_locked|append_locked/,'Эту ячейку приложению менять нельзя'],[/Failed to fetch|NetworkError|offline|Load failed/i,'Нет связи']];
const errMsg=e=>{const m=String((e&&e.message)||e||'');const f=ERR_TXT.find(x=>x[0].test(m));return f?f[1]:'Ошибка: '+m.slice(0,120)};

/* --- вход: одноразовый код на почту --- */
async function sbAuth(path,body){const r=await fetch(SB.url+'/auth/v1/'+path,{method:'POST',headers:{apikey:SB.key,'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.msg||j.error_description||j.message||('auth_'+r.status));return j}
function saveSess(j){S.auth={at:j.access_token,rt:j.refresh_token,exp:Date.now()+((+j.expires_in||3600)-60)*1000,email:(j.user&&j.user.email)||(S.auth&&S.auth.email)||''};LS.set('auth',S.auth)}
function logout(){S.auth=null;LS.set('auth',null);render()}
async function token(){
  if(!S.auth)throw new Error('auth_none');
  if(Date.now()>S.auth.exp){
    if(!token.p)token.p=sbAuth('token?grant_type=refresh_token',{refresh_token:S.auth.rt}).then(saveSess).catch(e=>{if(!/fetch|network|load failed/i.test(String(e.message)))logout();throw e}).finally(()=>{token.p=null});
    await token.p;
  }
  return S.auth.at;
}
async function sb(method,path,body,prefer,retry){
  const h={apikey:SB.key,Authorization:'Bearer '+await token()};if(body)h['Content-Type']='application/json';if(prefer)h.Prefer=prefer;
  const r=await fetch(SB.url+'/rest/v1/'+path,{method,headers:h,body:body?JSON.stringify(body):undefined});
  if(r.status===401&&!retry){S.auth.exp=0;return sb(method,path,body,prefer,true)}
  const tx=await r.text();if(!r.ok)throw new Error('supabase_'+r.status+': '+tx.slice(0,160));return tx?JSON.parse(tx):null;
}

/* --- сервер Apps Script (необязательный) --- */
async function api(calls){
  const c=S.conn;if(!c)throw new Error('no_server');
  const r=await fetch(c.url,{method:'POST',body:JSON.stringify({key:c.key,action:'batch',calls})});
  const j=await r.json();if(!j.ok)throw new Error(j.error||'server');
  return j.results;
}
async function one(call){const [r]=await api([call]);if(!r.ok)throw new Error(r.error);return r.data}
const mirror=call=>{if(S.conn)one(call).catch(()=>{})}; // дубль в Notion/Jarvis на переходную неделю: молча, не мешает работе

const book=id=>id===C.SVC?'SVC':'JB';
const W_COLS={'Задачи':{F:'owner',H:'status',J:'dl',K:'dl_moves',M:'week_upd',N:'next_step',Q:'updated'},'Решения':{G:'status'},'Обещания':{I:'status'},'Проекты':{H:'mode'}};
function wCells(sheet,cells){const m=W_COLS[sheet]||{},o={};Object.keys(cells).forEach(c=>{if(m[c])o[m[c]]=m[c]==='dl'?(fromRu(cells[c])||null):cells[c]});return o}
async function setRow(id,sheet,match,hint,cells){
  const call={action:'sheet.setRow',book:book(id),sheet,match,hint,cells};
  if(book(id)==='SVC'){ // командная таблица: сначала сама таблица, потом копия
    await one(call);
    const q=sheet==='Задачи'?'work_tasks?id=eq.'+encodeURIComponent(match.A):'work_decisions?row_num=eq.'+(+hint);
    sb('PATCH',q,wCells(sheet,cells),'return=minimal').catch(()=>{});return;
  }
  const t=sheet==='Обещания'?'promises':'projects';
  const q=match.A?'id=eq.'+encodeURIComponent(match.A):'what=eq.'+encodeURIComponent(match.E||'');
  await sb('PATCH',t+'?'+q,wCells(sheet,cells),'return=minimal');
  mirror(Object.assign(call,{hint:0}));
}
async function appendRow(id,range,row){
  const sheet=range.split('!')[0];
  if(sheet==='Обещания')await sb('POST','promises',{id:row[0],day:fromRu(row[1])||today(),direction:row[2]||null,person:row[3]||null,what:row[4]||null,due:fromRu(row[5])||null,project_id:row[6]||null,meeting_id:row[7]||null,status:row[8]||'Открыт',result:row[9]||null},'return=minimal');
  else if(sheet==='Журнал')await sb('POST','journal',{id:row[0],day:fromRu(row[1])||today(),project_id:row[2]||null,minutes:+row[3]||null,type:row[4]||null,what:row[5]||null,value:row[6]||null,source:row[7]||null,meeting_id:row[8]||null},'return=minimal');
  else throw new Error('append_locked');
  mirror({action:'sheet.append',book:book(id),sheet,row});
}
async function toAgent(agent,title,prompt,ref_table,ref_id){
  const [r]=await sb('POST','queue',{agent,title:String(title||'').slice(0,120),prompt,ref_table:ref_table||null,ref_id:ref_id||null},'return=representation');
  (S.queue=S.queue||[]).unshift(r);return r;
}
const desk=()=>matchMedia('(min-width:1000px)').matches;
