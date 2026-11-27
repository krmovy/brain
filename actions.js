'use strict';
/* ===== Мозг 3.0 · действия (всё сохраняется сразу в базу; рабочая таблица — через сервер) ===== */
const guard=async(fn,ok)=>{try{await fn();if(ok)toast(ok)}catch(e){toast(errMsg(e));if(/row_not_found|row_ambiguous/.test(String(e&&e.message)))loadAll()}};
const val=id=>{const e=document.getElementById(id);return e?e.value.trim():''};
async function loadHooks(){if(!S.hooks)S.hooks=await sb('GET','hooks?select=*&order=category,code');return S.hooks}
function sortCode(a,b){const n=s=>+String(s).split('-')[1]||0;return n(a.code)-n(b.code)}

async function act(n,el){const d=el.dataset,t=today();
switch(n){
/* навигация */
case 'go':go(d.v);break;
case 'nav':go(d.v);break;
case 'close':closeSheet();break;
case 'refresh':toast('Обновляю…');closeSheet();loadAll();break;
case 'settings':openSheet({type:'settings'});break;
case 'goals':S.goals=d.v;render();break;
case 'goTo':S.goals=d.v;go('goals');break;
case 'nagLater':LS.set('nagSnooze',Date.now()+36e5);toast('Ок, напомню через час');render();break;
case 'nagMeet':S.mid=d.id;S.mtab='after';go('meet');break;
case 'nagTask':openSheet({type:'task',id:d.id});setTimeout(()=>{const x=$('#tUpd');if(x){x.focus();x.scrollIntoView({block:'center'})}},120);break;
case 'meetSkip':{const m=(D.meetings||[]).find(x=>x.id===d.id);if(!m)return;m.status='skip';render();await guard(()=>upd('meetings',m.id,{status:'skip'}),'Ок, без резюме');break}
case 'qFav':{const q=(D.quotes||[]).find(x=>x.id===d.id);if(!q)return;q.fav=!q.fav;render();await guard(()=>upd('quotes',q.id,{fav:q.fav}),q.fav?'♥ В любимых':'');break}
case 'wkMove':{if(!S.conn)return toast('Подключи сервер рабочей таблицы в ⚙️');const sat=addDays(t,1),sun=addDays(t,2),mon=addDays(t,3),L=myOpen().filter(x=>x.dl===sat||x.dl===sun);if(!L.length)return;
  await guard(async()=>{for(const x of L){const cells={J:toRu(mon),K:(+x.dl_moves||0)+1,M:`${short(t)}: DL ${toRu(x.dl)} → ${toRu(mon)}. Выходные`,Q:ru(new Date())};await setRow(C.SVC,'Задачи',{A:x.id},x.row_num,cells);Object.assign(x,{dl:mon,dl_moves:cells.K,week_upd:cells.M,updated:cells.Q});tlog(x.id,'dl','срок → '+cells.J+' · выходные')}},`Перенёс ${L.length} на понедельник ✓`);render();break}
case 'nudgeX':$('#nudge').hidden=true;break;
case 'planPush':{const x=(D.tasks||[]).find(y=>y.id===d.id);if(!x)return;const day=d.d==='0'?t:nxDay(t),dr=dayRec(day);dr.top3=dr.top3||[];if(dr.top3.some(y=>y.ref===x.id))return toast('Уже в плане');const main=dr.top3.filter(y=>!y.extra).length;
  dr.top3.push({kind:'task',ref:x.id,t:x.id+' '+x.title,why:'шаг: '+String(x.next_step||'').slice(0,40),extra:main>=3&&day===t});await guard(()=>upsertDay(day,{top3:dr.top3,planned:dr.planned||day===t}),day===t?'Добавил в план на сегодня ✓':'Добавил в план на '+(nxLbl()==='пн'?'понедельник':'завтра')+' ✓');render();break}
case 'findOpen':openSheet({type:'find',id:d.id});break;
case 'reelOpen':openSheet({type:'reel',id:d.id});break;
case 'reelAgain':{const r=(D.reels||[]).find(x=>x.id===d.id);if(!r)return;await guard(async()=>{const i=await ins('ideas',{title:'Ещё раз: '+(r.title||'залёт'),kind:'Идея',status:'Идея',source:'Повтор залёта',hook:r.hook||null,topic:r.topic||null,ref:safeUrl(r.link)||null,notes:'Повтор залёта ('+fmtN(r.views||0)+' просм.). '+(r.why||'')});
  await toAgent('Сценарист','Новая версия залёта: '+(r.title||''),`Мой ролик залетел: «${r.title||''}» (${r.link||''}), ${r.views||0} просмотров, ${r.saves||0} сохранений. Почему: ${r.why||'—'}.\nНапиши НОВУЮ версию с тем же механизмом, но другой темой/подачей. Формат: первая строка «~N с · тема · CTA …», потом «АКТ 1 — Название (0–10 с)» и кадры «1. …», реплики в «ёлочках», в конце КАДРЫ:/ЦВЕТ:/ЗВУК:. Запиши в ideas (id = ${i.id}): core (мысль 1–2 строки), hook, script, status = 'Готов'.`,'ideas',i.id);closeSheet();S.iid=i.id;go('idea')},'Создал идею и отправил Сценаристу ✓');break}
case 'actTog':{const x=+d.i,st=S.actOpen&&S.actOpen.set;if(!st)return;const k=st.indexOf(x);if(k>=0)st.splice(k,1);else st.push(x);render();break}
case 'coreEdit':{const i=(D.ideas||[]).find(x=>x.id===S.iid);const v=prompt('Мысль ролика — 1–2 строки: что зритель должен понять или почувствовать',i.core||'');if(v==null)return;i.core=v.trim();render();await guard(()=>upd('ideas',i.id,{core:i.core}),'Мысль сохранена ✓');break}
case 'iEdit':S.iedit=true;render();break;
case 'iEditDone':{const i=(D.ideas||[]).find(x=>x.id===S.iid);await guard(()=>saveIdea(i));S.iedit=false;S.actOpen=null;render();window.scrollTo(0,0);break}
case 'shootGo':{const i=(D.ideas||[]).find(x=>x.id===S.iid);if(!i)return;const L=shootBeats(i),dn=new Set(i.shot||[]);S.shoot={id:i.id,n:Math.max(0,L.findIndex(x=>!dn.has(x.k)))};renderShoot();
  if(IDEA_FLOW.indexOf(ist(i))<3){i.status='Снимаю';i.updated_at=new Date().toISOString();upd('ideas',i.id,{status:'Снимаю'}).catch(()=>{})}break}
case 'shootX':S.shoot=null;renderShoot();render();break;
case 'shootN':S.shoot.n+=+d.d;renderShoot();break;
case 'shootMark':{const i=(D.ideas||[]).find(x=>x.id===S.shoot.id),L=shootBeats(i),c=L[S.shoot.n];if(!c)return;const st=new Set(i.shot||[]);if(st.has(c.k))st.delete(c.k);else{st.add(c.k);if(S.shoot.n<L.length-1)S.shoot.n++}i.shot=[...st];renderShoot();try{navigator.vibrate&&navigator.vibrate(30)}catch(e){}
  await upd('ideas',i.id,{shot:i.shot}).catch(e=>toast(errMsg(e)));break}
case 'shootAll':{const i=(D.ideas||[]).find(x=>x.id===S.shoot.id);i.status='Снято';i.updated_at=new Date().toISOString();S.shoot=null;renderShoot();celebrate(true);render();await guard(()=>upd('ideas',i.id,{status:'Снято'}),'🎞 Всё снято! Дальше — монтаж');levelCheck();break}
case 'qTog':LS.set('qMin',!LS.get('qMin',false));render();break;
case 'nextOther':S.nxi=(S.nxi||0)+1;render();break;
case 'nextTake':{const x=(D.tasks||[]).find(y=>y.id===d.id);if(!x)return;const dr=dayRec(t);dr.top3=dr.top3||[];dr.top3.push({kind:'task',ref:x.id,t:x.id+' '+x.title,why:'сверх плана',extra:true});S.nxi=0;await guard(()=>upsertDay(t,{top3:dr.top3}));focusStart(x.id+' '+x.title,x.id);render();break}
case 'blogTab':S.blogTab=d.v;render();break;
case 'mtab':S.mtab=d.v;render();break;
case 'quest':{const q=quests()[+d.i];if(q.act==='meet'){S.mid=q.id;S.mtab='before';go('meet')}else if(q.act==='idea'&&q.id){S.iid=q.id;await loadHooks().catch(()=>{});go('idea')}else if(q.act==='goals'){S.goals=q.v;go('goals')}else go(q.v||'work');break}
/* план дня */
case 'planDel':S.plan.splice(+d.i,1);render();break;
case 'planAdd':{const x=prompt('Что ещё главное сегодня?');if(x)S.plan.push({kind:'text',ref:'t'+Date.now(),t:x.trim(),why:'своё'});render();break}
case 'planGo':await guard(()=>upsertDay(t,{top3:S.plan||[],planned:true}),'Погнали! 💪');S.plan=null;render();break;
case 'topDone':{const dr=dayRec(t),x=dr.top3[+d.i];if(x.kind==='task')return act('taskDone',{dataset:{id:x.ref}});if(x.kind==='prom')return act('promDone',{dataset:{id:x.ref}});if(x.kind==='idea'){S.iid=x.ref;await loadHooks().catch(()=>{});return go('idea')}x.done=!x.done;await guard(()=>upsertDay(t,{top3:dr.top3}));if(x.done)celebrate();render();break}
case 'topOpen':{const x=dayRec(t).top3[+d.i];if(x.kind==='task')openSheet({type:'task',id:x.ref});else if(x.kind==='idea'){S.iid=x.ref;await loadHooks().catch(()=>{});go('idea')}else if(x.kind==='prom')openSheet({type:'prom',id:x.ref});else focusStart(x.t,x.ref);break}
/* задачи (рабочая таблица) */
case 'taskOpen':openSheet({type:'task',id:d.id});break;
case 'tSt':{const u=val('tUpd'),n=$('#tNext')&&$('#tNext').value;S.sheet.st=d.v;renderSheet();if(u)$('#tUpd').value=u;if(n!=null&&$('#tNext'))$('#tNext').value=n;break}
case 'tMore':{const u=val('tUpd');S.sheet.more=true;renderSheet();if(u)$('#tUpd').value=u;break}
case 'taskDone':{const x=(D.tasks||[]).find(y=>y.id===d.id);if(!x||!openT(x))return;if(!S.conn)return toast('Подключи сервер рабочей таблицы в ⚙️');x.status='Готово';x.updated=ru(new Date());celebrate();render();await guard(async()=>{await setRow(C.SVC,'Задачи',{A:x.id},x.row_num,{H:'Готово',Q:ru(new Date())});tlog(x.id,'done','закрыл ✓');setTimeout(()=>chainAfterDone(x),900)});levelCheck();break}
case 'tSave':{const x=(D.tasks||[]).find(y=>y.id===S.sheet.id);if(!S.conn)return toast('Подключи сервер рабочей таблицы в ⚙️');const cells={},st=S.sheet.st,own=val('tOwner'),dl=val('tDl'),why=val('tWhy'),up=val('tUpd'),nx=val('tNext');
  if(st&&st!==x.status)cells.H=st;if(own!==String(x.owner||''))cells.F=own;if(up)cells.M=`${short(t)} — ${up}`;if(nx!==String(x.next_step||''))cells.N=nx;
  if(dl&&dl!==x.dl){if(!why)return toast('Укажи причину переноса');cells.J=toRu(dl);cells.K=(+x.dl_moves||0)+1;cells.M=`${short(t)}: DL ${x.dl?toRu(x.dl):'—'} → ${toRu(dl)}. ${why}`+(up?'\n'+up:'')}
  if(!Object.keys(cells).length)return closeSheet();cells.Q=ru(new Date());
  await guard(async()=>{await setRow(C.SVC,'Задачи',{A:x.id},x.row_num,cells);Object.assign(x,{status:cells.H||x.status,owner:cells.F!=null?cells.F:x.owner,week_upd:cells.M||x.week_upd,next_step:cells.N!=null?cells.N:x.next_step,dl:dl||x.dl,dl_moves:cells.K||x.dl_moves,updated:cells.Q});closeSheet();if(up)tlog(x.id,'update',up);if(cells.H)tlog(x.id,cells.H==='Готово'?'done':'status',cells.H==='Готово'?'закрыл ✓':'статус → '+cells.H);if(cells.J)tlog(x.id,'dl','срок → '+cells.J+(why?' · '+why:''));if(cells.N!=null&&nx)tlog(x.id,'step','шаг: '+nx);
    if(cells.H==='Готово'){celebrate();render();setTimeout(()=>chainAfterDone(x),900)}else{render();if(nx&&openT(x))nudge(`Сохранено ✓ <b>Следующий шаг: «${esc(nx.slice(0,70))}» — когда?</b>`,[['Сегодня',`data-act="planPush" data-id="${esc(x.id)}" data-d="0"`],[nxLbl()==='пн'?'В понедельник':'Завтра',`data-act="planPush" data-id="${esc(x.id)}" data-d="1"`]]);else toast('Апдейт сохранён ✓')}});break}
case 'ping':{const x=(D.tasks||[]).find(y=>y.id===d.id);if(!x)return;copy(`Привет, ${fname(x.owner)}! Как продвигается ${x.id} «${x.title}»?${x.dl?(x.dl<t?' DL был '+toRu(x.dl)+'.':' DL '+toRu(x.dl)+'.'):''} Если что-то блокирует — скажи, помогу разрулить.`);toast('Сообщение скопировано — вставь в чат');break}
/* обещания */
case 'promOpen':openSheet({type:'prom',id:d.id});break;
case 'promDone':{const p=(D.promises||[]).find(y=>y.id===d.id);if(!p)return;p.status='Сделано';p.updated_at=new Date().toISOString();closeSheet();celebrate();render();await guard(()=>setRow(C.JB,'Обещания',{A:p.id},0,{I:'Сделано'}),'Обещание закрыто ✓');break}
case 'promMove':{const p=(D.promises||[]).find(y=>y.id===d.id);p.due=nextWork(addDays(t,1));closeSheet();render();await guard(()=>upd('promises',p.id,{due:p.due}),'Перенёс на завтра');break}
/* встречи */
case 'meet':S.mid=d.id;S.mtab=null;go('meet');break;
case 'addMeet':S.addType='Встреча';openSheet({type:'add'});break;
case 'meetPrep':{const m=(D.meetings||[]).find(x=>x.id===S.mid);await guard(()=>toAgent('Секретарь','Подготовка: '+m.title,`Подготовь меня к встрече «${m.title}» ${hm(m.start_at)}–${hm(m.end_at)}. Участники: ${m.people||'—'}${m.epic_id?'. Эпик '+m.epic_id:''}.\nВозьми из базы: мои открытые обещания этим людям (promises), открытые решения (work_decisions), задачи эпика (work_tasks). Формат: зачем я там, что обещал, 2–3 вопроса, что зафиксировать.\nГотовую подготовку запиши: update meetings set prep = $$…$$ where id = '${m.id}'.`,'meetings',m.id),'Отправил Секретарю — открой его чат');break}
case 'meetSum':{const m=(D.meetings||[]).find(x=>x.id===S.mid),s=val('mSum');if(!s)return toast('Напиши или надиктуй резюме');m.summary=s;await guard(async()=>{await upd('meetings',m.id,{summary:s,status:'done'});await toAgent('Секретарь','Резюме: '+m.title,`Резюме встречи «${m.title}» (${m.day}, участники: ${m.people||'—'}${m.epic_id?', эпик '+m.epic_id:''}):\n${s}\n\nРазложи на решения и action items (строки для «Решения»), задачи и обещания (promises). Покажи строки и жди «да», потом запиши.`,'meetings',m.id)},'Сохранено и отправлено Секретарю ✓ +15 XP');celebrate();render();break}
/* фокус */
case 'focus':closeSheet();focusStart(d.t||'Фокус',d.ref);break;
case 'fmin':S.focus.min=+d.n;LS.set('fmin',+d.n);S.focus.start=Date.now();S.focus.paused=0;renderFocus();break;
case 'fpause':if(S.focus.paused){S.focus.start+=Date.now()-S.focus.paused;S.focus.paused=0}else S.focus.paused=Date.now();renderFocus();break;
case 'fstop':S.focus=null;LS.set('focus',null);renderFocus();break;
case 'fdone':{const f=S.focus,min=Math.max(1,Math.round(((f.paused||Date.now())-f.start)/60000));S.focus=null;LS.set('focus',null);renderFocus();celebrate();
  await guard(()=>ins('focus_log',{day:t,minutes:min,title:f.title,ref_id:f.ref||null}),`Фокус ${min} мин записан ✓`);(D.focus=D.focus||[]);render();break}
/* работа */
case 'epic':S.eid=d.id;if(desk()){S.view='work';history.replaceState(null,'','#work');render()}else go('epic');break;
case 'epicPri':{const e=(D.epics||[]).find(x=>x.id===S.eid);e.priority={P1:'P2',P2:'P3',P3:'P1'}[e.priority||'P2'];render();await guard(()=>upd('epics',e.id,{priority:e.priority}),'Важность: '+e.priority);break}
case 'epicGoal':{const e=(D.epics||[]).find(x=>x.id===S.eid),g=prompt('Зачем этот эпик? Одна фраза — какой результат',e.goal||'');if(g===null)return;e.goal=g.trim();render();await guard(()=>upd('epics',e.id,{goal:e.goal}),'Цель сохранена');break}
/* агенты */
case 'ai':openSheet({type:'ai',a:d.a,t:d.t,ref:d.ref});setTimeout(()=>{const x=$('#aiT');if(x)x.focus()},60);break;
case 'aiSend':{const s=S.sheet,tx=val('aiT');let ctx='';
  if(s.ref){const i=(D.ideas||[]).find(x=>x.id===s.ref);if(i)ctx=`\nИдея «${i.title}» (ideas.id = ${i.id}). Хук: ${i.hook||'—'}. Сценарий:\n${i.script||i.notes||'—'}\nГотовый результат запиши в ideas.script (и hook, если меняешь).`}
  const e=(D.epics||[]).find(x=>s.t.includes(x.id));if(e){const st=epicStat(e);ctx+=`\nЭпик ${e.id} «${e.name}». Цель: ${e.goal||'—'}. Прогресс ${st.dn.length}/${st.ts.length}, просрочено ${st.od.length}. Открытые: ${st.op.map(x=>x.id+' '+x.title+' ('+fname(x.owner)+', DL '+(x.dl?toRu(x.dl):'—')+')').join('; ')}`}
  await guard(async()=>{await toAgent(s.a,s.t,s.t+(tx?'.\n'+tx:'')+ctx,s.ref?'ideas':e?'epics':null,s.ref||(e&&e.id)||null);closeSheet()},`Отправил → ${s.a}. Открой его чат в проекте Мозг`);break}
case 'qOpen':openSheet({type:'queue',id:d.id});break;
case 'copy':{const q=(D.queue||[]).find(x=>x.id===d.id);copy(q.result||'');break}
/* блог */
case 'idea':S.iid=d.id;await loadHooks().catch(()=>{});go('idea');break;
case 'ideaNew':{const x=prompt('Идея ролика');if(!x)return;await guard(async()=>{const r=await ins('ideas',{title:x.trim(),kind:'Идея',status:'Идея',source:'Свой'});S.iid=r.id;go('idea')});break}
case 'ideaSt':{const i=(D.ideas||[]).find(x=>x.id===S.iid);await saveIdea(i);i.status=d.s;i.updated_at=new Date().toISOString();if(d.s==='Вышел')celebrate(true);else celebrate();render();await guard(()=>upd('ideas',i.id,{status:d.s,published:d.s==='Вышел'?t:i.published}),'Статус: '+d.s);levelCheck();break}
case 'ideaSave':{const i=(D.ideas||[]).find(x=>x.id===S.iid);await guard(()=>saveIdea(i,true),'Сохранено ✓');break}
case 'hooks':{await loadHooks();const i=(D.ideas||[]).find(x=>x.id===S.iid);await saveIdea(i);openSheet({type:'hooks'});break}
case 'hCat':S.sheet.cat=d.v;renderSheet();break;
case 'hookPick':{const i=(D.ideas||[]).find(x=>x.id===S.iid),h=d.code&&(S.hooks||[]).find(x=>x.code===d.code);i.hook=h?h.text:d.text;i.hook_code=h?h.code:null;closeSheet();render();await guard(()=>upd('ideas',i.id,{hook:i.hook,hook_code:i.hook_code}),'Хук выбран — подставь своё в [скобки]');break}
case 'findScript':case 'findBank':{const f=(D.finds||[]).find(x=>x.id===d.id);await guard(async()=>{const r=await ins('ideas',{title:f.title||'Идея из находки',kind:'Идея',status:'Идея',source:'Ресерчер',hook:f.hook||null,notes:f.adapt||null,ref:safeUrl(f.link)||null,topic:f.topic||null});f.decision='В банк';await upd('finds',f.id,{decision:'В банк'});closeSheet();
  if(n==='findScript'){await toAgent('Сценарист','Сценарий по находке: '+(f.title||''),`Напиши сценарий рилса в стиле Ерназара по находке: ${f.title} (${f.link||''}). Почему залетело: ${f.why||'—'}. Как адаптировать: ${f.adapt||'—'}.\nФормат: первая строка «~N с · тема · CTA …», потом «АКТ 1 — Название (0–10 с)» и кадры «1. …», реплики в «ёлочках», в конце КАДРЫ:/ЦВЕТ:/ЗВУК:. Запиши в ideas (id = ${r.id}): core (мысль 1–2 строки), hook, script, status = 'Готов'.`,'ideas',r.id);S.iid=r.id;await loadHooks().catch(()=>{});go('idea')}else render()},n==='findScript'?'Идея создана, Сценарист пишет сценарий ✓':'В банке идей 💡');break}
case 'findDrop':{const f=(D.finds||[]).find(x=>x.id===d.id);f.decision='Убрано';render();await guard(()=>upd('finds',f.id,{decision:'Убрано'}));break}
/* бизнес */
case 'bizStep':{const cur=Math.max(0,...(D.habits||[]).map(h=>+h.step_biz||0))+1;let h=(D.habits||[]).find(x=>x.day===t);await guard(async()=>{if(h){h.step_biz=cur;await upd('habits',h.id,{step_biz:cur})}else{h=await ins('habits',{day:t,step_biz:cur,step_blog:Math.max(0,...(D.habits||[]).map(x=>+x.step_blog||0))})}},'+5 XP · шаг '+cur+'/12');celebrate();render();break}
case 'clNew':{const x=prompt('Компания');if(!x)return;await guard(()=>ins('clients',{company:x.trim(),stage:'Найден',touched:t}),'Клиент добавлен');render();break}
case 'clNext':{const c=(D.clients||[]).find(x=>x.id===d.id),nx=CL_ST[Math.min(5,CL_ST.indexOf(c.stage||'Найден')+1)];const cols={stage:nx,touched:t};if(nx==='Оплатил'){const s=prompt('Сумма оплаты, ₸');if(s===null)return;cols.amount=+s||0;celebrate(true)}Object.assign(c,cols);render();await guard(()=>upd('clients',c.id,cols),'→ '+nx);break}
case 'hypNew':{const x=prompt('Гипотеза: если …, то …');if(!x)return;await guard(()=>ins('hypotheses',{title:x.trim(),status:'Идея',start:t}),'Гипотеза добавлена');render();break}
/* личное */
case 'qDone':{const q=(D.quests||[]).find(x=>x.id===d.id);q.status=q.status==='Готово'?'В плане':'Готово';q.updated_at=new Date().toISOString();if(q.status==='Готово')celebrate(true);render();await guard(()=>upd('quests',q.id,{status:q.status}));levelCheck();break}
case 'habit':{const on=(D.hmarks||[]).some(m=>m.habit_id===d.id&&m.day===t);await guard(async()=>{if(on){D.hmarks=D.hmarks.filter(m=>!(m.habit_id===d.id&&m.day===t));await sb('DELETE',`habit_marks?day=eq.${t}&habit_id=eq.${d.id}`,null,'return=minimal')}else{(D.hmarks=D.hmarks||[]).push({day:t,habit_id:d.id});await sb('POST','habit_marks',{day:t,habit_id:d.id},'return=minimal');celebrate()}});render();levelCheck();break}
case 'habitNew':{const x=prompt('Новая привычка, например «🧘 Медитация 10 мин»');if(!x)return;const m=x.trim().match(/^(\p{Extended_Pictographic})\s*(.+)$/u);await guard(()=>ins('habit_defs',{name:m?m[2]:x.trim(),emoji:m?m[1]:'✨',sort:(D.hdefs||[]).length+1}).then(r=>{D.hdefs=(D.hdefs||[]);if(!D.hdefs.includes(r))D.hdefs.push(r)}),'Привычка добавлена');render();break}
case 'money':{const x=prompt(d.k==='save'?'Сколько отложил в подушку, ₸':'Сколько потратил, ₸ (можно «5000 кафе»)');if(!x)return;const m=x.match(/([\d\s]+)\s*(.*)/);if(!m)return;await guard(()=>ins('money',{kind:d.k,amount:+m[1].replace(/\s/g,''),note:m[2]||null,day:t}),'Записал');render();break}
case 'moneyGoal':{const x=prompt(d.k==='budget'?'Бюджет на месяц, ₸':'Цель подушки, ₸');if(!x)return;await guard(()=>ins('money',{kind:d.k,amount:+x.replace(/\D/g,''),day:t}),'Сохранено');render();break}
/* я */
case 'freeze':await guard(()=>upsertDay(addDays(t,-1),{freeze_used:true}),'🧊 Вчера заморожено — серия цела');render();break;
case 'buy':{const s=(D.shop||[]).find(x=>x.id===d.id);if(s.bought)return;if(hero().coins<+s.price)return toast('Не хватает монет — ещё немного');s.bought=true;celebrate(true);render();await guard(()=>upd('shop',s.id,{bought:true}),'Награда твоя 🎁 Заслужил');break}
case 'rewardNew':{const x=prompt('Награда (например «Вечер игр»)');if(!x)return;const p=prompt('Цена в монетах','150');await guard(()=>ins('shop',{title:x.trim(),price:+p||150}),'Награда добавлена');render();break}
/* закрыть день */
case 'tail':case 'tailsAll':{const dr=dayRec(t),tm=dayRec(nxDay(t)),tails=(dr.top3||[]).filter(x=>!top3Done(x)),mv=n==='tail'?[tails[+d.i]]:tails;await guard(()=>upsertDay(nxDay(t),{top3:(tm.top3||[]).concat(mv.filter(x=>!(tm.top3||[]).some(y=>y.ref===x.ref))).slice(0,3)}),'Перенёс на '+(nxLbl(t)==='пн'?'понедельник':'завтра'));render();break}
case 'closeDay':{const note=val('jNote'),nw=val('tmNew');await guard(async()=>{if(nw){const tm=dayRec(nxDay(t));await upsertDay(nxDay(t),{top3:(tm.top3||[]).concat([{kind:'text',ref:'t'+Date.now(),t:nw,why:'план'}]).slice(0,3)})}
  await upsertDay(t,{closed:true,note});if(note)await appendRow(C.JB,'Журнал!A1',['L'+Date.now().toString(36).slice(-6).toUpperCase(),ru(new Date()),'','','Итог дня',note,'','Мозг',''])});celebrate(true);toast('День закрыт 🌙 +30 XP · серия '+streak());go('today');levelCheck();break}
/* «+» */
case 'add':openSheet({type:'add'});setTimeout(()=>{const x=$('#addT');if(x)x.focus()},60);break;
case 'addType':S.addType=d.v;{const v=val('addT');renderSheet();$('#addT').value=v}break;
case 'addSph':S.addSph=d.v;{const v=val('addT');renderSheet();$('#addT').value=v}break;
case 'addDir':S.addDir=d.v;{const v=val('addT');renderSheet();$('#addT').value=v}break;
case 'addSave':{const tx=val('addT'),ty=S.addType||'Задача';if(!tx)return toast('Напиши пару слов');
  await guard(async()=>{
    if(ty==='Задача')await ins('quests',{title:tx,sphere:S.addSph||'Личная жизнь',kind:'Задача',status:'В плане',due:t});
    else if(ty==='Обещание'){const id='P'+Date.now().toString(36).slice(-5).toUpperCase();await appendRow(C.JB,'Обещания!A1',[id,ru(new Date()),S.addDir||'Я обещал',val('addWho'),tx,val('addDue')?toRu(val('addDue')):'','','','Открыт','']);(D.promises=D.promises||[]).push({id,day:t,direction:S.addDir||'Я обещал',person:val('addWho'),what:tx,due:val('addDue')||null,status:'Открыт'})}
    else if(ty==='Встреча'){const tm=val('addTime')||'12:00',st=new Date(t+'T'+tm+':00');await ins('meetings',{day:t,start_at:st.toISOString(),end_at:new Date(st.getTime()+30*6e4).toISOString(),title:tx,people:val('addWho'),source:'manual'})}
    else if(ty==='Идея ролика')await ins('ideas',{title:tx,kind:'Идея',status:'Идея',source:'Свой'});
    else if(ty==='Клиент')await ins('clients',{company:tx,stage:'Найден',touched:t});
    else await appendRow(C.JB,'Журнал!A1',['L'+Date.now().toString(36).slice(-6).toUpperCase(),ru(new Date()),'','','',tx,'','Мозг','']);
    closeSheet();render()},'Сохранил ✓');break}
case 'voice':{const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return toast('Нажми 🎤 на клавиатуре телефона');const r=new R();r.lang='ru-RU';r.continuous=true;r.onresult=e=>{const x=document.getElementById(d.t);if(x)x.value=(x.value?x.value+' ':'')+Array.from(e.results).slice(e.resultIndex).map(z=>z[0].transcript).join(' ')};r.onerror=()=>toast('Не расслышал');r.start();toast('Говори…');break}
/* вход и сервер */
case 'passLogin':{const em=val('lEmail').toLowerCase(),pw=$('#lPass').value;if(!em||!pw)return toast('Почта и пароль');try{saveSess(await sbAuth('token?grant_type=password',{email:em,password:pw}));LS.set('email',em);render();loadAll()}catch(e){toast('Неверная почта или пароль')}break}
case 'sendLink':{const em=val('lEmail').toLowerCase();if(!/\S+@\S+\.\S+/.test(em))return toast('Введи почту');try{await sbAuth('otp?redirect_to='+encodeURIComponent(location.origin+location.pathname),{email:em,create_user:true});S.otp=em;LS.set('email',em);render()}catch(e){toast('Не отправилось, попробуй через минуту')}break}
case 'otpBack':S.otp=null;render();break;
case 'setPass':{const pw=$('#lPass1').value;if(!pw||pw.length<8)return toast('Не меньше 8 знаков');try{const r=await fetch(SB.url+'/auth/v1/user',{method:'PUT',headers:{apikey:SB.key,Authorization:'Bearer '+await token(),'Content-Type':'application/json'},body:JSON.stringify({password:pw})});if(!r.ok)throw 0;S.needPass=false;render();loadAll()}catch(e){toast('Не сохранилось')}break}
case 'connect':{const url=val('cUrl'),key=val('cKey');if(!/\/exec$/.test(url)||!key)return toast('Ссылка /exec и ключ');try{S.conn={url,key};await api([{action:'ping'}]);LS.set('conn',S.conn);toast('Сервер подключён ✓');closeSheet()}catch(e){S.conn=null;toast('Не подключилось — проверь ссылку и ключ')}break}
case 'logout':closeSheet();logout();break;
}}
async function saveIdea(i,force){if(!i)return;const cols={},tt=val('iTitle'),hk=val('iHook'),sc=document.getElementById('iScript')?document.getElementById('iScript').value:null;
  if(tt&&tt!==i.title)cols.title=tt;if(document.getElementById('iHook')&&hk!==String(i.hook||''))cols.hook=hk;if(sc!=null&&sc!==String(i.script||i.notes||''))cols.script=sc;
  if(!Object.keys(cols).length&&!force)return;if(Object.keys(cols).length){if(!['Пишу','Готов','Снимаю','Снято','Монтаж','Вышел'].includes(i.status)&&cols.script)cols.status='Пишу';Object.assign(i,cols);i.updated_at=new Date().toISOString();await upd('ideas',i.id,cols)}}
function copy(t){try{navigator.clipboard.writeText(t).then(()=>toast('Скопировано'),()=>toast('Не удалось скопировать'))}catch(e){toast('Не удалось скопировать')}}

/* события */
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(!a)return;if(a.closest('#nudge'))$('#nudge').hidden=true;if(a.tagName==='A'&&!a.getAttribute('href'))e.preventDefault();e.stopPropagation();act(a.dataset.act,a)});
document.addEventListener('focusout',e=>{if(['iScript','iHook','iTitle'].includes(e.target.id)&&S.view==='idea'){const i=(D.ideas||[]).find(x=>x.id===S.iid);saveIdea(i).catch(()=>{})}});
document.addEventListener('keydown',e=>{if(S.shoot){if(e.key==='ArrowRight')act('shootN',{dataset:{d:'1'}});else if(e.key==='ArrowLeft')act('shootN',{dataset:{d:'-1'}});else if(e.key===' '){e.preventDefault();act('shootMark',{dataset:{}})}else if(e.key==='Escape')act('shootX',{dataset:{}});return}if(e.key==='Escape'){closeSheet()}
  const tp=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable;
  if(!tp&&S.auth&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!S.sheet){const k=e.key.toLowerCase(),nv={'1':'today','2':'work','3':'goals','4':'me'}[k];if(nv){go(nv);return}if(k==='n'||k==='т'){e.preventDefault();act('add',e.target);return}if((k==='f'||k==='а')&&!S.focus){act('focus',{dataset:{}});return}}if(e.key==='Enter'&&e.target.id==='tmNew'){act('closeDay',e.target)}});

/* старт */
const T0=Date.now();function splashOff(ms){const el=$('#splash');if(!el||el.classList.contains('out'))return;setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400)},ms===0?0:Math.max(0,700-(Date.now()-T0)))}
let tx0=null;document.addEventListener('touchstart',e=>{if(S.shoot)tx0=e.touches[0].clientX},{passive:true});document.addEventListener('touchend',e=>{if(!S.shoot||tx0==null)return;const dx=e.changedTouches[0].clientX-tx0;tx0=null;if(Math.abs(dx)>60)act('shootN',{dataset:{d:dx<0?'1':'-1'}})},{passive:true});
(function init(){
  S.conn=LS.get('conn',null);S.auth=LS.get('auth',null);
  if(/access_token/.test(location.hash)){const p=new URLSearchParams(location.hash.slice(1));saveSess({access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_in:p.get('expires_in')});S.needPass=true;history.replaceState(null,'',location.pathname)}
  const h=(location.hash||'').slice(1);if(VIEWS[h]&&!['epic','idea','meet'].includes(h))S.view=h;
  const c=LS.get('cache3',null);if(c&&c.D){Object.assign(D,c.D);S.syncedAt=c.at}
  S.focus=LS.get('focus',null);render();renderFocus();
  if(!S.auth||S.needPass)splashOff(0);else{try{if(D.tasks){const H=hero();$('#spC').innerHTML=`<span>🔥 ${streak()} ${plural(streak(),'день','дня','дней')}</span><span>Ур. ${H.lvl}</span>`}}catch(e){}
    setTimeout(()=>splashOff(),D.tasks?1500:8000);loadAll().finally(()=>splashOff())}
  const seen0=LS.get('seen',0);LS.set('seen',Date.now());if(S.auth)setTimeout(()=>welcomeBack(seen0),2600);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){LS.set('seen',Date.now());return}const last=LS.get('seen',0);LS.set('seen',Date.now());if(S.auth&&Date.now()-(S.syncedAt||0)>60000)loadAll().then(()=>welcomeBack(last));else welcomeBack(last)});
  setInterval(()=>{const dk=night();if(dk!==document.body.classList.contains('dark'))render()},60000);
  matchMedia('(min-width:1000px)').addEventListener('change',()=>render());
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
