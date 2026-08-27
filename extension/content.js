(() => {
  if (window.top !== window) return;
  const ROOT_ID = 'classpilot-schoology-sync';
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  Object.assign(root.style, {
    position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647',
    width: '310px', padding: '15px 16px', borderRadius: '16px',
    background: '#fff', color: '#0f172a', font: '14px/1.4 system-ui,-apple-system,sans-serif',
    border: '1px solid #dbe3ee', boxShadow: '0 12px 40px rgba(15,23,42,.14)'
  });
  root.innerHTML = `<div style="display:flex;align-items:center;gap:9px"><div style="width:30px;height:30px;border-radius:9px;background:#111827;color:#fff;display:grid;place-items:center;font-weight:800">C</div><div><div style="font-weight:800">ClassPilot</div><div id="cp-sub" style="font-size:11px;color:#64748b">Official Schoology sync</div></div></div><div id="cp-status" style="margin-top:10px;color:#475569">Preparing Schoology sync…</div><button id="cp-sync" style="width:100%;margin-top:10px;padding:9px 12px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:700;cursor:pointer">Connect & sync</button><div style="margin-top:8px;font-size:10px;color:#64748b">Your Schoology password is never read or stored by ClassPilot.</div>`;
  document.body.appendChild(root);

  const status = root.querySelector('#cp-status');
  const button = root.querySelector('#cp-sync');
  const sub = root.querySelector('#cp-sub');
  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const absolute = href => { try { return new URL(href, location.href).href; } catch { return null; } };
  const courseId = href => String(href || '').match(/\/(?:course|section)\/(\d+)(?:[/?#]|$)/i)?.[1] || null;
  const assignmentId = href => String(href || '').match(/\/assignment\/(\d+)(?:[/?#]|$)/i)?.[1] || null;
  const calendarPath = value => String(value || '').match(/\/calendar\/(\d+)\/(\d{4})-(\d{2})(?:[/?#]|$)/i);

  function parseDate(value) {
    if (value === null || value === undefined || value === '') return null;
    const stringValue = String(value).trim();
    if (/^\d{10}$/.test(stringValue)) return new Date(Number(stringValue) * 1000).toISOString();
    if (/^\d{13}$/.test(stringValue)) return new Date(Number(stringValue)).toISOString();
    const parsed = Date.parse(stringValue);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  function looksLikeRealCourseTitle(title) {
    if (!title || title.length < 2) return false;
    return !/^(home|materials|grades|calendar|members|more|view course|course dashboard|recent activity|to do)$/i.test(title);
  }

  function cleanCourseTitle(title) {
    return String(title || '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*[•·|:-]+\s*/, '')
      .replace(/\s+(materials|grades|calendar|members|more)\s*$/i, '')
      .trim()
      .slice(0, 300);
  }

  // Schoology's course dashboard is preferred, but some schools only render a
  // subset of enrolled sections there. We also recover course identities from
  // the actual upcoming assignment cards below. This avoids losing valid classes
  // merely because Schoology's dashboard DOM is incomplete.
  function parseCourses(doc, baseUrl) {
    const out = new Map();
    const selectors = [
      'a[href*="/course/"]',
      '[data-course-id]',
      '[data-section-id]'
    ].join(',');

    doc.querySelectorAll(selectors).forEach(el => {
      const href = el.getAttribute?.('href');
      const dataId = el.getAttribute?.('data-course-id') || el.getAttribute?.('data-section-id');
      const id = courseId(absolute(href)) || (dataId && /^\d+$/.test(dataId) ? dataId : null);
      if (!id) return;

      let title = cleanCourseTitle(text(el));
      if (!looksLikeRealCourseTitle(title)) return;

      out.set(id, {
        schoologyId: id,
        title,
        url: absolute(href) || `${location.origin}/course/${id}`
      });
    });

    const currentId = courseId(baseUrl);
    if (currentId && !out.has(currentId)) {
      const heading = cleanCourseTitle(text(doc.querySelector('h1, [role="heading"]')) || text(doc.querySelector('title')).replace(/\s*[|–-].*$/, ''));
      if (looksLikeRealCourseTitle(heading)) out.set(currentId, { schoologyId: currentId, title: heading, url: baseUrl });
    }
    return [...out.values()];
  }

  function calendarUserAndMonth(url) {
    const match = calendarPath(url);
    return match ? { userId: match[1], month: `${match[2]}-${match[3]}` } : null;
  }

  function eventDate(anchor, pageMonth) {
    let node = anchor;
    for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
      for (const attr of ['data-date', 'data-start', 'data-datetime', 'datetime', 'title']) {
        const value = node.getAttribute?.(attr);
        if (!value) continue;
        const parsed = parseDate(value);
        if (parsed) return parsed;
      }
      const numericDay = node.getAttribute?.('data-day');
      if (numericDay && /^\d{1,2}$/.test(numericDay) && pageMonth) {
        const [year, month] = pageMonth.split('-').map(Number);
        const candidate = new Date(year, month - 1, Number(numericDay), 23, 59, 59);
        if (!Number.isNaN(candidate.getTime())) return candidate.toISOString();
      }
    }
    return null;
  }

  function parseCalendarAssignments(doc, coursesById, pageMonth) {
    const out = new Map();
    const links = [...doc.querySelectorAll('a[href*="/assignment/"]')];
    const now = Date.now();

    links.forEach(a => {
      const href = absolute(a.getAttribute('href'));
      const id = assignmentId(href);
      if (!id) return;

      const title = text(a) || `Assignment ${id}`;
      const event = a.closest('.upcoming-event, [data-start], li, td, tr, article, [role="gridcell"], .item, .s-ext-list-item');
      const nearby = text(event || a.parentElement);
      const dueAt = eventDate(a, pageMonth);
      const dueMs = dueAt ? Date.parse(dueAt) : NaN;

      if (!dueAt || Number.isNaN(dueMs) || dueMs < now - 60 * 60 * 1000) return;

      let courseSchoologyId = '';
      const courseLink = event?.querySelector?.('a[href*="/course/"]');
      courseSchoologyId = courseId(absolute(courseLink?.getAttribute('href')) || '') || '';

      // Recover the class directly from the assignment card when the course
      // dashboard did not expose that class. This is especially important for
      // schools where only some active sections appear in /home/course-dashboard.
      if (courseSchoologyId && !coursesById.has(courseSchoologyId)) {
        const rawCourseText = text(event?.querySelector?.('.realm-title-course, .realm-title-course-csl, [class*="course-title"]')) || '';
        const fallbackTitle = cleanCourseTitle(rawCourseText.replace(/^.*?:\s*\d+\s*\d*\s*/i, ''));
        const title = looksLikeRealCourseTitle(fallbackTitle) ? fallbackTitle : cleanCourseTitle(courseLink?.textContent || '');
        coursesById.set(courseSchoologyId, {
          schoologyId: courseSchoologyId,
          title: looksLikeRealCourseTitle(title) ? title : `Schoology class ${courseSchoologyId}`,
          url: absolute(courseLink?.getAttribute('href')) || `${location.origin}/course/${courseSchoologyId}`
        });
      }

      if (!courseSchoologyId) {
        const normalized = nearby.toLowerCase();
        const match = [...coursesById.values()]
          .sort((a, b) => b.title.length - a.title.length)
          .find(course => normalized.includes(course.title.toLowerCase()));
        courseSchoologyId = match?.schoologyId || '';
      }

      if (!courseSchoologyId || !coursesById.has(courseSchoologyId)) return;
      const course = coursesById.get(courseSchoologyId);

      out.set(id, {
        schoologyId: id,
        courseSchoologyId,
        title: title.slice(0, 500),
        description: nearby.slice(0, 1000),
        dueAt,
        category: 'preparatory',
        pointsValue: 0,
        isMissing: /\bmissing\b/i.test(nearby),
        url: href,
        source: 'calendar'
      });
    });

    return [...out.values()];
  }

  async function fetchDoc(path) {
    const url = absolute(path);
    if (!url) throw new Error('Invalid Schoology URL.');
    const response = await fetch(url, { credentials: 'include', headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`Schoology returned ${response.status}`);
    return { doc: new DOMParser().parseFromString(await response.text(), 'text/html'), url: response.url || url };
  }

  async function collect() {
    const coursesById = new Map();

    try {
      const dashboard = await fetchDoc('/home/course-dashboard');
      parseCourses(dashboard.doc, dashboard.url).forEach(course => coursesById.set(course.schoologyId, course));
    } catch (_) {}

    if (!coursesById.size) parseCourses(document, location.href).forEach(course => coursesById.set(course.schoologyId, course));

    const assignmentsById = new Map();
    const currentSeed = calendarUserAndMonth(location.href);

    // Parse the loaded Schoology page first. As assignment cards are processed,
    // any course links they contain are added to coursesById before validation.
    parseCalendarAssignments(document, coursesById, currentSeed?.month || monthKey(new Date()))
      .forEach(item => assignmentsById.set(item.schoologyId, item));

    let calendarSeed = currentSeed;
    try {
      if (!calendarSeed) {
        const calendarResult = await fetchDoc('/calendar');
        calendarSeed = calendarUserAndMonth(calendarResult.url)
          || calendarUserAndMonth([...calendarResult.doc.querySelectorAll('a[href*="/calendar/"]')].map(a => a.href).find(Boolean));
      }
    } catch (_) {}

    let calendarMonthsFetched = 0;
    let calendarWindowEnd = null;

    if (calendarSeed) {
      const [year, month] = calendarSeed.month.split('-').map(Number);
      for (let offset = 0; offset < 3; offset += 1) {
        const monthDate = new Date(year, month - 1 + offset, 1);
        const key = monthKey(monthDate);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
        calendarWindowEnd = monthEnd.toISOString();

        try {
          const result = offset === 0 && currentSeed?.month === key
            ? { doc: document }
            : await fetchDoc(`/calendar/${calendarSeed.userId}/${key}`);
          parseCalendarAssignments(result.doc, coursesById, key)
            .forEach(item => assignmentsById.set(item.schoologyId, item));
          calendarMonthsFetched += 1;
        } catch (_) {}
      }
    }

    return {
      courses: [...coursesById.values()],
      assignments: [...assignmentsById.values()],
      schoolName: location.hostname,
      calendarSync: true,
      calendarMonthsFetched,
      calendarWindowEnd
    };
  }

  let syncInFlight = null;
  async function sync() {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      button.disabled = true;
      button.textContent = 'Syncing…';
      status.textContent = 'Reading your Schoology calendar…';
      sub.textContent = 'Secure connection';
      try {
        const payload = await collect();
        status.textContent = `Found ${payload.courses.length} classes and ${payload.assignments.length} upcoming items. Connecting…`;
        const result = await chrome.runtime.sendMessage({ type: 'CONNECT_AND_SYNC', payload });
        if (!result?.ok) throw new Error(result?.message || 'Could not connect to ClassPilot.');
        status.textContent = `Synced ${result.classesImported ?? payload.courses.length} classes · ${(result.assignmentsImported ?? 0) + (result.assignmentsUpdated ?? 0)} upcoming items.`;
        sub.textContent = 'Connected · automatic sync on';
        button.textContent = 'Sync now';
        return result;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Sync could not be completed.';
        sub.textContent = 'Needs attention';
        button.textContent = 'Connect & sync';
        return { ok: false, message: status.textContent };
      } finally {
        button.disabled = false;
        syncInFlight = null;
      }
    })();
    return syncInFlight;
  }

  button.addEventListener('click', sync);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'SYNC_NOW') return false;
    sync().then(sendResponse).catch(error => sendResponse({ ok: false, message: error?.message || 'Schoology sync failed.' }));
    return true;
  });

  sync();
  setInterval(sync, 10 * 60 * 1000);
})();
