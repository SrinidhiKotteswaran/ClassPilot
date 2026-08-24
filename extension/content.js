(() => {
  if (window.top !== window) return;
  const BUTTON_ID = 'classpilot-import-button';
  if (document.getElementById(BUTTON_ID)) return;

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.textContent = 'Prepare ClassPilot import';
  Object.assign(button.style, { position:'fixed', right:'20px', bottom:'20px', zIndex:'2147483647', border:'0', borderRadius:'12px', padding:'12px 16px', background:'#111827', color:'#fff', font:'600 14px system-ui', boxShadow:'0 8px 30px rgba(0,0,0,.2)', cursor:'pointer' });
  document.body.appendChild(button);

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const absolute = href => { try { return new URL(href, location.href).href; } catch { return null; } };
  const courseId = href => { const m = String(href || '').match(/\/(?:course|section)\/(\d+)/i); return m?.[1] || null; };
  const assignmentId = href => { const m = String(href || '').match(/\/assignment\/(\d+)/i); return m?.[1] || null; };

  function parseCourses(doc, baseUrl) {
    const out = new Map();
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = absolute(a.getAttribute('href'));
      const id = courseId(href);
      if (!id) return;
      const title = text(a) || id;
      if (title.length < 2 || /home|materials|grades|calendar|members/i.test(title)) return;
      out.set(id, { schoologyId:id, title:title.slice(0,300), url:href });
    });
    const currentId = courseId(baseUrl);
    if (currentId && !out.has(currentId)) {
      const heading = text(doc.querySelector('h1, [role="heading"]')) || text(document.querySelector('title')).replace(/\s*[|–-].*$/, '');
      if (heading) out.set(currentId, { schoologyId:currentId, title:heading.slice(0,300), url:baseUrl });
    }
    return [...out.values()];
  }

  function parseAssignments(doc, course) {
    const out = [];
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = absolute(a.getAttribute('href'));
      const id = assignmentId(href);
      if (!id) return;
      const title = text(a) || `Assignment ${id}`;
      const parent = a.closest('li, tr, article, .item, .material, .s-ext-list-item') || a.parentElement;
      const nearby = text(parent);
      const dateMatch = nearby.match(/(?:due|due date)[:\s]+([^|·]{3,60})/i);
      out.push({ schoologyId:id, courseSchoologyId:course.schoologyId, title:title.slice(0,500), description:nearby.slice(0,1000), dueAt: dateMatch ? parseDate(dateMatch[1]) : null, category:'preparatory', pointsValue:0, isMissing:/missing|overdue/i.test(nearby), url:href });
    });
    return out;
  }

  function parseDate(value) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  async function fetchDoc(url) {
    const response = await fetch(url, { credentials:'include' });
    if (!response.ok) throw new Error(`Schoology returned ${response.status}`);
    return new DOMParser().parseFromString(await response.text(), 'text/html');
  }

  async function prepare() {
    button.disabled = true; button.textContent = 'Reading Schoology…';
    try {
      const courses = parseCourses(document, location.href);
      if (!courses.length) throw new Error('No Schoology courses were found on this page. Open your Schoology home or course page and try again.');
      const assignments = [...parseAssignments(document, courses[0])];
      for (const course of courses.slice(0, 50)) {
        try {
          const doc = course.url === location.href ? document : await fetchDoc(course.url);
          const heading = text(doc.querySelector('h1, [role="heading"]'));
          if (heading && course.title.match(/^\d+$/)) course.title = heading.slice(0,300);
          const found = parseAssignments(doc, course);
          const seen = new Set(assignments.map(a => a.schoologyId));
          found.forEach(a => { if (!seen.has(a.schoologyId)) assignments.push(a); });
        } catch (_) {}
      }
      const payload = { courses, assignments, schoolName: location.hostname, schoologyUsername: text(document.querySelector('[class*="profile"], [class*="user"]')) };
      await chrome.storage.local.set({ classPilotPendingImport: payload });
      button.textContent = `Ready: ${courses.length} classes · ${assignments.length} assignments`;
      button.style.background = '#047857';
      alert(`ClassPilot found ${courses.length} classes and ${assignments.length} assignments. Click the ClassPilot extension icon to enter your one-time import code.`);
    } catch (error) {
      button.textContent = 'Prepare ClassPilot import';
      alert(error instanceof Error ? error.message : 'Could not read Schoology.');
    } finally { button.disabled = false; }
  }

  button.addEventListener('click', prepare);
})();
