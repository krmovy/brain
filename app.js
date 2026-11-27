'use strict';
/* ===== Мозг 3.0 · данные, расчёты, экраны, действия (27.11.2026) ===== */
const D={};                                      // все данные из базы
const LVN=['Новичок','Ученик','Практик','Специалист','Стратег','Лидер','Мастер','Наставник','Визионер','Легенда'];
const IDEA_FLOW=['Идея','Пишу','Готов','Снимаю','Снято','Монтаж','Вышел'];
const IDEA_MAP={'Сырая':'Идея','Сценарий':'Готов','Выложено':'Вышел'};
const ist=i=>IDEA_MAP[i.status]||i.status||'Идея';
const CL_ST=['Найден','Написал','Ответил','Созвон','КП','Оплатил'];
const LADDER=['Оффер одной фразой','Цена и 2 пакета','1 пример ИИ-видео','Список 20 компаний','Шаблон первого сообщения','Написать 5 компаниям','Написать ещё 5','Ответить откликнувшимся','Показать пример на созвоне','Отправить КП с ценой','Напомнить молчащим','Первая оплата'];
const TASK_ST=['Бэклог','Дискавери','В работе','Блокер','Пауза','Готово'];
const AG={work:'Стратег',meet:'Секретарь',blog:'Сценарист',edit:'Монтажёр',biz:'Продажник',life:'Мозг'};
const fname=s=>String(s||'').split(/[\s,+]/).filter(Boolean)[0]||'—';
const isMine=t=>C.ME.test(t.owner||'');
const openT=t=>!['Готово','Отменено'].includes(t.status);
const dayOf=ts=>ts?iso(new Date(ts)):'';
const night=()=>{const h=new Date().getHours();return h>=19||h<6};
const plural=(n,a,b,c)=>{n=Math.abs(n)%100;const m=n%10;return n>10&&n<20?c:m>1&&m<5?b:m===1?a:c};

/* ---------- загрузка ---------- */
async function loadAll(){
  if(!S.auth)return;
  const t=today(),d14=addDays(t,-14),d60=addDays(t,-60),m0=t.slice(0,8)+'01';
  const J=[['tasks','work_tasks?select=*&order=row_num'],['dec','work_decisions?select=*&order=row_num'],['epics','epics?select=*&order=id'],
    ['promises','promises?select=*&order=due.nullslast'],['meetings',`meetings?select=*&day=gte.${addDays(t,-7)}&order=start_at`],
    ['ideas','ideas?select=*&order=updated_at.desc'],['finds','finds?select=*&order=day.desc.nullslast&limit=40'],['reels','reels?select=*&order=views.desc.nullslast&limit=60'],
    ['metrics','metrics?select=*&order=day'],['clients','clients?select=*'],['hyp','hypotheses?select=*'],['quests','quests?select=*'],
    ['habits','habits?select=*&order=day.desc&limit=60'],['hdefs','habit_defs?select=*&active=eq.true&order=sort'],['hmarks',`habit_marks?select=*&day=gte.${d14}`],
    ['money',`money?select=*`],['days',`days?select=*&day=gte.${d60}&order=day`],['focus',`focus_log?select=*&day=gte.${d60}`],
    ['queue','queue?select=*&order=created_at.desc&limit=30'],['quotes','quotes?select=*&order=day.desc.nullslast&limit=40'],['tlog',`task_log?select=*&created_at=gte.${d60}&order=created_at.desc&limit=500`],['shop','shop?select=*'],['ach','achievements?select=*'],['journal',`journal?select=*&day=gte.${d60}`]];
  S.syncing=true;
  try{await token()}catch(e){S.syncing=false;render();return}
  const R=await Promise.allSettled(J.map(j=>sb('GET',j[1])));let bad=null;
  R.forEach((r,i)=>{const k=J[i][0];if(r.status==='fulfilled'){D[k]=r.value;delete S.err[k]}else{S.err[k]=r.reason;bad=r.reason}});
  S.syncing=false;
  if(!bad){S.syncedAt=Date.now();LS.set('cache3',{at:S.syncedAt,D})}else toast(errMsg(bad));
  render();levelCheck();
}
const DKEY={hypotheses:'hyp',focus_log:'focus',habit_defs:'hdefs',task_log:'tlog'};
const tlog=(id,kind,text)=>ins('task_log',{task_id:id,kind,text}).catch(()=>{});
const ins=async(t,row)=>{const [r]=await sb('POST',t,row,'return=representation');const k=DKEY[t]||t;(D[k]=D[k]||[]).unshift(r);return r};
const upd=(t,id,cols,key)=>sb('PATCH',`${t}?${key||'id'}=eq.${encodeURIComponent(id)}`,cols,'return=minimal');
const upsertDay=async(day,cols)=>{let d=(D.days||[]).find(x=>x.day===day);if(d){Object.assign(d,cols);await upd('days',day,cols,'day')}else{d=Object.assign({day,top3:[],planned:false,closed:false},cols);(D.days=D.days||[]).push(d);await sb('POST','days?on_conflict=day',d,'resolution=merge-duplicates,return=minimal')}return d};
const dayRec=day=>(D.days||[]).find(x=>x.day===day)||{day,top3:[],planned:false,closed:false};

/* ---------- расчёты ---------- */
const myOpen=()=>(D.tasks||[]).filter(t=>isMine(t)&&openT(t));
function feed(){const t=today();if(wkend())return [];
  const tasks=myOpen().filter(x=>x.dl&&x.dl<=t).sort((a,b)=>a.dl<b.dl?-1:1).map(x=>({kind:'task',id:x.id,t:x.id+' '+x.title,sub:`${x.epic_id||'вне эпика'} · DL ${short(x.dl)}`,od:x.dl<t?Math.round((new Date(t)-new Date(x.dl))/864e5):0,c:'w',it:x}));
  const pr=(D.promises||[]).filter(p=>p.status!=='Сделано'&&p.due&&p.due<=t).map(p=>{const me=!/мне|жду/i.test(p.direction||'');return {kind:'prom',id:p.id,t:(p.person?p.person+': ':'')+p.what,sub:(me?'я обещал':'мне обещали')+(p.due<t?' · просрочено':' · сегодня'),od:0,c:me?'ac':'l',it:p}});
  return tasks.concat(pr)}
function suggestTop3(){const t=today(),out=[],seen=new Set();const add=x=>{if(x&&!seen.has(x.ref)&&out.length<3){seen.add(x.ref);out.push(x)}};
  if(wkend())return wkTop3();
  myOpen().filter(x=>x.dl&&x.dl<t).sort((a,b)=>a.dl<b.dl?-1:1).slice(0,1).forEach(x=>add({kind:'task',ref:x.id,t:x.id+' '+x.title,why:'просрочено'}));
  const p1=new Set((D.epics||[]).filter(e=>e.priority==='P1'&&e.status!=='Закрыт').map(e=>e.id));
  myOpen().filter(x=>p1.has(x.epic_id)).sort((a,b)=>(a.dl||'9')<(b.dl||'9')?-1:1).slice(0,2).forEach(x=>add({kind:'task',ref:x.id,t:x.id+' '+x.title,why:x.epic_id+' · P1'}));
  const idea=(D.ideas||[]).find(i=>['Пишу','Готов','Снимаю','Сценарий'].includes(i.status));if(idea)add({kind:'idea',ref:idea.id,t:(ist(idea)==='Пишу'?'Дописать: ':'Снять: ')+idea.title,why:'блог'});
  myOpen().filter(x=>x.dl).sort((a,b)=>a.dl<b.dl?-1:1).forEach(x=>add({kind:'task',ref:x.id,t:x.id+' '+x.title,why:'DL '+short(x.dl)}));
  return out}
function top3Done(x){if(x.kind==='task'){const t=(D.tasks||[]).find(y=>y.id===x.ref);return t&&!openT(t)}if(x.kind==='idea'){const i=(D.ideas||[]).find(y=>y.id===x.ref);return i&&dayOf(i.updated_at)===today()&&IDEA_FLOW.indexOf(ist(i))>=3}if(x.kind==='prom'){const p=(D.promises||[]).find(y=>y.id===x.ref);return p&&p.status==='Сделано'}return !!x.done}
function todayMeetings(){return (D.meetings||[]).filter(m=>m.day===today()&&m.status!=='skip').sort((a,b)=>(a.start_at||'')<(b.start_at||'')?-1:1)}
function quests(){const t=today(),ms=todayMeetings(),nx=ms.find(m=>new Date(m.end_at||m.start_at)>new Date());
  const q1=wkend()?(()=>{const b=bizStep();return {t:'Бизнес',s:b?b.t.slice(0,24):'шаг к оплате',done:(dayRec(t).top3||[]).some(x=>String(x.ref||'').startsWith('biz')&&x.done),act:'goals',v:'biz'}})():nx?{t:'Подготовься',s:'к встрече '+hm(nx.start_at),done:!!nx.prep,act:'meet',id:nx.id}:{t:'Закрой задачу',s:'одну из ленты',done:(D.tasks||[]).some(x=>isMine(x)&&x.status==='Готово'&&fromRu(x.updated)===t),act:'go',v:'work'};
  const id=(D.ideas||[]).find(i=>['Идея','Сырая','Пишу','Готов','Сценарий','Снимаю'].includes(i.status));
  const q2={t:'Шаг блога',s:id?id.title.slice(0,22):'выбери идею',done:(D.ideas||[]).some(i=>dayOf(i.updated_at)===t&&i.status!=='Сырая'),act:'idea',id:id&&id.id};
  const q3={t:'Личное',s:'отметь привычку',done:(D.hmarks||[]).some(m=>m.day===t),act:'goals',v:'life'};
  return [q1,q2,q3]}
function xpByDay(){const m={},a=(d,v)=>{if(d)m[d]=(m[d]||0)+v};
  (D.quests||[]).filter(q=>q.status==='Готово').forEach(q=>a(dayOf(q.updated_at),XP[q.kind]||25));
  (D.tasks||[]).filter(x=>isMine(x)&&x.status==='Готово').forEach(x=>a(fromRu(x.updated),25));
  (D.promises||[]).filter(p=>p.status==='Сделано').forEach(p=>a(dayOf(p.updated_at),10));
  (D.days||[]).filter(d=>d.closed).forEach(d=>a(d.day,30));(D.focus||[]).forEach(f=>a(f.day,Math.round(f.minutes/25*10)));
  (D.hmarks||[]).forEach(h=>a(h.day,5));(D.ideas||[]).filter(i=>ist(i)==='Вышел').forEach(i=>a(dayOf(i.updated_at),20));
  (D.meetings||[]).filter(x=>x.summary).forEach(x=>a(x.day,15));
  (D.days||[]).forEach(d=>(d.top3||[]).filter(x=>x.extra&&top3Done(x)).forEach(()=>a(d.day,25)));return m}
function hero(){const m=xpByDay(),xp=Object.values(m).reduce((a,b)=>a+b,0),lvl=Math.floor(xp/250)+1,spent=(D.shop||[]).filter(s=>s.bought).reduce((a,s)=>a+(+s.price||0),0);return {xp,lvl,name:LVN[Math.min(lvl-1,9)],next:LVN[Math.min(lvl,9)],in:xp%250,coins:xp-spent,m}}
function streak(){const m=xpByDay(),dd=dayRec;let n=0,d=today();if(!(m[d]>0)&&!dd(d).closed)d=addDays(d,-1);while((m[d]>0)||dd(d).closed||dd(d).freeze_used){n++;d=addDays(d,-1);if(n>400)break}return n}
function weekStats(off){const t=today(),wd=(new Date().getDay()+6)%7,mon=addDays(t,-wd-7*off),m=xpByDay();let xp=0,closed=0,focus=0,vids=0;
  for(let i=0;i<7;i++){const d=addDays(mon,i);if(off===0&&d>t)break;xp+=m[d]||0;if(dayRec(d).closed)closed++;focus+=(D.focus||[]).filter(f=>f.day===d).reduce((a,f)=>a+f.minutes,0);vids+=(D.ideas||[]).filter(x=>ist(x)==='Вышел'&&dayOf(x.updated_at)===d).length}return {xp,closed,focus,vids}}
function mood(){const h=new Date().getHours(),q=quests();if(S.win&&Date.now()-S.win<6000)return ['f_laugh',['Красава! 🔥','Так держать!','Вот это темп 💪'][S.win%3]];
  if(wkend()&&h>=6&&h<22&&!q.every(x=>x.done))return ['f_cool',dow()===6?'Суббота. Работа ждёт до понедельника — сегодня блог и бизнес 🎬':'Воскресенье. Блог, бизнес и отдых — работа завтра 🌿'];
  const tx=xpByDay()[today()]||0;if(h>=20&&!tx&&streak()>0)return ['f_focus',`Серия ${streak()} ${plural(streak(),'день','дня','дней')} сгорит через ${24-h} ч — один шаг на 10 минут?`];
  const ng=nags().length;if(ng)return ['f_focus',`Сначала запиши итоги — ${ng} ${plural(ng,'пункт','пункта','пунктов')} ниже ✍️`];
  if(q.every(x=>x.done))return ['f_grin','Все задания закрыты — сундук твой 🎁'];if(h>=22||h<6)return ['f_sleepy','Поздно. Закрой день и спать 🌙'];
  if(h<11&&!dayRec(today()).planned)return ['f_happy','Доброе утро! Спланируем день?'];const LT=!wkend()&&h<19?lastTouch():null;if(LT&&LT.x&&LT.x.next_step&&!(S.mood1>Date.now()))return ['f_focus',`${ago(LT.at)==='сегодня'?'Ты сейчас на':ago(LT.at)==='вчера'?'Вчера остановился на':'Остановился на'} ${LT.x.id}: «${String(LT.x.next_step).slice(0,60)}». 25 минут — и сдвинешь?`];
  const od=feed().filter(x=>x.od).length;if(od>=2)return ['f_focus',`${od} просрочено. Начнём с одной?`];
  if(streak()>=7)return ['f_cool',`Серия ${streak()} дней. Не сбавляем 😎`];return ['f_neutral',h<18?'Держим фокус на одном деле':'Вечер — время для блога']}

/* ---------- кусочки интерфейса ---------- */
const av=(f,cls)=>`<div class="av ${cls||''}"><img src="char/${f}.png" alt=""></div>`;
const blk=(c,ic,t,sub,right,attrs)=>`<div class="bl" style="--s:var(--${c}s);--c:var(--${c})" ${attrs||''}><span class="ic">${ic}</span><div class="t">${t}<small>${sub||''}</small></div>${right||''}</div>`;
const card=(h,b)=>`<section class="card">${h?`<div class="lbl">${h}</div>`:''}${b}</section>`;
const lbl=(a,b,act)=>`<div class="lbl"><span>${a}</span>${b?`<span class="lk" ${act||''}>${b}</span>`:''}</div>`;
const back=(v,t)=>`<button class="back" data-act="go" data-v="${v}">‹ ${t}</button>`;
const seg=(items,cur,act)=>`<div class="seg">${items.map(i=>`<button class="${i[0]===cur?'on':''}" data-act="${act}" data-v="${i[0]}">${i[1]}</button>`).join('')}</div>`;

/* ---------- контекст: история задач, «Продолжим», подталкивания ---------- */
function hist(id){const L=(D.tlog||[]).filter(x=>x.task_id===id).map(x=>({at:x.created_at,day:x.day,t:x.text,k:x.kind}));
  (D.focus||[]).filter(f=>f.ref_id===id).forEach(f=>L.push({at:f.created_at||f.day,day:f.day,t:`${f.minutes} мин фокуса`,k:'focus'}));
  return L.sort((a,b)=>String(a.at)<String(b.at)?1:-1)}
function lastTouch(){const open=new Map(myOpen().map(x=>[x.id,x]));let best=null;const see=(id,at)=>{if(id&&open.has(id)&&(!best||String(at)>String(best.at)))best={id,at}};
  (D.tlog||[]).forEach(l=>see(l.task_id,l.created_at));(D.focus||[]).forEach(f=>see(f.ref_id,f.created_at||f.day));
  if(!best){const x=myOpen().filter(x=>x.status==='В работе'&&x.next_step).sort((a,b)=>(fromRu(b.updated)||'')>(fromRu(a.updated)||'')?1:-1)[0];if(x)best={id:x.id,at:fromRu(x.updated)||''}}
  return best?Object.assign(best,{x:open.get(best.id)}):null}
const ago=at=>{if(!at)return '';const d=String(at).slice(0,10),t=today();return d===t?'сегодня':d===addDays(t,-1)?'вчера':short(d)};
const xpT=()=>{const m=xpByDay(),t=today();return [m[t]||0,m[addDays(t,-1)]||0]};
function histHtml(x,n){const h=hist(x.id).slice(0,n||4).reverse();if(!h.length&&!x.week_upd&&!x.next_step)return '';
  return `<div class="tl">${h.map(e=>`<div class="${e.k==='focus'?'f':''}"><em>${esc(short(e.day||String(e.at).slice(0,10)))}</em> ${esc(e.t||'')}</div>`).join('')}${!h.length&&x.week_upd?`<div><em>апдейт</em> ${esc(String(x.week_upd).slice(0,140))}</div>`:''}<div class="now"><em>Шаг сейчас:</em> ${esc(x.next_step||'не задан')}</div></div>`}
function vCont(){if(wkend())return '';const L=lastTouch();if(!L||!L.x)return '';const x=L.x;
  return `<section class="cont"><small>ПРОДОЛЖИМ? · ${esc(ago(L.at)||'в работе')}</small><h3>${esc(x.title)}</h3><div class="sub" style="margin:-4px 0 8px">${esc(x.id)} · ${esc(x.epic_id||'вне эпика')}</div>${histHtml(x,3)}<div class="two"><button class="btn" data-act="focus" data-t="${esc(x.id+' '+x.title)}" data-ref="${esc(x.id)}">▶ Продолжить · 25′</button><button class="btn g" data-act="taskOpen" data-id="${esc(x.id)}">Открыть</button></div></section>`}
function vPulse(){const [a,b]=xpT(),H=hero();return `<div class="pulse"><span>⭐ +${a} XP сегодня</span><span class="${a>=b?'u':''}">${a>=b?'↑':'↓'} вчера ${b}</span><span>до «${esc(H.next)}» ${250-H.in}</span></div>`}
function nudge(html,btns){const el=$('#nudge');if(!el)return;el.innerHTML=`<div class="ntx">${html}</div><div class="nbt">${(btns||[]).map((b,i)=>`<button class="${i?'g':''}" ${b[1]}>${b[0]}</button>`).join('')}<button class="g" data-act="nudgeX">Позже</button></div>`;el.hidden=false;clearTimeout(nudge.t);nudge.t=setTimeout(()=>{el.hidden=true},20000)}
function chainAfterDone(x){if(!x.epic_id)return;const rest=myOpen().filter(y=>y.epic_id===x.epic_id&&y.id!==x.id).sort((a,b)=>(a.dl||'9')<(b.dl||'9')?-1:1);
  if(!rest.length)return nudge(`✓ ${esc(x.id)} закрыта · +25 XP. <b>В ${esc(x.epic_id)} твоих задач больше нет 🎉</b> Обновить цель или итог эпика?`,[['Открыть эпик',`data-act="epic" data-id="${esc(x.epic_id)}"`]]);
  const n=rest[0];nudge(`✓ ${esc(x.id)} закрыта · +25 XP. <b>В ${esc(x.epic_id)} осталось ${rest.length}.</b> Следующая — ${esc(n.id)} ${esc(n.title)}. Взять?`,[['▶ Взять',`data-act="focus" data-t="${esc(n.id+' '+n.title)}" data-ref="${esc(n.id)}"`],['Открыть',`data-act="taskOpen" data-id="${esc(n.id)}"`]])}
function welcomeBack(last){if(!last||Date.now()-last<3*36e5||wkend()||!D.tasks)return;const L=lastTouch();if(!L||!L.x)return;const x=L.x;
  nudge(`С возвращением 👋 <b>Остановился на ${esc(x.id)} ${esc(x.title)}</b>${x.next_step?` — шаг: «${esc(String(x.next_step).slice(0,70))}»`:''}. 10 минут?`,[['▶ Продолжить',`data-act="focus" data-t="${esc(x.id+' '+x.title)}" data-ref="${esc(x.id)}"`],['Открыть',`data-act="taskOpen" data-id="${esc(x.id)}"`]])}

/* ---------- выходные: работа отдыхает, фокус на блоге, бизнесе, личном ---------- */
function bizStep(){if((D.clients||[]).some(c=>c.stage==='Оплатил'))return null;const st=Math.min(Math.max(0,...(D.habits||[]).map(h=>+h.step_biz||0)),11);return {i:st,t:LADDER[st]}}
function wkTop3(){const out=[];
  const ids=(D.ideas||[]).filter(i=>['Снимаю','Готов','Сценарий','Пишу','Идея','Сырая'].includes(i.status)).sort((a,b)=>['Снимаю','Готов','Сценарий','Пишу','Идея','Сырая'].indexOf(a.status)-['Снимаю','Готов','Сценарий','Пишу','Идея','Сырая'].indexOf(b.status));
  const i=ids[0];out.push(i?{kind:'idea',ref:i.id,t:(['Снимаю','Готов','Сценарий'].includes(i.status)?'Снять: ':'Дописать: ')+i.title,why:'блог'}:{kind:'text',ref:'blog'+today(),t:'Блог: выбрать идею из находок и написать хук',why:'блог'});
  const b=bizStep();out.push(b?{kind:'text',ref:'biz'+b.i,t:'Бизнес: '+b.t,why:(b.i+1)+'/12'}:{kind:'text',ref:'biz'+today(),t:'Бизнес: один шаг по воронке клиентов',why:'бизнес'});
  const g=(D.quests||[]).find(q=>q.sphere==='Личная жизнь'&&['Босс','Эпик'].includes(q.kind)&&q.status!=='Готово');
  out.push(g?{kind:'text',ref:'life'+g.id,t:'Личное: '+g.title,why:'квартал'}:{kind:'text',ref:'life'+today(),t:'Личное: спорт / отдых без телефона',why:'отдых'});
  return out}
function vWeekendCard(){const t=today();
  if(wkend()){const mon=nextWork(t),n=myOpen().filter(x=>x.dl&&x.dl<=mon).length;return `<section class="wk"><b>${dow()===6?'Суббота':'Воскресенье'} — выходной от работы 🏖</b><p>Рабочие задачи и напоминания спрятаны до понедельника${n?` (там ждут ${n} ${plural(n,'задача','задачи','задач')} со сроком)`:''}. Сегодня максимум — блог и бизнес.</p></section>`}
  if(dow()===5){const sat=addDays(t,1),sun=addDays(t,2),L=myOpen().filter(x=>x.dl===sat||x.dl===sun);if(L.length)return `<section class="wk fri"><b>Пятница: ${L.length} ${plural(L.length,'срок','срока','сроков')} на выходных</b><p>${esc(L.map(x=>x.id).join(', '))} — на выходных не работаем. Закрой сегодня или перенеси на понедельник.</p><button class="btn" data-act="wkMove">Перенести на пн</button></section>`}
  return ''}

/* ---------- СЕГОДНЯ: напоминания, цитата, «дальше», сверх плана ---------- */
function nags(){if(wkend()||LS.get('nagSnooze',0)>Date.now())return [];const now=new Date(),t=today(),out=[];
  (D.meetings||[]).filter(m=>m.status!=='skip'&&!m.summary&&m.end_at&&new Date(m.end_at)<now&&now-new Date(m.end_at)<4*864e5).sort((a,b)=>a.end_at<b.end_at?1:-1).forEach(m=>{const mn=Math.round((now-new Date(m.end_at))/6e4);out.push({k:'meet',id:m.id,t:'Резюме встречи «'+m.title+'»',s:'Прошла '+(mn<60?mn+' мин':mn<1440?Math.round(mn/60)+' ч':Math.round(mn/1440)+' дн')+' назад. Что решили и кто что делает · +15 XP'})});
  myOpen().filter(x=>['В работе','Блокер'].includes(x.status)).map(x=>{const u=fromRu(x.updated);return [x,u?Math.round((new Date(t)-new Date(u))/864e5):99]}).filter(a=>a[1]>=3).sort((a,b)=>b[1]-a[1]).forEach(([x,n])=>out.push({k:'task',id:x.id,t:String(x.title||x.id),s:(n>=99?'Апдейта ещё не было. ':'Апдейт '+n+' '+plural(n,'день','дня','дней')+' назад. ')+(x.next_step?'Что с шагом «'+String(x.next_step).slice(0,60)+(String(x.next_step).length>60?'…':'')+'»?':'Что сделал и какой следующий шаг?')}));
  return out}
function vNags(){const n=nags();if(!n.length)return '';return `<section class="nag"><div class="nh"><b>✍️ Нужно записать · ${n.length}</b><button class="lk" data-act="nagLater">позже</button></div>${n.slice(0,4).map(x=>`<button class="ni" data-act="${x.k==='meet'?'nagMeet':'nagTask'}" data-id="${esc(x.id)}"><span class="t">${esc(x.t)}<small>${esc(x.s)}</small></span>${x.k==='meet'?`<span class="x" data-act="meetSkip" data-id="${esc(x.id)}">не нужно</span>`:''}<i>›</i></button>`).join('')}${n.length>4?`<p class="sub" style="margin:6px 2px 0">и ещё ${n.length-4}</p>`:''}</section>`}
function quoteCard(){const q=(D.quotes||[]).find(x=>x.day===today())||(D.quotes||[])[0];if(!q)return '';
  if(LS.get('qMin',false))return `<button class="qmin" data-act="qTog"><i>“</i><span>${esc(q.text)}</span>›</button>`;
  return `<section class="qt"><q>${esc(q.text)}</q><div class="a">${esc(q.author||'')}</div>${q.why?`<div class="why"><b>Почему тебе:</b> ${esc(q.why)}</div>`:''}<div class="act"><button data-act="qFav" data-id="${q.id}">${q.fav?'♥ В любимых':'♡ В любимые'}</button><button data-act="nav" data-v="me">Все цитаты →</button><button data-act="qTog">свернуть</button></div></section>`}
function vQuotes(){const Q=(D.quotes||[]).slice().sort((a,b)=>(b.fav-a.fav)||((b.day||'')>(a.day||'')?1:-1));if(!Q.length)return '';
  return lbl('Цитаты',`♥ ${Q.filter(q=>q.fav).length}`)+Q.slice(0,12).map(q=>`<div class="qt sm"><q>${esc(q.text)}</q><div class="a">${esc(q.author||'')}${q.day?' · '+short(q.day):''}</div><div class="act"><button data-act="qFav" data-id="${q.id}">${q.fav?'♥ в любимых':'♡'}</button></div></div>`).join('')}
function vTop3(dr){const L=(dr.top3||[]).map((x,i)=>[x,i]).filter(a=>!a[0].extra);if(!L.length)return '';const dn=L.filter(a=>top3Done(a[0])).length,fu=L.findIndex(a=>!top3Done(a[0]));
  let o=lbl('3 главных',`${dn}/${L.length}`);
  L.forEach(([x,i],k)=>{const d=top3Done(x);if(k===fu&&k>0)o+=`<div class="nx"><b>→</b><span>Дальше: <b>${esc(x.t)}</b>${x.why?' · '+esc(x.why):''}</span><button class="lk" data-act="focus" data-t="${esc(x.t)}" data-ref="${esc(x.ref||'')}">Фокус 25′</button></div>`;
    o+=blk(d?'z':'ac',['①','②','③','④'][k]||'•',esc(x.t),esc(x.why||''),`<button class="ck ${d?'on':''}" data-act="topDone" data-i="${i}">${d?'✓':''}</button>`,`data-act="topOpen" data-i="${i}"`).replace('class="bl"',`class="bl ${d?'done':''}"`)});
  return dn===L.length?o+vMore(dr):o}
function bestNext(dr){if(wkend())return [];const t=today(),inTop=new Set((dr.top3||[]).map(x=>x.ref)),p1=new Set((D.epics||[]).filter(e=>e.priority==='P1'&&e.status!=='Закрыт').map(e=>e.id)),t2=addDays(t,2);
  return myOpen().filter(x=>!inTop.has(x.id)).map(x=>{let s=0;const why=[];if(x.dl&&x.dl<t){s+=50;why.push(['r','просрочено'])}else if(x.dl&&x.dl<=t2){s+=30;why.push(['r','DL '+short(x.dl)])}
    if(p1.has(x.epic_id)){s+=20;why.push(['y','P1 эпик'])}if(x.status==='В работе'){s+=10;why.push(['g','уже в работе'])}if(x.dl&&x.dl>t2){s+=5;why.push(['g','DL '+short(x.dl)])}return {x,s,why}}).sort((a,b)=>b.s-a.s)}
function vMore(dr){const ex=(dr.top3||[]).map((x,i)=>[x,i]).filter(a=>a[0].extra),exd=ex.filter(a=>top3Done(a[0])).length;
  let o=`<section class="win"><small>${exd?`3/3 ✓ + ${exd} СВЕРХ ПЛАНА`:'3/3 ✓ ПЛАН ДНЯ ЗАКРЫТ'}</small><h3>${exd?'Машина. Ещё?':'Красава. Ещё одну?'}</h3><p>Каждая задача сверх плана — ×2 XP до конца дня.</p><img src="char/p_yay.png" alt=""></section>`;
  o+=lbl('Сверх плана','×2 XP');
  o+=ex.map(([x,i])=>{const d=top3Done(x);return blk(d?'z':'ac','＋',esc(x.t),d?'+50 XP ✓':'сверх плана',`<button class="ck ${d?'on':''}" data-act="topDone" data-i="${i}">${d?'✓':''}</button>`,`data-act="topOpen" data-i="${i}"`).replace('class="bl"',`class="bl ${d?'done':''}"`)}).join('');
  const B=bestNext(dr);if(B.length){const b=B[(S.nxi||0)%B.length];o+=`<div class="ext"><div class="top"><span>ЛУЧШАЯ СЛЕДУЮЩАЯ</span><span>+50 XP</span></div><b>${esc(b.x.id+' '+b.x.title)}</b><p>${esc(b.x.epic_id||'вне эпика')}${b.x.next_step?' · '+esc(b.x.next_step):''}</p>${b.why.length?`<div class="why">${b.why.map(w=>`<span class="${w[0]}">${esc(w[1])}</span>`).join('')}</div>`:''}<div class="two"><button class="btn" data-act="nextTake" data-id="${esc(b.x.id)}">Взять · фокус 25′</button><button class="btn g" data-act="nextOther">Другую${B.length>1?` (${B.length})`:''}</button></div></div>`}
  else o+=wkend()?'<p class="empty">Выходной: работу не трогаем 🏖 Ещё шаг — блог или бизнес ниже</p>':'<p class="empty">Рабочие задачи разобраны 👌 Возьми шаг блога ниже</p>';
  return o+vPrep()+vDig()}
function vPrep(){if(wkend())return '';const now=new Date(),tm=addDays(today(),1),ms=todayMeetings().filter(m=>new Date(m.start_at)>now&&!m.prep).slice(0,1),dl=myOpen().filter(x=>x.dl===tm);if(!ms.length&&!dl.length)return '';
  return lbl('К чему готовиться')+`<div class="mt">${ms.map(m=>`<button class="m" data-act="meet" data-id="${m.id}"><span class="tm">${hm(m.start_at)}</span><span class="t">${esc(m.title)}<small>подготовки нет</small></span><span class="tag">✨ Подготовить</span></button>`).join('')}${dl.length?`<button class="m" data-act="go" data-v="work"><span class="tm">Завтра</span><span class="t">${dl.length} ${plural(dl.length,'дедлайн','дедлайна','дедлайнов')}: ${esc(dl.map(x=>x.id).join(', '))}<small>${esc(dl.filter(x=>x.status!=='В работе').map(x=>x.id+' — '+x.status).join(' · ')||'всё в работе')}</small></span><span class="tag r">Посмотреть</span></button>`:''}</div>`}
function vDig(){const t=today(),out=[],mine=new Set(myOpen().map(x=>x.epic_id).filter(Boolean));
  if(wkend()){const b=bizStep();if(b)out.push(['z','💸','Бизнес: '+b.t,'Следующая ступенька к первой оплате','data-act="goTo" data-v="biz"','Сделать'])}
  if(!wkend())myOpen().filter(x=>(+x.dl_moves||0)>=3).sort((a,b)=>b.dl_moves-a.dl_moves).slice(0,1).forEach(x=>out.push(['r','🎯',`${x.id} переносили ${x.dl_moves} раза`,'Разбей на шаг поменьше, на 15 минут',`data-act="taskOpen" data-id="${esc(x.id)}"`,'Разбить']));
  if(!wkend())(D.epics||[]).filter(e=>mine.has(e.id)&&e.status!=='Закрыт').map(e=>[e,epicStat(e).idle]).filter(a=>a[1]>=7).sort((a,b)=>b[1]-a[1]).slice(0,1).forEach(([e,n])=>out.push(['w','💼',`${e.id} стоит ${n} дн`,'Один шаг: апдейт в таблицу, 5 мин',`data-act="epic" data-id="${e.id}"`,'Сделать']));
  const id=(D.ideas||[]).find(i=>['Пишу','Готов','Снимаю','Сценарий','Идея','Сырая'].includes(i.status));if(id)out.push(['b','🎬',String(id.title||'Идея').slice(0,34),{Идея:'Напиши хук, 10 мин',Сырая:'Напиши хук, 10 мин',Пишу:'Допиши сценарий, 15 мин',Сценарий:'Сними, 15 мин',Готов:'Сними, 15 мин',Снимаю:'Доснимай'}[id.status]||'Один шаг',`data-act="idea" data-id="${id.id}"`,'Открыть']);
  if(!(D.hmarks||[]).some(m=>m.day===t))out.push(['z','🌿','Привычки за сегодня','Ни одной отметки — серия под угрозой','data-act="goTo" data-v="life"','Отметить']);
  if(!out.length)return '';return lbl('Куда копнуть')+`<div class="dig">${out.slice(0,2).map(d=>`<button class="dg" style="--s:var(--${d[0]}s)" ${d[4]}><i>${d[1]}</i><b>${esc(d[2])}</b><small>${esc(d[3])}</small><em>${d[5]} →</em></button>`).join('')}</div>`}

/* ---------- СЕГОДНЯ ---------- */
function vToday(){const t=today(),h=new Date().getHours(),dr=dayRec(t),H=hero(),md=mood(),q=quests(),qd=q.filter(x=>x.done).length;
  let o=`<div class="hd">${av(md[0])}<div class="t"><b>${h<11?'Доброе утро!':h<18?'Сегодня':'Вечер'}</b><small>${WD[new Date().getDay()]}, ${new Date().getDate()} ${MON[new Date().getMonth()]} · Ур. ${H.lvl} ${H.name}</small></div><button class="chip" data-act="go" data-v="me">🔥 ${streak()}</button></div><div class="say">${esc(md[1])}</div>`+vPulse()+`<div class="tgrid"><aside class="rail">`+vWeekendCard()+vNags()+vCont()+quoteCard()+`</aside><div class="tcols"><div>`;
  if(!dr.planned&&!dr.closed&&h<14){const sg=suggestTop3();S.plan=S.plan||sg;
    o+=`<section class="plan"><h3>Спланируем день?</h3><p>Я подобрал 3 главных. Убери лишнее или выбери другое.</p>${S.plan.map((x,i)=>`<div class="pick"><span class="t">${esc(x.t)}</span><em>${esc(x.why||'')}</em><button class="x" data-act="planDel" data-i="${i}">✕</button></div>`).join('')}${S.plan.length<3?`<button class="pick add" data-act="planAdd">＋ добавить</button>`:''}<img src="char/p_wave.png" alt=""></section><button class="btn" data-act="planGo">Погнали →</button>`}
  else if((dr.top3||[]).length){o+=vTop3(dr)}
  o+=lbl('Задания дня',`🎁 ${qd}/3`);o+=`<div class="q3">${q.map((x,i)=>`<button class="q ${x.done?'ok':''}" data-act="quest" data-i="${i}"><b>${x.t}</b>${esc(x.s)}</button>`).join('')}</div><div class="chest"><div class="bar"><i style="width:${qd/3*100}%"></i></div></div>`;
  const ms=todayMeetings(),now=new Date();
  if(ms.length){const mins=ms.reduce((a,m)=>a+((new Date(m.end_at)-new Date(m.start_at))/6e4||0),0),nx=ms.find(m=>new Date(m.end_at)>now);
    o+=lbl('Встречи',`${ms.length} · ${Math.floor(mins/60)} ч ${Math.round(mins%60)} м`);o+=`<div class="mt">${ms.map(m=>{const past=new Date(m.end_at)<now;return `<button class="m ${past?'past':''}" data-act="meet" data-id="${m.id}"><span class="tm">${hm(m.start_at)}</span><span class="t">${esc(m.title)}<small>${m.summary?'резюме готово ✓':past?'нужно резюме':esc(m.people||'')}</small></span>${!past?`<span class="tag ${m===nx?'now':''}">Подготовка</span>`:m.summary?'':'<span class="tag">Резюме</span>'}</button>`}).join('')}</div>`}
  else o+=lbl('Встречи','+ добавить','data-act="addMeet"')+`<p class="empty">Встреч нет — или ещё не подтянулись (08:00 и 13:00)</p>`;
  o+='</div><div>';const f=feed();o+=lbl('Лента дня',f.length?String(f.length):'');
  o+=f.length?f.map(x=>blk(x.od?'r':x.c,x.kind==='task'?'💼':x.c==='l'?'⏳':'🤝',esc(x.t)+(x.od?`<span class="od">−${x.od} дн</span>`:''),esc(x.sub),`<button class="ck" data-act="${x.kind==='task'?'taskDone':'promDone'}" data-id="${esc(x.id)}"></button>`,`data-act="${x.kind==='task'?'taskOpen':'promOpen'}" data-id="${esc(x.id)}"`)).join(''):'<p class="empty">На сегодня дедлайнов и обещаний нет 👌</p>';
  if((h>=18||dr.planned)&&!dr.closed)o+=`<button class="btn ${night()?'':'g'}" data-act="go" data-v="close" style="margin-top:14px">🌙 Закрыть день</button>`;
  if(dr.closed)o+=`<p class="empty">День закрыт ✓ ${esc(dr.note||'')}</p>`;
  const rd=(D.queue||[]).filter(x=>x.status==='done'&&Date.now()-new Date(x.done_at||x.updated_at)<48*36e5).slice(0,2);
  if(rd.length)o+=lbl('Ответы агентов')+rd.map(x=>blk('ac','🤖',esc(x.agent+' · '+(x.title||'')),esc((x.result||'').slice(0,80)),'',`data-act="qOpen" data-id="${x.id}"`)).join('');
  return o+'</div></div></div>'}
function vClose(){const t=today(),dr=dayRec(t),w=weekStats(0),fm=(D.focus||[]).filter(f=>f.day===t).reduce((a,f)=>a+f.minutes,0),xp=hero().m[t]||0,tails=(dr.top3||[]).filter(x=>!top3Done(x));
  let o=back('today','Сегодня')+`<div class="hd">${av('f_proud')}<div class="t"><b>Закроем день?</b><small>2 минуты · +30 XP за итог</small></div><span class="chip">🔥 ${streak()}</span></div>`;
  o+=`<div class="sum"><div><b>${(dr.top3||[]).filter(top3Done).length}/${(dr.top3||[]).length||0}</b><small>главных</small></div><div><b>${Math.floor(fm/60)} ч ${fm%60}</b><small>фокус</small></div><div><b>+${xp}</b><small>XP</small></div></div>`;
  if(tails.length)o+=lbl('Хвосты','всё → '+nxLbl(),'data-act="tailsAll"')+tails.map((x,i)=>`<div class="mv"><span class="t">${esc(x.t)}</span><button class="x" data-act="tail" data-i="${i}">→ ${nxLbl()}</button></div>`).join('');
  o+=lbl('Одна строка в журнал')+`<textarea class="inp" id="jNote" rows="2" placeholder="Сегодня главное: …">${esc(dr.note||'')}</textarea>`;
  const tm=dayRec(nxDay(t)).top3||[];o+=lbl(dow(t)===5?'Понедельник':'Завтра',`${tm.length}/3`)+tm.map(x=>`<div class="mv"><span class="t">${esc(x.t)}</span></div>`).join('')+(tm.length<3?`<input class="inp" id="tmNew" placeholder="Добавить главное на завтра и Enter">`:'');
  o+=`<button class="btn" data-act="closeDay" style="margin-top:14px">Закрыть день 🌙</button>`;return o}

/* ---------- ВСТРЕЧА ---------- */
function vMeet(){const m=(D.meetings||[]).find(x=>x.id===S.mid);if(!m)return back('today','Сегодня')+'<p class="empty">Встреча не найдена</p>';const tab=S.mtab||(new Date(m.end_at)<new Date()?'after':'before');
  const ppl=String(m.people||'').split(',').map(s=>s.trim()).filter(Boolean),fn=ppl.map(p=>fname(p).toLowerCase());
  const pr=(D.promises||[]).filter(p=>p.status!=='Сделано'&&p.person&&fn.some(n=>n&&p.person.toLowerCase().includes(n)));
  const dec=(D.dec||[]).filter(d=>d.status!=='Сделано'&&(m.epic_id?d.epic_id===m.epic_id:fn.some(n=>n&&String(d.owner||'').toLowerCase().includes(n)))).slice(0,6);
  let o=back('today','Сегодня')+`<section class="mh"><small>${hm(m.start_at)}–${hm(m.end_at)}${m.epic_id?' · '+esc(m.epic_id):''}</small><h3>${esc(m.title)}</h3><div class="ppl">${ppl.slice(0,6).map(p=>`<i>${esc(fname(p)[0]||'?')}</i>`).join('')}</div></section>`;
  o+=seg([['before','До встречи'],['after','После']],tab,'mtab');
  if(tab==='before'){o+=card('🤝 Обещания участникам',pr.map(p=>`<div class="li">${esc(p.person)} — ${esc(p.what)}${p.due?` <span class="sub">до ${short(p.due)}</span>`:''}</div>`).join('')||'<p class="empty">Нет открытых обещаний</p>');
    o+=card('📌 Открытые решения',dec.map(d=>`<div class="li">${esc(d.action_item||d.decision)} — ${esc(fname(d.owner))}${d.due&&d.due<today()?' <span class="od">просрочено</span>':''}</div>`).join('')||'<p class="empty">Нет открытых решений</p>');
    o+=card('✨ Подготовка',m.prep?`<div class="pre">${esc(m.prep)}</div>`:'<p class="empty">Ещё нет — попроси Секретаря</p>')+`<button class="btn" data-act="meetPrep">✨ ${m.prep?'Обновить':'Собрать'} подготовку · Секретарь</button>`}
  else o+=card('📝 Резюме',`<textarea class="inp" id="mSum" rows="7" placeholder="Что решили, кто что делает, сроки. Можно надиктовать или вставить транскрипт">${esc(m.summary||'')}</textarea><div class="two"><button class="btn g" data-act="voice" data-t="mSum">🎙 Надиктовать</button><button class="btn" data-act="meetSum">Сохранить → Секретарь</button></div><small class="sub">Секретарь разложит решения, задачи и обещания — подтвердишь в чате</small>`);
  return o}

/* ---------- ФОКУС ---------- */
function focusStart(title,ref){S.focus={title,ref,min:LS.get('fmin',25),start:Date.now(),pause:0};LS.set('focus',S.focus);renderFocus()}
function renderFocus(){const f=S.focus,el=$('#focus');if(!f){el.hidden=true;return}el.hidden=false;const left=Math.max(0,f.min*60-Math.floor(((f.paused||Date.now())-f.start)/1000)),L=722,p=left/(f.min*60);
  el.innerHTML=`<small>Фокус</small><h3>${esc(f.title)}</h3><div class="ring"><svg width="250" height="250" viewBox="0 0 250 250"><circle cx="125" cy="125" r="115" class="rb"/><circle cx="125" cy="125" r="115" class="rf" style="stroke-dasharray:${L};stroke-dashoffset:${L*(1-p)}"/></svg><div class="mid"><b>${pad(Math.floor(left/60))}:${pad(left%60)}</b><small>из ${f.min} минут</small></div></div><img class="kid" src="char/p_laptop.png" alt=""><div class="mins">${[15,25,50,90].map(n=>`<button class="${n===f.min?'on':''}" data-act="fmin" data-n="${n}">${n}</button>`).join('')}</div><div class="two"><button class="btn g" data-act="fpause">${f.paused?'Дальше':'Пауза'}</button><button class="btn" data-act="fdone">Готово ✓</button></div><button class="lk" data-act="fstop" style="margin-top:12px">Закрыть без записи</button>`;
  if(left===0&&!f.rang){f.rang=true;try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}toast('⏰ Время! Записать?')}}
setInterval(()=>{if(S.focus&&!S.focus.paused)renderFocus()},1000);

/* ---------- РАБОТА ---------- */
function epicStat(e){const t=today(),ts=(D.tasks||[]).filter(x=>x.epic_id===e.id),op=ts.filter(openT),dn=ts.filter(x=>x.status==='Готово'),od=op.filter(x=>x.dl&&x.dl<t),soon=op.filter(x=>x.dl&&x.dl>=t&&x.dl<=addDays(t,3));
  const rate=dn.filter(x=>{const d=fromRu(x.updated);return d&&d>=addDays(t,-14)}).length/2,last=ts.map(x=>fromRu(x.updated)).filter(Boolean).sort().pop()||'',idle=last?Math.round((new Date(t)-new Date(last))/864e5):99;
  const eta=op.length?(rate>0?addDays(t,Math.ceil(op.length/rate*7)):null):t,maxDl=op.map(x=>x.dl).filter(Boolean).sort().pop()||'';
  return {ts,op,dn,od,soon,rate,idle,eta,maxDl,p:ts.length?dn.length/ts.length:0,risk:od.length>0||(op.length&&idle>=7)||(eta&&maxDl&&eta>maxDl)}}
function vWork(){const t=today(),E=(D.epics||[]).filter(e=>e.status!=='Закрыт'),P={P1:1,P2:2,P3:3},all=(D.tasks||[]).filter(openT);
  const st=E.map(e=>[e,epicStat(e)]).sort((a,b)=>(P[a[0].priority]||2)-(P[b[0].priority]||2)||(b[1].od.length-a[1].od.length)||(b[1].risk-a[1].risk));
  if(desk()&&!st.some(x=>x[0].id===S.eid)&&st.length)S.eid=st[0][0].id;
  let o=`<div class="ttl">Работа</div>${wkend()?'<div class="wk" style="margin:8px 0 0"><b>Выходной 🏖</b><p>Можно посмотреть, но лучше вернуться в понедельник.</p></div>':''}<div class="sub">${E.length} ${plural(E.length,'эпик','эпика','эпиков')} · P1: ${E.filter(e=>e.priority==='P1').length}</div>`;
  o+=`<div class="t3"><div class="r"><b>${all.filter(x=>x.dl&&x.dl<t).length}</b><small>просрочено</small></div><div class="y"><b>${all.filter(x=>x.dl&&x.dl>=t&&x.dl<=addDays(t,3)).length}</b><small>DL ≤ 3 дней</small></div><div class="${st.filter(x=>x[1].risk).length?'y':'g'}"><b>${st.filter(x=>x[1].risk).length}</b><small>эпиков в риске</small></div></div>`;
  const ms=todayMeetings();if(ms.length){const mins=ms.reduce((a,m)=>a+((new Date(m.end_at)-new Date(m.start_at))/6e4||0),0);o+=`<div class="ml">📅 Встречи сегодня ${ms.length} · ${Math.floor(mins/60)} ч ${Math.round(mins%60)} м<div class="bar"><i style="width:${Math.min(100,mins/480*100)}%"></i></div>${Math.round(mins/480*100)}%</div>`}
  o+=lbl('Эпики','по важности')+st.map(([e,s])=>{const c=s.od.length?'r':s.risk?'l':'z';return `<button class="ep${desk()&&e.id===S.eid?' sel':''}" style="--c:var(--${c})" data-act="epic" data-id="${e.id}"><div class="h"><span class="id">${e.id}</span><b>${esc(e.name)}</b><span class="pr ${e.priority==='P1'?'':'g'}">${e.priority||'P2'}</span></div>${e.goal?`<p>${esc(e.goal)}</p>`:''}<div class="pg"><div class="bar"><i style="width:${s.p*100}%;background:var(--${c})"></i></div>${s.dn.length}/${s.ts.length}${s.op.length?(s.eta?' · ~'+short(s.eta):' · темп 0'):''}</div><div class="tags">${s.od.length?`<span class="tg r">${s.od.length} просрочено · ${esc([...new Set(s.od.map(x=>fname(x.owner)))].join(', '))}</span>`:''}${s.soon.length?`<span class="tg y">${s.soon.length} DL ≤ 3 дн</span>`:''}${s.op.length&&s.idle>=7?`<span class="tg y">стоит ${s.idle} дн</span>`:''}${!s.od.length&&!s.soon.length&&!(s.op.length&&s.idle>=7)?'<span class="tg g">в сроке</span>':''}</div></button>`}).join('');
  const ne=all.filter(x=>!x.epic_id);if(ne.length)o+=lbl('Вне эпиков',String(ne.length))+ne.map(x=>`<button class="ep" style="--c:var(--mu)" data-act="taskOpen" data-id="${x.id}"><div class="h"><b>${esc(x.id+' '+x.title)}</b><span class="dl ${x.dl&&x.dl<=t?'y':''}">${x.dl?short(x.dl):''}</span></div><p>${esc(x.owner||'')} · к какой цели? → Стратег</p></button>`).join('');
  o+=`<div class="two"><button class="btn g" data-act="ai" data-a="Стратег" data-t="Разобрать просьбу">💬 Разобрать просьбу</button><button class="btn" data-act="ai" data-a="Стратег" data-t="Апдейт по эпикам">📊 Апдейт по эпикам</button></div>`;
  if(desk()){return `<div class="wsplit"><div class="wl">${o}</div><div class="wr">${S.eid?vEpic():'<p class="empty">Выбери эпик</p>'}</div></div>`}
  return o}
function vEpic(){const e=(D.epics||[]).find(x=>x.id===S.eid);if(!e)return back('work','Работа');const s=epicStat(e),t=today();
  let o=back('work','Работа')+`<div class="row1"><div><div class="sub">${e.id}${e.stream?' · '+esc(e.stream):''}</div><div class="ttl" style="font-size:21px">${esc(e.name)}</div></div><button class="pr big" data-act="epicPri">${e.priority||'P2'}</button></div>`;
  o+=`<button class="goalb" data-act="epicGoal"><small>ЗАЧЕМ ЭТОТ ЭПИК · нажми, чтобы изменить</small>${esc(e.goal||'Цель не задана — впиши')}${e.metric?`<span>Метрика: ${esc(e.metric)}${e.was?' · было '+esc(e.was):''}${e.now?' · сейчас '+esc(e.now):''}${e.target?' · цель '+esc(e.target):''}</span>`:''}</button>`;
  o+=`<section class="card"><div class="pg"><div class="bar"><i style="width:${s.p*100}%"></i></div>${s.dn.length} из ${s.ts.length}</div><div class="fc"><span>Темп ${String(s.rate).replace('.',',')} задачи/нед</span><span>${s.op.length?(s.eta?`Закроется <b class="${s.maxDl&&s.eta>s.maxDl?'bad':''}">~${short(s.eta)}</b>`:'прогноза нет'):'<b>всё закрыто</b>'}${s.maxDl?' · DL '+short(s.maxDl):''}</span></div></section>`;
  const by={};s.op.forEach(x=>{const k=x.owner||'Без ответственного';(by[k]=by[k]||[]).push(x)});
  o+=`<section class="card">${Object.keys(by).sort((a,b)=>by[b].filter(x=>x.dl&&x.dl<t).length-by[a].filter(x=>x.dl&&x.dl<t).length).map(p=>{const odn=by[p].filter(x=>x.dl&&x.dl<t).length;return `<div class="who"><span class="ava">${esc(fname(p)[0]||'?')}</span><b>${esc(p)}</b>${odn?` · <span class="red">${odn} просрочено</span>`:''}</div>`+by[p].sort((a,b)=>(a.dl||'9')<(b.dl||'9')?-1:1).map(x=>`<div class="tk"><button class="t" data-act="taskOpen" data-id="${x.id}">${esc(x.id+' '+x.title)}<small>${esc(x.status)}${x.dl_moves?' · переносов '+x.dl_moves:''}</small></button><span class="dl ${x.dl&&x.dl<t?'r':x.dl&&x.dl<=addDays(t,3)?'y':''}">${x.dl?short(x.dl):'—'}</span>${isMine(x)?`<button class="png" data-act="focus" data-t="${esc(x.id+' '+x.title)}">▶</button>`:`<button class="png" data-act="ping" data-id="${x.id}">🔔</button>`}</div>`).join('')}).join('')||'<p class="empty">Открытых задач нет</p>'}</section>`;
  o+=`<div class="two"><button class="btn g" data-act="ai" data-a="Стратег" data-t="Новая задача в ${e.id}">+ Задача</button><button class="btn" data-act="ai" data-a="Стратег" data-t="Апдейт по ${e.id}">📊 Апдейт</button></div>`;return o}

/* ---------- ЦЕЛИ ---------- */
function vGoals(){if(desk())return `<div class="ttl">Цели</div><div class="gcols"><div><div class="lbl">🎬 Блог</div>${gBlog()}</div><div><div class="lbl">💸 Бизнес</div>${gBiz()}</div><div><div class="lbl">🌿 Личное</div>${gLife()}</div></div>`;
  const g=S.goals||'blog';let o=`<div class="ttl">Цели</div>`+seg([['blog','🎬 Блог'],['biz','💸 Бизнес'],['life','🌿 Личное']],g,'goals');return o+({blog:gBlog,biz:gBiz,life:gLife}[g])()}
function gBlog(){const m=(D.metrics||[]).filter(x=>x.followers),last=m.length?+m[m.length-1].followers:0,prev=m.length>1?+m[m.length-2].followers:last,g=C.GOALS.find(x=>last<x[0])||C.GOALS[1],days=Math.max(1,Math.ceil((new Date(g[1]+'T23:59:59')-new Date())/864e5));
  const pts=m.slice(-10).map(x=>+x.followers),mn=Math.min(...pts,last),mx=Math.max(...pts,last+1),pl=pts.map((v,i)=>`${i*(110/Math.max(1,pts.length-1))},${38-(v-mn)/(mx-mn)*34}`).join(' ');
  let o=`<section class="goal" style="--g1:var(--bs);--g2:var(--acs)"><small>Подписчики @krmovy · сегодня</small><div class="big">${last.toLocaleString('ru')} <span>/ ${g[0].toLocaleString('ru')}</span></div>${pts.length>1?`<svg class="spark" viewBox="0 0 110 40"><polyline points="${pl}"/></svg>`:''}<div class="bar"><i style="width:${Math.min(100,last/g[0]*100)}%;background:var(--b)"></i></div><div class="ms"><span>${last-prev>=0?'+':''}${last-prev} с прошлого замера</span><span>нужно +${Math.max(0,Math.ceil((g[0]-last)/days))}/день · до ${short(g[1])}</span></div></section>`;
  const tab=S.blogTab||'shoot';o+=seg([['shoot','К съёмке'],['finds','Находки'],['hits','Залёты']],tab,'blogTab');
  if(tab==='shoot'){const L=(D.ideas||[]).filter(i=>ist(i)!=='Вышел').sort((a,b)=>IDEA_FLOW.indexOf(ist(b))-IDEA_FLOW.indexOf(ist(a)));
    o+=`<button class="btn g" data-act="ideaNew" style="margin-top:12px">＋ Новая идея</button>`+L.slice(0,25).map(i=>{const s=ist(i),cl={Идея:'',Пишу:'s2',Готов:'s2',Снимаю:'s3',Снято:'s1',Монтаж:'s1'}[s];return `<button class="vd" data-act="idea" data-id="${i.id}"><div class="th">${{Идея:'💡',Пишу:'📝',Готов:'✅',Снимаю:'🎥',Снято:'🎞',Монтаж:'✂️'}[s]||'💡'}</div><div class="t"><b>${esc(i.title)}</b><small>${i.hook?'Хук: '+esc(i.hook.slice(0,50)):esc(i.source||'')}</small></div><span class="st ${cl}">${s}</span></button>`}).join('')||'<p class="empty">Идей нет</p>'}
  if(tab==='finds')o+=(D.finds||[]).filter(f=>f.decision!=='Убрано'&&f.decision!=='В банк').slice(0,15).map(f=>`<section class="fd"><div class="top"><span>${esc(f.author||'')} · ${esc(f.platform||'')}${f.views?' · '+fmtN(f.views):''}</span>${f.x_norm?`<span class="x">×${Math.round(f.x_norm)}</span>`:''}</div><b>${esc(f.title||'')}</b><p>${esc(f.why||'')}${f.adapt?' Тебе: '+esc(f.adapt):''}</p><div class="two"><button class="btn" data-act="findScript" data-id="${f.id}">✨ Сценарий</button><button class="btn g" data-act="findBank" data-id="${f.id}">В банк</button></div>${safeUrl(f.link)?`<a class="lk" href="${esc(safeUrl(f.link))}" target="_blank" rel="noopener">▶ оригинал</a>`:''}<button class="lk" data-act="findDrop" data-id="${f.id}">убрать</button></section>`).join('')||'<p class="empty">Новых находок нет — придут утром</p>';
  if(tab==='hits')o+=(D.reels||[]).slice(0,15).map(r=>`<div class="vd"><div class="th">${(r.views||0)>10000?'🔥':'🎬'}</div><div class="t"><b>${esc(r.title||'Ролик')}</b><small>${fmtN(r.views||0)} просм.${r.saves?' · '+r.saves+' сохр.':''}${r.why?' · '+esc(r.why.slice(0,60)):''}</small></div>${safeUrl(r.link)?`<a class="st" href="${esc(safeUrl(r.link))}" target="_blank" rel="noopener">▶</a>`:''}</div>`).join('');
  return o}
const fmtN=n=>n>=1e6?(n/1e6).toFixed(1).replace('.0','')+'M':n>=1e3?Math.round(n/1e3)+'K':String(n);
function vIdea(){const i=(D.ideas||[]).find(x=>x.id===S.iid);if(!i)return back('goals','Блог');const s=ist(i),k=IDEA_FLOW.indexOf(s);const h=i.hook_code&&(S.hooks||[]).find(x=>x.code===i.hook_code);
  let o=back('goals','Блог')+`<input class="ttl inp2" id="iTitle" value="${esc(i.title)}">`;
  o+=`<div class="steps">${IDEA_FLOW.map((x,j)=>`<button class="${j<k?'ok':j===k?'cur':''}" data-act="ideaSt" data-s="${x}"><i></i>${x}</button>`).join('')}</div>`;
  o+=`<section class="hk"><small>ХУК${i.hook_code?' · '+esc(i.hook_code):''}${h?' · '+esc(h.category):''}</small><textarea class="hkt" id="iHook" rows="2" placeholder="Первая фраза — 2 секунды, чтобы не пролистали">${esc(i.hook||'')}</textarea><div class="row2"><button data-act="hooks">🔁 Из 300</button>${h&&h.example?`<a href="${esc(h.example)}" target="_blank" rel="noopener">▶ Пример</a>`:''}<button data-act="ai" data-a="Сценарист" data-t="5 хуков: ${esc(i.title)}">✨ 5 вариантов</button></div></section>`;
  o+=`<textarea class="ed" id="iScript" rows="12" placeholder="Сценарий по таймкодам: 0–2 сек хук, 3–15 сек…">${esc(i.script||i.notes||'')}</textarea>`;
  o+=`<div class="two"><button class="btn" data-act="ai" data-a="Сценарист" data-t="Доработать сценарий: ${esc(i.title)}" data-ref="${i.id}">✨ Доработать с Claude</button><button class="btn g" data-act="ai" data-a="Монтажёр" data-t="Шотлист: ${esc(i.title)}" data-ref="${i.id}">🎬 Шотлист</button></div><button class="btn g" data-act="ideaSave" style="margin-top:8px">Сохранить</button>`;
  if(safeUrl(i.ref))o+=`<a class="lk" href="${esc(safeUrl(i.ref))}" target="_blank" rel="noopener">▶ Референс</a>`;return o}
function gBiz(){const hb=Math.max(0,...(D.habits||[]).map(h=>+h.step_biz||0)),st=Math.min(hb,12),m0=today().slice(0,7),paid=(D.clients||[]).filter(c=>c.stage==='Оплатил'),month=paid.filter(c=>String(c.touched||'').slice(0,7)===m0).reduce((a,c)=>a+(+c.amount||0),0);
  let o=`<section class="goal" style="--g1:var(--zs);--g2:var(--ls)"><small>Первая оплата за ИИ-видео · до ${short(C.BIZ_DL)}</small><div class="big">${paid.length?'✓':st} <span>${paid.length?'оплата получена':'/ 12 шагов'}</span></div><div class="lad">${LADDER.map((x,j)=>`<span class="${j<st?'ok':j===st?'cur':''}">${j+1}</span>`).join('')}</div>${st<12?`<div class="ms"><span>Дальше: ${esc(LADDER[st])} · 15 мин</span><button class="lk" data-act="bizStep">✓ сделал</button></div>`:''}</section>`;
  o+=`<section class="card"><div class="ms" style="margin:0"><span>Доход за месяц</span><b>${month.toLocaleString('ru')} ₸ / ${C.BIZ_GOAL.toLocaleString('ru')}</b></div><div class="bar"><i style="width:${Math.min(100,month/C.BIZ_GOAL*100)}%;background:var(--z)"></i></div></section>`;
  const cl=D.clients||[];o+=lbl('Воронка',`${cl.filter(c=>c.stage!=='Отказ').length}`,'')+`<div class="kb">${CL_ST.slice(0,5).map(s=>`<div class="kc"><b>${s} ${cl.filter(c=>(c.stage||'Найден')===s).length}</b>${cl.filter(c=>(c.stage||'Найден')===s).slice(0,4).map(c=>`<button data-act="clNext" data-id="${c.id}">${esc(c.company)}</button>`).join('')}</div>`).join('')}</div><button class="btn g" data-act="clNew" style="margin-top:8px">＋ Клиент</button>`;
  o+=lbl('Гипотезы','＋','data-act="hypNew"')+((D.hyp||[]).map(h=>`<section class="card"><b>${esc(h.title)}</b><div class="sub">${esc(h.status||'Идея')}${h.test?' · '+esc(h.test):''}${h.result?' · '+esc(h.result):''}</div></section>`).join('')||'<p class="empty">Гипотез нет</p>');
  o+=`<div class="two"><button class="btn g" data-act="ai" data-a="Продажник" data-t="Сообщение компании">✉️ Сообщение</button><button class="btn" data-act="ai" data-a="Продажник" data-t="КП с ценой">📄 КП</button></div>`;return o}
function gLife(){const t=today(),G=(D.quests||[]).filter(q=>q.sphere==='Личная жизнь'&&['Босс','Эпик'].includes(q.kind));
  let o=lbl('Цели квартала','до 28.02')+`<section class="card">${G.map(q=>`<div class="lr"><button class="ck ${q.status==='Готово'?'on':''}" data-act="qDone" data-id="${q.id}">${q.status==='Готово'?'✓':''}</button><span class="t">${esc(q.title)}<small>${esc(q.status||'В плане')}${q.due?' · до '+short(q.due):''}</small></span></div>`).join('')||'<p class="empty">Целей нет</p>'}</section>`;
  const hd=D.hdefs||[],hm2=D.hmarks||[];o+=lbl('Привычки','＋','data-act="habitNew"')+`<section class="card">${hd.map(h=>`<div class="lr"><span class="t">${esc((h.emoji||'')+' '+h.name)}</span><span class="dots">${[6,5,4,3,2,1].map(n=>`<i class="${hm2.some(m=>m.habit_id===h.id&&m.day===addDays(t,-n))?'on':''}"></i>`).join('')}</span><button class="ck ${hm2.some(m=>m.habit_id===h.id&&m.day===t)?'on':''}" data-act="habit" data-id="${h.id}">${hm2.some(m=>m.habit_id===h.id&&m.day===t)?'✓':''}</button></div>`).join('')||'<p class="empty">Добавь привычку</p>'}</section>`;
  const M=D.money||[],save=M.filter(x=>x.kind==='save').reduce((a,x)=>a+(+x.amount),0),goal=+((M.filter(x=>x.kind==='goal_save').pop()||{}).amount||0),m0=t.slice(0,7),spend=M.filter(x=>x.kind==='spend'&&String(x.day).slice(0,7)===m0).reduce((a,x)=>a+(+x.amount),0),budget=+((M.filter(x=>x.kind==='budget').pop()||{}).amount||0);
  o+=lbl('Деньги',MON[new Date().getMonth()])+`<div class="money"><button class="mo" data-act="money" data-k="save"><small>Подушка</small><b>${save.toLocaleString('ru')} ₸</b><small>${goal?'цель '+goal.toLocaleString('ru'):'задать цель'}</small>${goal?`<div class="bar"><i style="width:${Math.min(100,save/goal*100)}%;background:var(--l)"></i></div>`:''}</button><button class="mo" data-act="money" data-k="spend"><small>Потрачено</small><b>${spend.toLocaleString('ru')} ₸</b><small>${budget?'бюджет '+budget.toLocaleString('ru'):'задать бюджет'}</small>${budget?`<div class="bar"><i style="width:${Math.min(100,spend/budget*100)}%;background:${spend>budget?'var(--r)':'var(--l)'}"></i></div>`:''}</button></div><div class="two"><button class="lk" data-act="moneyGoal" data-k="goal_save">цель подушки</button><button class="lk" data-act="moneyGoal" data-k="budget">бюджет месяца</button></div>`;
  return o}

/* ---------- Я ---------- */
function vMe(){const H=hero(),a=weekStats(0),b=weekStats(1),sk=streak(),frz=Math.floor(sk/7)-(D.days||[]).filter(d=>d.freeze_used).length;
  let o=`<section class="me"><div class="lv">${H.name} · Ур. ${H.lvl}<small>${H.xp} XP · ещё ${250-H.in} до «${H.next}»</small></div><div class="xp"><i style="width:${H.in/250*100}%"></i></div><img src="char/p_${S.win&&Date.now()-S.win<8000?'yay':'stand'}.png" alt=""></section>`;
  o+=lbl('Эта неделя vs прошлая',a.xp>=b.xp?'ты впереди 🎉':'догоняй себя')+`<div class="vs"><div class="${a.xp>=b.xp?'win':''}"><b>${a.xp}</b><small>XP эта</small></div><em>vs</em><div><b>${b.xp}</b><small>XP прошлая</small></div></div>`;
  const row=(n,x,y,f)=>`<div class="vr"><span>${n}</span><span class="${x>y?'u':x<y?'d':''}">${f(x)} vs ${f(y)} ${x>y?'↑':x<y?'↓':''}</span></div>`;
  o+=`<section class="card">${row('Закрытые дни',a.closed,b.closed,v=>v)}${row('Фокус',a.focus,b.focus,v=>Math.round(v/60)+' ч')}${row('Вышло роликов',a.vids,b.vids,v=>v)}</section>`;
  o+=`<div class="frz"><b>🔥 ${sk}</b><div>${plural(sk,'день','дня','дней')} подряд<small>🧊 заморозок: ${Math.max(0,frz)} · даётся за каждые 7 дней</small></div>${frz>0&&!dayRec(addDays(today(),-1)).closed?`<button class="lk" data-act="freeze">заморозить вчера</button>`:''}</div>`;
  o+=lbl('Награды',`${H.coins} монет`)+`<div class="rw">${(D.shop||[]).map(s=>`<button data-act="buy" data-id="${s.id}" class="${s.bought?'got':''}"><b>🎁</b><strong>${esc(s.title)}</strong>${s.bought?'куплено':s.price+' монет'}</button>`).join('')}<button data-act="rewardNew"><b>＋</b><strong>Своя награда</strong>придумай</button></div>`;
  o+=lbl('Ачивки',`${(D.ach||[]).filter(a=>a.unlocked).length}/${(D.ach||[]).length}`)+`<div class="rw">${(D.ach||[]).map(x=>`<div class="${x.unlocked?'got':'off'}"><b>${x.unlocked?'🏅':'🔒'}</b><strong>${esc(x.title)}</strong>${esc(x.how||'')}</div>`).join('')}</div>`;
  o+=`<button class="btn g" data-act="settings" style="margin-top:14px">⚙️ Настройки</button>`;return o}

/* ---------- шторки ---------- */
function openSheet(s){S.sheet=s;$('#sheetWrap').hidden=false;renderSheet()}
function closeSheet(){S.sheet=null;$('#sheetWrap').hidden=true}
function renderSheet(){const s=S.sheet;if(!s)return;let h='<div class="grab"></div>';
  if(s.type==='task'){const x=(D.tasks||[]).find(y=>y.id===s.id);if(!x)return closeSheet();const t=today(),cur=s.st||x.status,ep=(D.epics||[]).find(e=>e.id===x.epic_id),dd=x.dl?Math.round((new Date(x.dl)-new Date(t))/864e5):null;
    const dlt=x.dl?`DL ${short(x.dl)} · ${dd<0?'просрочено '+(-dd)+' дн':dd===0?'сегодня':dd===1?'завтра':'через '+dd+' '+plural(dd,'день','дня','дней')}`:'без срока',MAIN=['В работе','Блокер','Пауза','Готово'],more=s.more||!MAIN.includes(cur);
    h+=`<div class="tmeta"><span>${esc(x.id)}</span><span class="${dd!=null&&dd<0?'r':dd!=null&&dd<=2?'y':''}">${dlt}</span><span class="ep">${esc(x.epic_id||'вне эпика')}${ep?' · '+esc(ep.name):''}</span>${isMine(x)?'':`<span>${esc(fname(x.owner||'')||'—')}</span>`}</div><h2 class="tt">${esc(x.title)}</h2>`;
    {const hh=histHtml(x,4);if(hh)h+=`<div class="was"><small>ЧТО УЖЕ БЫЛО</small>${hh}</div>`}
    if((+x.dl_moves||0)>=3)h+=`<div class="stuck">🎯 Срок переносили ${x.dl_moves} раза — может, разбить на шаг поменьше? <button class="lk" data-act="ai" data-a="Стратег" data-t="Разбить ${esc(x.id)} на шаги">Разбить с Claude</button></div>`;
    h+=`<label>Что сделал?</label><textarea class="inp ta" id="tUpd" rows="3" placeholder="Коротко: что сдвинулось"></textarea>
    <label>Следующий шаг</label><input class="inp" id="tNext" value="${esc(x.next_step||'')}" placeholder="Что дальше и к какому числу">
    <label>Статус</label><div class="tseg">${MAIN.map(v=>`<button class="${cur===v?'on':''}" data-act="tSt" data-v="${v}">${v==='Готово'?'Готово ✓':v}</button>`).join('')}</div>
    ${more?`<div class="sts">${['Бэклог','Дискавери','Отменено'].map(v=>`<button class="${cur===v?'on':''}" data-act="tSt" data-v="${v}">${v}</button>`).join('')}</div>`:`<button class="lk" data-act="tMore" style="margin-top:6px;font-size:12px">ещё статусы</button>`}
    <button class="btn" data-act="tSave">Сохранить апдейт</button>
    <details class="tdet"><summary>Срок, ответственный, цель</summary>
    <label>Перенос DL · сейчас ${x.dl?toRu(x.dl):'—'} · переносов ${x.dl_moves||0}</label><div class="two"><input class="inp" type="date" id="tDl" value="${esc(x.dl||'')}"><input class="inp" id="tWhy" placeholder="Причина переноса"></div>
    <label>Ответственный</label><input class="inp" id="tOwner" value="${esc(x.owner||'')}">
    <label>Цель и логика</label>${x.goal?`<p class="sub" style="white-space:pre-wrap;margin:4px 0 0">${esc(x.goal)}</p>`:'<p class="sub" style="color:var(--r);margin:4px 0 0">Цели нет — попроси Стратега сформулировать по SMART</p>'}</details>
    <div class="tfoot">${isMine(x)?`<button class="lk" data-act="focus" data-t="${esc(x.id+' '+x.title)}" data-ref="${esc(x.id)}">▶ Фокус 25′</button>`:`<button class="lk" data-act="ping" data-id="${x.id}">🔔 Пинг</button>`}${safeUrl(x.link)?`<a class="lk" href="${esc(safeUrl(x.link))}" target="_blank" rel="noopener">Открыть ссылку</a>`:''}</div>`}
  else if(s.type==='prom'){const p=(D.promises||[]).find(y=>y.id===s.id);if(!p)return closeSheet();h+=`<div class="sub">${esc(p.direction||'')}</div><h2>${esc(p.what)}</h2><p class="sub">${esc(p.person||'')}${p.due?' · до '+toRu(p.due):''}</p><div class="two"><button class="btn g" data-act="promMove" data-id="${p.id}">→ завтра</button><button class="btn" data-act="promDone" data-id="${p.id}">Сделано ✓</button></div>`}
  else if(s.type==='hooks'){const cats=[...new Set((S.hooks||[]).map(x=>x.category))],c=s.cat||cats[0],L=(S.hooks||[]).filter(x=>x.category===c);
    h+=`<h2>Банк хуков · ${(S.hooks||[]).length}</h2><div class="chips">${cats.map(x=>`<button class="${x===c?'on':''}" data-act="hCat" data-v="${esc(x)}">${esc(x)} ${(S.hooks||[]).filter(y=>y.category===x).length}</button>`).join('')}<button class="${c==='mine'?'on':''}" data-act="hCat" data-v="mine">⭐ Мои залёты</button></div>`;
    h+=c==='mine'?(D.reels||[]).filter(r=>(r.views||0)>10000&&r.hook).map(r=>`<div class="hi"><code>⭐</code><button class="t" data-act="hookPick" data-text="${esc(r.hook)}">${esc(r.hook)}<small>${fmtN(r.views)} просм.</small></button></div>`).join('')||'<p class="empty">Пока нет</p>'
      :L.map(x=>`<div class="hi"><code>${esc(x.code)}</code><button class="t" data-act="hookPick" data-code="${esc(x.code)}">${esc(x.text)}</button>${x.example?`<a href="${esc(x.example)}" target="_blank" rel="noopener">▶</a>`:''}</div>`).join('')}
  else if(s.type==='add'){const ty=S.addType||'Задача';h+=`<h2>Быстрая запись</h2><textarea class="inp" id="addT" rows="3" placeholder="Что в голове?"></textarea><div class="chips"><button data-act="voice" data-t="addT">🎙 Голос</button>${['Задача','Обещание','Встреча','Идея ролика','Клиент','Журнал'].map(x=>`<button class="${ty===x?'on':''}" data-act="addType" data-v="${x}">${x}</button>`).join('')}</div>${ty==='Задача'?`<div class="chips">${[['РАБота','Работа'],['Popularity блог','Блог'],['Бизнес ИИ','Бизнес'],['Личная жизнь','Личное']].map(x=>`<button class="${(S.addSph||'Личная жизнь')===x[0]?'on':''}" data-act="addSph" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>`:''}${ty==='Обещание'?`<div class="two"><input class="inp" id="addWho" placeholder="Кому / кто"><input class="inp" type="date" id="addDue"></div><div class="chips">${['Я обещал','Мне обещали'].map(x=>`<button class="${(S.addDir||'Я обещал')===x?'on':''}" data-act="addDir" data-v="${x}">${x}</button>`).join('')}</div>`:''}${ty==='Встреча'?`<div class="two"><input class="inp" type="time" id="addTime"><input class="inp" id="addWho" placeholder="Участники"></div>`:''}<button class="btn" data-act="addSave">Сохранить</button>`}
  else if(s.type==='ai'){h+=`<span class="pill">${esc(s.a)}</span><h2>${esc(s.t)}</h2><textarea class="inp" id="aiT" rows="6" placeholder="Что нужно? Можно надиктовать"></textarea><div class="chips"><button data-act="voice" data-t="aiT">🎙 Надиктовать</button></div><button class="btn" data-act="aiSend">Отправить → ${esc(s.a)}</button><small class="sub">Открой чат «${esc(s.a)}» в проекте Мозг — он заберёт запрос, ответ вернётся сюда</small>`}
  else if(s.type==='queue'){const q=(D.queue||[]).find(x=>x.id===s.id);if(!q)return closeSheet();h+=`<span class="pill">${esc(q.agent)}</span><h2>${esc(q.title||'')}</h2>${q.result?`<div class="pre">${esc(q.result)}</div><button class="btn g" data-act="copy" data-id="${q.id}">Скопировать</button>`:'<p class="sub">Ждёт — открой чат агента в проекте Мозг</p>'}`}
  else if(s.type==='settings'){h+=`<h2>Настройки</h2><p class="sub">База: ${esc(S.auth&&S.auth.email||'')} · синхронизация ${S.syncedAt?new Date(S.syncedAt).toLocaleTimeString('ru'):'—'}</p><p class="sub">Сервер рабочей таблицы: ${S.conn?'подключён':'не подключён — изменения задач не сохранятся в таблицу'}</p>${S.conn?'':`<input class="inp" id="cUrl" placeholder="https://script.google.com/…/exec"><input class="inp" id="cKey" placeholder="Ключ приложения"><button class="btn g" data-act="connect">Подключить сервер</button>`}<button class="btn g" data-act="refresh">Обновить данные</button><a class="btn g" href="v2.html">Старая версия 2.0</a><button class="btn danger" data-act="logout">Выйти</button>`}
  $('#sheet').innerHTML=h}

/* ---------- рендер ---------- */
const VIEWS={today:vToday,close:vClose,meet:vMeet,work:vWork,epic:()=>desk()?vWork():vEpic(),goals:vGoals,idea:vIdea,me:()=>vMe()+vQuotes()};
const TAB={today:'today',close:'today',meet:'today',work:'work',epic:'work',goals:'goals',idea:'goals',me:'me'};
function render(){document.body.classList.toggle('dark',night());$('#view').dataset.v=S.view;
  if(!S.auth||S.needPass){$('#view').innerHTML=vLogin();$('#nav').hidden=true;return}$('#nav').hidden=false;
  const keep={};document.querySelectorAll('#view textarea,#view input').forEach(e=>{if(e.id&&e!==document.activeElement)keep[e.id]=e.value});const af=document.activeElement&&document.activeElement.id;
  if(af&&$('#view').contains(document.activeElement))return; // не мешаем печатать
  $('#view').innerHTML=(D.tasks?VIEWS[S.view]||vToday:()=>'<div class="loading"><img src="char/p_think.png" alt=""><p>Загружаю…</p></div>')();
  Object.keys(keep).forEach(id=>{const e=document.getElementById(id);if(e&&keep[id])e.value=keep[id]});
  document.querySelectorAll('#nav [data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v===TAB[S.view]));
  sideMe();if(S.sheet)renderSheet()}
function sideMe(){const el=$('#sme');if(!el||!desk()||!D.tasks)return;const H=hero();el.innerHTML=`<button class="smh" data-act="nav" data-v="me">${av(mood()[0])}<span><b>Ерназар</b><small>Ур. ${H.lvl} · ${H.name} · 🔥 ${streak()}</small></span></button><div class="xp"><i style="width:${H.in/250*100}%"></i></div><div class="xpn">ещё ${250-H.in} XP до «${esc(H.next)}»</div>`;const st=$('#sday');if(st){const [a,b]=xpT();st.innerHTML=`Сегодня<b>+${a} XP</b><span class="${a>=b?'u':'d'}">${a>=b?'↑ больше':'↓ меньше'}, чем вчера (${b})</span>`}}
function go(v){S.view=v;history.replaceState(null,'','#'+v);render();window.scrollTo(0,0)}
function celebrate(big){S.win=Date.now();const C2=['#6C5CE7','#C0569A','#3E9A63','#C2852F'];for(let i=0;i<(big?60:18);i++){const d=document.createElement('i');d.className='conf';d.style.left=(big?50:75)+'%';d.style.top=(big?35:20)+'%';d.style.background=C2[i%4];d.style.setProperty('--dx',(Math.random()*320-160)+'px');d.style.setProperty('--dy',(Math.random()*320+40)+'px');document.body.appendChild(d);setTimeout(()=>d.remove(),1500)}try{navigator.vibrate&&navigator.vibrate(big?[30,40,60]:20)}catch(e){}}
function levelCheck(){const l=hero().lvl,was=LS.get('lvl3',l);LS.set('lvl3',l);if(l>was){celebrate(true);const o=document.createElement('div');o.className='lvlup';o.innerHTML=`<div><img src="char/p_yay.png" alt=""><b>Новый уровень: ${LVN[Math.min(l-1,9)]}</b><small>Ур. ${l} · загляни в «Я» за наградой</small></div>`;o.onclick=()=>o.remove();document.body.appendChild(o);setTimeout(()=>o.remove(),4500)}
  const q=quests(),k='chest_'+today();if(q.every(x=>x.done)&&!LS.get(k,false)){LS.set(k,true);celebrate(true);toast('🎁 Все 3 задания! Сундук: +50 монет к серии')}}
function vLogin(){if(S.needPass)return `<div class="login"><img src="char/p_wave.png" alt=""><h2>Почта подтверждена ✓</h2><p class="sub">Задай пароль для входа (от 8 знаков)</p><input class="inp" id="lPass1" type="password" autocomplete="new-password" placeholder="Новый пароль"><button class="btn" data-act="setPass">Сохранить</button></div>`;
  return `<div class="login"><img src="char/p_wave.png" alt=""><h2>Мозг</h2><p class="sub">Вход в твою базу</p>${S.otp?`<p class="sub">Ссылка отправлена на ${esc(S.otp)} — открой на этом телефоне</p><button class="btn g" data-act="otpBack">Назад</button>`:`<input class="inp" id="lEmail" type="email" autocomplete="email" placeholder="Почта" value="${esc(LS.get('email',''))}"><input class="inp" id="lPass" type="password" autocomplete="current-password" placeholder="Пароль"><button class="btn" data-act="passLogin">Войти</button><button class="btn g" data-act="sendLink">Первый вход / забыл пароль</button>`}</div>`}
