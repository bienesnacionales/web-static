(() => {
  'use strict';
  const infoButton = document.getElementById('mbn-chat-info-button');
  const infoTooltip = document.getElementById('mbn-chat-info-tooltip');
  if (infoButton && infoTooltip) {
    const info = infoButton.closest('.mbn-chat__info');
    const setInfoOpen = open => {
      infoTooltip.hidden = !open;
      infoButton.setAttribute('aria-expanded', String(open));
    };
    info.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') setInfoOpen(true); });
    info.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch' && !infoButton.matches(':focus-visible')) setInfoOpen(false); });
    infoButton.addEventListener('focus', () => { if (infoButton.matches(':focus-visible')) setInfoOpen(true); });
    infoButton.addEventListener('blur', () => setInfoOpen(false));
    infoButton.addEventListener('click', () => setInfoOpen(infoTooltip.hidden));
    infoButton.addEventListener('keydown', event => {
      if (event.key === 'Escape') { setInfoOpen(false); event.preventDefault(); event.stopPropagation(); }
    });
    document.addEventListener('click', event => { if (!info.contains(event.target)) setInfoOpen(false); });
    window.matchMedia('(max-width: 767px)').addEventListener('change', () => setInfoOpen(false));
    const chatPanel = document.getElementById('mbn-chat-panel');
    if (chatPanel) new MutationObserver(() => { if (chatPanel.hidden) setInfoOpen(false); }).observe(chatPanel, {attributes:true,attributeFilter:['hidden']});
  }
  const root = document.getElementById('mbn-chat'), config = window.MBNChatbot;
  if (!root || !config || !window.MBNChatHistory || !window.MBNChatConversation) return;
  const panel = document.getElementById('mbn-chat-panel'), launcher = document.getElementById('mbn-chat-launcher');
  const messages = document.getElementById('mbn-chat-messages'), form = document.getElementById('mbn-chat-form');
  const input = document.getElementById('mbn-chat-input'), send = form.querySelector('button');
  const presence = document.getElementById('mbn-chat-presence'), finish = document.getElementById('mbn-chat-end');
  const greeting = '¡Hola! Soy el asistente virtual del Ministerio de Bienes Nacionales. Puedo orientarle con información publicada en las preguntas frecuentes y los trámites del sitio. Soy un sistema automatizado; no una persona. Evite compartir datos personales. ¿En qué le puedo ayudar?';
  const fallback = [{title: 'Preguntas frecuentes', url: config.links.faq}, {title: 'Trámites', url: config.links.tramites}];
  const topicLabels = [['Preguntas frecuentes', 'faq'], ['Trámites', 'tramites'], ['Participación ciudadana', 'participacion'], ['Otro', 'otro']];
  const identifier = () => crypto.randomUUID().replaceAll('-', '');
  input.maxLength = config.messageLimit;
  input.minLength = 2;
  const responseTimeout = Math.max(38, Math.min(60, Number(config.responseTimeout) || 38)) * 1000;
  let state = null, timer, signature = '', bootstrapping, localRequest = '', ending = false, endedByIdle = false, updatingActivity = false;
  const history = window.MBNChatHistory.create(config, receive);
  async function request(route, body, token = '', keepalive = false) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), responseTimeout);
    try {
      const response = await fetch(config.endpoint + route, {method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive, signal: controller.signal,
        headers: {'Content-Type': 'application/json', ...(token ? {'X-MBN-Chat-Session': token} : {})}, body: JSON.stringify(body)});
      let data = {}; try { data = await response.json(); } catch (_) { /* clasificar formato inválido */ }
      if (!response.ok) { const error = new Error(data.status || 'unavailable'); error.status = response.status; throw error; }
      return data;
    } finally { clearTimeout(timeout); }
  }
  function event(type, value = state, beacon = false) {
    if (!value?.session) return Promise.resolve();
    const body = {event: type, event_id: identifier(), topic: value.topic};
    if (beacon) { navigator.sendBeacon(config.endpoint + 'event', new Blob([JSON.stringify({...body, session: value.session})], {type: 'application/json'})); return Promise.resolve(); }
    return request('event', body, value.session, true).catch(() => {});
  }
  function setOpen(value, focus = false) {
    root.dataset.open = String(value); panel.hidden = !value; history.panelOpen(value);
    launcher.setAttribute('aria-expanded', String(value)); launcher.setAttribute('aria-label', (value ? 'Cerrar' : 'Abrir') + ' asistente virtual MBN');
    if (focus) (value ? input : launcher).focus();
  }
  function available(value) { root.dataset.available = String(value); presence.textContent = value ? 'En línea' : 'No disponible por el momento'; }
  function pill(label, click) { const button = document.createElement('button'); button.type = 'button'; button.className = 'mbn-chat__pill'; button.textContent = label; button.addEventListener('click', click); return button; }
  function bubble(item) {
    const row = document.createElement('div'); row.className = 'mbn-chat__message' + (item.user ? ' mbn-chat__message--user' : '');
    if (item.type === 'pending') row.classList.add('mbn-chat__pending');
    if (item.type === 'warning') row.dataset.idleWarning = 'true';
    if (!item.user) { const avatar = document.createElement('span'); avatar.className = 'mbn-chat__avatar'; avatar.setAttribute('aria-hidden', 'true'); row.append(avatar); }
    const content = document.createElement('div'); content.className = 'mbn-chat__bubble';
    const text = document.createElement('p'); text.className = 'mbn-chat__text'; text.textContent = item.text; content.append(text);
    const links = document.createElement('div'); links.className = 'mbn-chat__sources';
    for (const source of item.sources) {
      if (source.url === config.contactUrl || /^(?:ver canales de atenci[oó]n|atenci[oó]n humana)$/i.test(source.title)) continue;
      const link = document.createElement('a'); link.className = 'mbn-chat__pill'; link.href = source.url; link.textContent = source.title;
      link.addEventListener('click', () => {
        event('source_click', state, true);
      });
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M14 3h7v7 M21 3 11 13 M10 5H4v16h16v-6'); icon.append(path); link.append(icon); links.append(link);
    }
    if (links.childElementCount) content.append(links);
    const time = document.createElement('time'); time.className = 'mbn-chat__time'; time.dateTime = new Date(item.time).toISOString();
    time.textContent = new Intl.DateTimeFormat('es-CL', {hour: '2-digit', minute: '2-digit'}).format(new Date(item.time)); content.append(time);
    if (item.type === 'warning') content.append(pill('Sigo aquí', () => activity(true)));
    const latest = state?.entries.filter(entry => entry.type !== 'warning').at(-1);
    if (!item.user && latest?.id === item.id && !state.pending) {
      const actions = document.createElement('div'); actions.className = 'mbn-chat__actions'; actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', 'Continuar o finalizar la consulta');
      const action = (label, kind) => actions.append(pill(label, () => flow(kind, '', item.id)));
      if (item.type === 'answer' && config.answerFeedback) {
        const prompt = document.createElement('p'); prompt.className = 'mbn-chat__feedback'; prompt.textContent = '¿Esta información resolvió su consulta?'; content.append(prompt);
        action('Sí, me ayudó', 'feedback_helpful'); action('No, necesito ayuda', 'feedback_unhelpful');
      } else if (item.type === 'resolved') {
        action('Hacer otra consulta', 'new_query'); action('Finalizar conversación', 'finish');
      } else if (item.type === 'end_confirm') {
        action('Sí, finalizar', 'finish'); action('Seguir conversando', 'refine');
      } else if (['assistance', 'human_help'].includes(item.type)) {
        action('Precisar mi consulta', 'refine'); action('Finalizar conversación', 'finish');
      }
      if (actions.childElementCount) content.append(actions);
    }
    row.append(content); messages.append(row);
  }
  function render() {
    if (!state || state.closed) { messages.replaceChildren(); signature = ''; send.disabled = false; form.removeAttribute('aria-busy'); return; }
    available(state.available); send.disabled = !!state.pending; finish.disabled = !!state.pending; form.setAttribute('aria-busy', String(!!state.pending));
    const next = state.entries.map(item => item.id).join(',') + JSON.stringify([state.showTopics, state.choices, state.truncated, !!state.pending]);
    if (next === signature) return;
    signature = next; messages.replaceChildren();
    if (state.truncated) { const notice = document.createElement('p'); notice.textContent = 'Se muestran los últimos mensajes de esta conversación.'; messages.append(notice); }
    for (const item of state.entries) bubble(item);
    if (state.showTopics) { const buttons = document.createElement('div'); buttons.className = 'mbn-chat__topics'; for (const [label, key] of topicLabels) buttons.append(pill(label, () => topic(label, key))); messages.append(buttons); }
    if (state.choices.length) {
      const choices = document.createElement('div'); choices.className = 'mbn-chat__topics'; choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', 'Opciones para precisar la consulta');
      for (const label of state.choices) choices.append(pill(label, () => { if (state.pending) return; input.value = label; form.requestSubmit(); })); messages.append(choices);
    }
    messages.scrollTop = messages.scrollHeight;
  }
  function receive(value) {
    const wasActive = state && !state.closed; state = value; render(); clearTimeout(timer);
    if (state?.closed) { if (wasActive) { endedByIdle = true; input.value = ''; setOpen(false); } return; }
    schedule();
  }
  function schedule() {
    clearTimeout(timer); if (!state || state.closed) return;
    const idleAt = state.lastActivity + state.idleSeconds * 1000, warningAt = state.lastActivity + state.warningSeconds * 1000;
    const warned = state.entries.some(item => item.type === 'warning');
    const due = state.pending ? state.pending.until : state.warningSeconds > 0 && !warned ? Math.min(warningAt, idleAt) : idleAt;
    timer = setTimeout(checkIdle, Math.max(1, due - Date.now()));
  }
  async function checkIdle() {
    let warning = null, closed = null;
    await history.transaction(value => {
      if (!value || value.closed) return;
      const now = Date.now();
      if (value.pending) {
        if (value.pending.until > now) return;
        value.entries = value.entries.filter(item => item.type !== 'pending'); value.pending = null;
        value.entries.push(history.message('La consulta anterior se interrumpió. Puede volver a enviarla; no la reenviamos automáticamente.'));
      }
      if (now - value.lastActivity >= value.idleSeconds * 1000) { closed = value; return history.close(value); }
      if (value.warningSeconds > 0 && now - value.lastActivity >= value.warningSeconds * 1000 && !value.entries.some(item => item.type === 'warning')) {
        const remaining = Math.max(1, Math.ceil((value.lastActivity + value.idleSeconds * 1000 - now) / 60000));
        value.entries.push(history.message('¿Sigue ahí? Cerraremos esta conversación por inactividad en ' + remaining + (remaining === 1 ? ' minuto.' : ' minutos.') + ' Puede continuar escribiendo o pulsar «Sigo aquí».', false, [], 'warning')); warning = value;
      }
      return value;
    });
    if (closed) { endedByIdle = true; await event('inactivity_client', closed); }
    if (warning) await event('idle_warning', warning);
    schedule();
  }
  async function activity(explicit = false) {
    if (ending || updatingActivity || !state || state.closed) return;
    updatingActivity = true; let resumed = null, heartbeat = null;
    try {
      await history.transaction(value => {
        if (!value || value.closed) return;
        if (!value.pending && Date.now() - value.lastActivity >= value.idleSeconds * 1000) return;
        if (value.entries.some(item => item.type === 'warning')) { value.entries = value.entries.filter(item => item.type !== 'warning'); resumed = value; }
        value.lastActivity = Date.now();
        if (Date.now() - value.lastHeartbeat > 30000) { value.lastHeartbeat = Date.now(); heartbeat = value; }
        return value;
      });
      if (resumed) await event('idle_resumed', resumed);
      if (heartbeat) { if (Date.now() > heartbeat.expires) await bootstrap(); await event('activity', state); }
      if (explicit && !panel.hidden) input.focus();
    } finally { updatingActivity = false; schedule(); }
  }
  async function bootstrap() {
    if (bootstrapping) return bootstrapping;
    bootstrapping = history.transaction(async previous => {
      const expired = previous && !previous.closed && !previous.pending && Date.now() - previous.lastActivity >= previous.idleSeconds * 1000;
      if (expired) { event('inactivity_client', previous, true); previous = null; endedByIdle = true; }
      const token = previous && !previous.closed ? previous.session : '';
      const data = await request('session', {page_id: config.pageId}, token);
      if (typeof data.session !== 'string') throw new Error('unavailable');
      let value = previous;
      if (!token || !data.resumed) {
        value = history.fresh(data.session, data.available);
        if (token || endedByIdle) value.entries.push(history.message('La conversación anterior finalizó. Comencemos una nueva consulta.'));
        value.entries.push(history.message(greeting)); endedByIdle = false;
      } else { value.session = data.session; value.expires = Date.now() + 840000; value.available = data.available === true; }
      return value;
    });
    try { return await bootstrapping; } finally { bootstrapping = null; }
  }
  async function open(restoring = false) {
    if (ending) return;
    setOpen(true);
    try { await bootstrap(); if (!restoring) { await activity(); event('panel_open'); } }
    catch (_) { available(false); if (!state || state.closed) { messages.replaceChildren(); bubble(history.message('El asistente no está disponible por el momento. Puede revisar las preguntas frecuentes y los trámites del sitio.', false, fallback)); } }
    if (!restoring) input.focus();
    if (!history.persistent || (config.historyMode === 'shared' && history.mode !== 'shared')) document.getElementById('mbn-chat-note').textContent = !history.persistent ? 'Este navegador no permite conservar el historial al cambiar de página. Evite datos personales.' : 'El historial se conserva en esta pestaña. Evite datos personales.';
  }
  async function end(reason) {
    if (ending || !state || state.closed || state.pending) return;
    ending = true; let closed;
    try {
      await history.transaction(value => { if (!value || value.closed || value.pending) return; closed = value; return history.close(value); });
      // El envío usa keepalive y solo afecta la sesión cerrada. No bloquear una nueva apertura.
      if (closed) event(reason, closed);
      endedByIdle = reason === 'inactivity_client'; input.value = ''; setOpen(false, true);
    } finally { ending = false; }
  }
  async function flow(kind, text = '', expected = '') {
    if (ending || !state || state.closed || state.pending) return;
    if (kind === 'finish') {
      if (expected && state.entries.filter(item => item.type !== 'warning').at(-1)?.id !== expected) return;
      return end('manual_end');
    }
    let accepted = false;
    await history.transaction(value => {
      if (!value || value.closed || value.pending || (expected && value.entries.filter(item => item.type !== 'warning').at(-1)?.id !== expected)) return;
      accepted = true; value.entries = value.entries.filter(item => item.type !== 'warning'); value.lastActivity = Date.now(); value.choices = []; value.showTopics = false;
      if (text) value.entries.push(history.message(text, true));
      let reply = '', sources = [], type = 'message';
      if (kind === 'greeting' || kind === 'identity') reply = greeting;
      else if (kind === 'feedback_helpful' || kind === 'resolved') {
        if (kind === 'feedback_helpful' && !text) value.entries.push(history.message('Sí, me ayudó', true));
        reply = 'Gracias por conversar con el asistente virtual MBN. ¿Desea hacer otra consulta o finalizar la conversación?'; type = 'resolved';
      } else if (kind === 'feedback_unhelpful' || kind === 'assistance') {
        if (kind === 'feedback_unhelpful' && !text) value.entries.push(history.message('No, necesito ayuda', true));
        reply = 'Puede indicar qué aspecto necesita aclarar para buscar información más precisa en el sitio.';
        type = 'assistance';
      } else if (kind === 'human_help') {
        reply = 'Soy un asistente virtual y no puedo transferir conversaciones. Puede describir su consulta para buscar información publicada en el sitio.';
        type = 'human_help';
      } else if (kind === 'end_confirm') { reply = '¿Desea finalizar la conversación? Al confirmar se eliminará el historial temporal de esta sesión en el navegador. Puede comenzar una nueva cuando lo necesite.'; type = 'end_confirm'; }
      else if (kind === 'new_query') { value.context = ''; value.topic = 'otro'; value.showTopics = true; reply = '¿En qué otra consulta sobre el sitio le puedo ayudar?'; }
      else if (kind === 'refine') reply = 'Escriba qué aspecto necesita aclarar o agregue más detalles sobre el trámite o la pregunta frecuente. Evite datos personales.';
      if (reply) value.entries.push(history.message(reply, false, sources, type));
      return value;
    });
    if (accepted && ['feedback_helpful', 'feedback_unhelpful', 'human_help', 'new_query'].includes(kind)) await event(kind);
    if (accepted) { await activity(); input.focus(); }
  }
  async function topic(label, key) {
    if (!state || state.closed || state.pending) return;
    await activity(); await history.transaction(value => {
      if (!value || value.closed || value.pending) return;
      value.context = ''; value.topic = key; value.choices = []; value.showTopics = false; value.entries.push(history.message(label, true));
      const text = key === 'otro' ? 'Puede escribir su consulta. Le ayudaré a encontrar información publicada en las preguntas frecuentes y los trámites del sitio.' : key === 'participacion' ? 'Puede consultar la información de participación ciudadana en esta página del sitio.' : 'Puede escribir una pregunta sobre ' + (key === 'faq' ? 'las preguntas frecuentes' : 'los trámites') + ' o revisar esta sección del sitio.';
      value.entries.push(history.message(text, false, config.links[key] ? [{title: label, url: config.links[key]}] : [])); return value;
    }); event('topic'); input.focus();
  }
  launcher.addEventListener('click', () => { if (panel.hidden) open(); else { event('panel_close'); setOpen(false, true); } });
  finish.addEventListener('click', () => flow('end_confirm'));
  for (const name of ['pointerdown', 'keydown', 'input']) root.addEventListener(name, () => { if (!panel.hidden) activity(); });
  window.addEventListener('pagehide', () => event('page_exit', state, true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { const value = history.read(); if (value) receive(value); checkIdle(); } });
  window.addEventListener('pageshow', e => { if (e.persisted) { const value = history.read(); if (value) receive(value); checkIdle(); } });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); event('panel_close'); setOpen(false, true); } });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async e => {
    e.preventDefault(); const text = input.value.trim();
    if (ending || localRequest || state?.pending || text.length < 2 || Array.from(text).length > config.messageLimit) return;
    localRequest = identifier(); const requestId = localRequest; let claimed = null;
    try {
      if (!state || state.closed || Date.now() > state.expires) await bootstrap();
      const social = window.MBNChatConversation.classify(text, config.answerFeedback ? state.entries.filter(item => item.type !== 'warning').at(-1)?.type : '');
      if (social) { input.value = ''; localRequest = ''; await flow(social, text); return; }
      if (text.length < 3) return;
      await history.transaction(value => {
        if (!value || value.closed || value.pending) return;
        value.lastActivity = Date.now(); value.showTopics = false; value.choices = []; value.entries = value.entries.filter(item => item.type !== 'warning');
        value.entries.push(history.message(text, true)); value.entries.push(history.message('Estoy consultando la información del sitio…', false, [], 'pending'));
        value.pending = {id: requestId, until: Date.now() + responseTimeout + 7000}; claimed = structuredClone(value); return value;
      });
      if (!claimed) return; input.value = '';
      const data = await request('message', {message: text, request_id: requestId, topic: claimed.topic, context: claimed.context}, claimed.session);
      if (!['answered', 'no_evidence', 'related_suggested', 'clarification_requested'].includes(data.status) || typeof data.answer !== 'string') throw new Error('unavailable');
      await history.transaction(value => {
        if (!value || value.closed || value.generation !== claimed.generation || value.pending?.id !== requestId) return;
        value.entries = value.entries.filter(item => item.type !== 'pending'); value.pending = null; value.available = true;
        value.context = typeof data.context === 'string' ? data.context : ''; value.choices = data.status === 'clarification_requested' ? data.choices || [] : [];
        const sources = [...(Array.isArray(data.sources) ? data.sources : []), ...(data.status === 'no_evidence' ? fallback : [])];
        value.entries.push(history.message(data.answer, false, sources, ['answered', 'related_suggested'].includes(data.status) ? 'answer' : data.status === 'no_evidence' ? 'assistance' : 'message')); return value;
      });
    } catch (error) {
      await history.transaction(value => {
        if (!value || value.closed || (claimed && value.generation !== claimed.generation)) return;
        if (claimed && value.pending?.id !== requestId) return;
        value.entries = value.entries.filter(item => item.type !== 'pending'); value.pending = null;
        let text = 'El asistente no está disponible por el momento. Puede revisar las preguntas frecuentes y los trámites del sitio.';
        if (error.status === 429) text = 'El asistente está atendiendo otras consultas o se alcanzó el límite de uso. Espere un momento antes de volver a intentarlo.';
        if (error.status === 403) return history.close(value);
        if (error.status !== 429) value.available = false;
        value.entries.push(history.message(text, false, fallback, 'assistance')); return value;
      }); if (error.status !== 429) available(false);
    } finally { if (localRequest === requestId) localRequest = ''; schedule(); }
  });
  const saved = history.read();
  if (saved && !saved.closed) {
    if (Date.now() - saved.lastActivity < saved.idleSeconds * 1000 || saved.pending?.until > Date.now()) {
      if (history.panelOpen()) open(true);
    } else {
      let expired = null;
      history.transaction(value => {
        if (!value || value.closed || value.pending?.until > Date.now() || Date.now() - value.lastActivity < value.idleSeconds * 1000) return;
        expired = value; return history.close(value);
      }).then(() => { if (expired) event('inactivity_client', expired); }); endedByIdle = true;
    }
  }
})();
