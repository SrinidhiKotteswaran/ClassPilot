(() => {
  if (window.top !== window) return;
  const ROOT_ID = 'classpilot-schoology-sync';
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  Object.assign(root.style, { position:'fixed', right:'20px', bottom:'20px', zIndex:'2147483647', width:'310px', padding:'15px 16px', borderRadius:'16px', background:'#fff', color:'#0f172a', font:'14px/1.4 system-ui,-apple-system,sans-serif', border:'1px solid #dbe3ee', boxShadow:'0 12px 40px rgba(15,23,42,.14)' });
  root.innerHTML = `<div style="display:flex;align-items:center;gap:9px"><div style="width:30px;height:30px;border-radius:9px;background:#111827;color:#fff;display:grid;place-items:center;font-weight:800">C</div><div><div style="font-weight:800">ClassPilot</div><div id="cp-sub" style="font-size:11px;color:#64748b">Official Schoology sync</div></div></div><div id="cp-status" style="margin-top:10px;color:#475569">Preparing Schoology sync…</div><button id="cp-sync" style="width:100%;margin-top:10px;padding:9px 12px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:700;cursor:pointer">Connect & sync</button><div style="margin-top:8px;font-size:10px;color:#64748b">Your Schoology password is never read or stored by ClassPilot.</div>`;
  document.body.appendChild(root);

  const status = root.querySelector('#cp-status'), button = root.querySelector('#cp-sync'), sub = root.querySelector('#cp-sub');
  const text = el => (el?.textContent || '').replace(/\s+/g,' ').trim();
  const absolute = href => { try { return new URL(href, location.href).href; } catch { return null; } };
  const courseId = href => String(href || '').match(/\/(?:course|section)\/(\d+)(?:[/?#]|$)/i)?.[1] || null;
  const assignmentId = href => String(href || '').match(/\/assignment\/(\d+)(?:[/?#]|$)/i)?.[1] || null;
  const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);

  function parseDate(value) {
    if (value === null || value === undefined || value === '') return null;
    const s = String(value).trim();
    if (/^\d{10}$/.test(s)) return new Date(Number(s)*1000).toISOString();
    if (/^\d{13}$/.test(s)) return new Date(Number(s)).toISOString();
    const parsed = Date.parse(s);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  function cleanCourseTitle(title) { return String(title || '').replace(/\s+/g,' ').replace(/^\s*[•·|:-]+\s*/,'').replace(/\s+(materials|grades|calendar|members|more)\s*$/i,'').trim().slice(0,300); }
  function looksLikeRealCourseTitle(title) { return !!title && title.length > 1 && !/^(home|materials|grades|calendar|members|more|view course|course dashboard|recent activity|to do|resources|groups)$/i.test(title); }
  function addCourse(out,id,title,url,courseCode='') {
    if (!id) return;
    const cleaned = cleanCourseTitle(title);
    if (!looksLikeRealCourseTitle(cleaned)) return;
    const existing = out.get(id);
    if (!existing || existing.title.startsWith('Schoology class ')) out.set(id,{schoologyId:id,title:cleaned,courseCode:String(courseCode||'').slice(0,100),url:url||`${location.origin}/course/${id}`});
  }
  function parseCourses(doc,baseUrl) {
    const out = new Map();
    doc.querySelectorAll('a[href*="/course/"],a[href*="/section/"],[data-course-id],[data-section-id]').forEach(el=>{
      const href=el.getAttribute?.('href'), dataId=el.getAttribute?.('data-course-id')||el.getAttribute?.('data-section-id');
      const id=courseId(absolute(href))||(dataId&&/^\d+$/.test(dataId)?dataId:null);
      if(id) addCourse(out,id,text(el),absolute(href)||`${location.origin}/course/${id}`);
    });
    const currentId=courseId(baseUrl);
    if(currentId&&!out.has(currentId)) addCourse(out,currentId,cleanCourseTitle(text(doc.querySelector('h1,[role="heading"]'))||text(doc.querySelector('title')).replace(/\s*[|–-].*$/,'')),baseUrl);
    return [...out.values()];
  }
  function courseFromText(courseText,coursesById) {
    const normalized=String(courseText||'').replace(/\s+/g,' ').trim();
    if(!normalized) return '';
    const match=normalized.match(/:\s*(\d+)\s*(?:\d+)?\s+(.+?)(?:\s{2,}|$)/);
    if(match){
      const candidateTitle=cleanCourseTitle(match[2]);
      const found=[...coursesById.values()].find(c=>c.title.toLowerCase()===candidateTitle.toLowerCase());
      if(found) return found.schoologyId;
      const fallbackId=`title:${slug(candidateTitle)}`;
      addCourse(coursesById,fallbackId,candidateTitle,`${location.origin}/course/title-${slug(candidateTitle)}`,match[1]);
      return fallbackId;
    }
    const found=[...coursesById.values()].sort((a,b)=>b.title.length-a.title.length).find(c=>normalized.toLowerCase().includes(c.title.toLowerCase()));
    return found?.schoologyId||'';
  }
  function findCourseInEvent(event,coursesById) {
    if(!event) return '';
    const link=event.querySelector('a[href*="/course/"],a[href*="/section/"]');
    const linked=courseId(absolute(link?.getAttribute('href'))||'');
    if(linked) return linked;
    return courseFromText(text(event.querySelector('.realm-title-course,.realm-title-course-csl,[class*="course-title"],[class*="course-name"]')),coursesById) || courseFromText(text(event),coursesById);
  }
  function extractDueFromText(value) {
    const s=String(value||'').replace(/\s+/g,' ').trim();
    const m=s.match(/Due\s+(?:on\s+)?((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})(?:\s+at\s+([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)))?/i);
    return m?parseDate(`${m[1]} ${m[2]||'11:59 PM'}`):null;
  }
  function parseAssignmentLinks(doc,coursesById) {
    const out=new Map();
    doc.querySelectorAll('a[href*="/assignment/"]').forEach(a=>{
      const href=absolute(a.getAttribute('href')),id=assignmentId(href); if(!id) return;
      const event=a.closest('.upcoming-event,.upcoming-item,.sExtlink,li,td,tr,article,[role="gridcell"],.item,.s-ext-list-item,.s-todo-item')||a.parentElement;
      const nearby=text(event||a.parentElement); let dueAt=null;
      for(let node=a,depth=0;node&&depth<14;depth++,node=node.parentElement){
        for(const attr of ['data-date','data-start','data-datetime','datetime','title']){const parsed=parseDate(node.getAttribute?.(attr));if(parsed){dueAt=parsed;break;}}
        if(dueAt) break;
      }
      if(!dueAt) dueAt=extractDueFromText(nearby);
      if(!dueAt) return;
      const dueMs=Date.parse(dueAt); if(Number.isNaN(dueMs)||dueMs<Date.now()-60*60*1000) return;
      const courseSchoologyId=findCourseInEvent(event,coursesById); if(!courseSchoologyId||!coursesById.has(courseSchoologyId)) return;
      out.set(id,{schoologyId:id,courseSchoologyId,title:text(a).slice(0,500)||`Assignment ${id}`,description:nearby.slice(0,1000),dueAt,category:'preparatory',pointsValue:0,isMissing:/\bmissing\b/i.test(nearby),url:href,source:'schoology'});
    });
    return [...out.values()];
  }

  function normalizeCategory(value){
    const v=String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(!v) return null;
    if(/summative/.test(v)) return 'summative';
    if(/formative/.test(v)) return 'formative';
    if(/review|reflect/.test(v)) return 'review_reflect';
    if(/prepar/.test(v)) return 'preparatory';
    return v.slice(0,100);
  }
  function categoryFromAssignmentDoc(doc){
    const labels=[...doc.querySelectorAll('dt,th,strong,b,label,span,div,p')];
    for(const el of labels){
      const label=text(el).replace(/\s+/g,' ').trim();
      if(/^Category\s*:/i.test(label)){
        const own=label.replace(/^Category\s*:\s*/i,'');
        const next=text(el.nextElementSibling);
        return normalizeCategory(own||next);
      }
    }
    const body=text(doc.body);
    const match=body.match(/(?:^|\s)Category\s*:\s*([^\n]+?)(?=\s+(?:Period|Due|Grade)\s*:|$)/i);
    return normalizeCategory(match?.[1]||'');
  }
  async function enrichAssignmentCategories(assignments){
    const entries=[...assignments];
    const concurrency=4; let cursor=0;
    async function worker(){ while(cursor<entries.length){ const item=entries[cursor++]; try{ const result=await fetchDoc(item.url); const category=categoryFromAssignmentDoc(result.doc); if(category) item.category=category; }catch(_){} } }
    await Promise.all(Array.from({length:Math.min(concurrency,entries.length)},worker));
    return entries;
  }

async function fetchDoc(path){
    const url=absolute(path); if(!url) throw new Error('Invalid Schoology URL.');
    const response=await fetch(url,{credentials:'include',headers:{Accept:'text/html'}}); if(!response.ok) throw new Error(`Schoology returned ${response.status}`);
    return {doc:new DOMParser().parseFromString(await response.text(),'text/html'),url:response.url||url};
  }
  async function collect(){
    const coursesById=new Map(),assignmentsById=new Map();
    await new Promise(resolve=>setTimeout(resolve,1200));
    for(const path of ['/home/course-dashboard','/courses','/home']){
      try{const result=path==='/home'&&location.pathname==='/home'?{doc:document,url:location.href}:await fetchDoc(path);parseCourses(result.doc,result.url).forEach(c=>coursesById.set(c.schoologyId,c));parseAssignmentLinks(result.doc,coursesById).forEach(x=>assignmentsById.set(x.schoologyId,x));}catch(_){}
    }
    parseCourses(document,location.href).forEach(c=>coursesById.set(c.schoologyId,c));
    parseAssignmentLinks(document,coursesById).forEach(x=>assignmentsById.set(x.schoologyId,x));

    // Schoology sometimes renders the course menu after document_idle. Use the
    // actual course/event widgets as a fallback instead of returning zero.
    if(!coursesById.size){
      document.querySelectorAll('.upcoming-event,.upcoming-item,.s-todo-item,[class*="upcoming"],[class*="todo"]').forEach(event=>{
        const courseText=text(event.querySelector('.realm-title-course,.realm-title-course-csl,[class*="course-title"],[class*="course-name"]'));
        courseFromText(courseText,coursesById);
      });
      parseAssignmentLinks(document,coursesById).forEach(x=>assignmentsById.set(x.schoologyId,x));
    }
    try{
      const calendar=await fetchDoc('/calendar');
      const href=[...calendar.doc.querySelectorAll('a[href*="/calendar/"]')].map(a=>absolute(a.getAttribute('href'))).find(Boolean)||calendar.url;
      const m=href.match(/\/calendar\/(\d+)\/(\d{4})-(\d{2})/i);
      if(m){const userId=m[1],start=new Date(Number(m[2]),Number(m[3])-1,1);for(let offset=0;offset<3;offset++){const d=new Date(start.getFullYear(),start.getMonth()+offset,1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;try{const result=offset===0&&/\/calendar\/\d+\/\d{4}-\d{2}/i.test(location.pathname)?{doc:document}:await fetchDoc(`/calendar/${userId}/${key}`);parseAssignmentLinks(result.doc,coursesById).forEach(x=>assignmentsById.set(x.schoologyId,x));}catch(_){} }}
    }catch(_){}
    const assignments=await enrichAssignmentCategories([...assignmentsById.values()]);
return {courses:[...coursesById.values()],assignments,schoolName:location.hostname,calendarSync:true};
  }
  let syncInFlight=null;
  async function sync(){
    if(syncInFlight)return syncInFlight;
    syncInFlight=(async()=>{
      button.disabled=true;button.textContent='Syncing…';status.textContent='Reading your Schoology courses and assignments…';sub.textContent='Secure connection';
      try{
        let payload=await collect();
        if(!payload.courses.length){status.textContent='Schoology is still loading your classes…';await new Promise(resolve=>setTimeout(resolve,1800));payload=await collect();}
        if(!payload.courses.length)throw new Error('No Schoology classes were found. Open your Schoology home page and try again.');
        status.textContent=`Found ${payload.courses.length} classes and ${payload.assignments.length} upcoming items. Connecting…`;
        const result=await chrome.runtime.sendMessage({type:'CONNECT_AND_SYNC',payload});
        if(!result?.ok)throw new Error(result?.message||'Could not connect to ClassPilot.');
        status.textContent=`Synced ${result.classesImported??payload.courses.length} classes · ${(result.assignmentsImported??0)+(result.assignmentsUpdated??0)} upcoming items.`;sub.textContent='Connected · automatic sync on';button.textContent='Sync now';return result;
      }catch(error){status.textContent=error instanceof Error?error.message:'Sync could not be completed.';sub.textContent='Needs attention';button.textContent='Connect & sync';return {ok:false,message:status.textContent};}
      finally{button.disabled=false;syncInFlight=null;}
    })();return syncInFlight;
  }
  button.addEventListener('click',sync);
  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{if(message?.type!=='SYNC_NOW')return false;sync().then(sendResponse).catch(error=>sendResponse({ok:false,message:error?.message||'Schoology sync failed.'}));return true;});
  sync();setInterval(sync,10*60*1000);
})();
