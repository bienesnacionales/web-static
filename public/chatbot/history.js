(() => {
  'use strict';
  const MAX_MESSAGES = 200, MAX_BYTES = 2000000;
  const topics = ['faq', 'tramites', 'participacion', 'otro'];
  const id = () => crypto.randomUUID().replaceAll('-', '');
  const number = value => Number.isFinite(value) && value >= 0 && value < 8640000000000000;
  function clean(value) {
    if (!value || value.version !== 2 || !/^[a-f0-9]{32}$/.test(value.generation || '') || !number(value.lastActivity)) return null;
    if (value.closed) return {version: 2, generation: value.generation, revision: Number(value.revision) || 0, closed: true, lastActivity: value.lastActivity, entries: [], context: '', session: ''};
    if (!/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value.session || '') || !number(value.expires) || !Number.isInteger(value.idleSeconds) || value.idleSeconds < 60 || value.idleSeconds > 1800 || !Array.isArray(value.entries)) return null;
    const entries = [];
    for (const item of value.entries.slice(-MAX_MESSAGES)) {
      if (!item || !/^[a-f0-9]{32}$/.test(item.id || '') || typeof item.text !== 'string' || item.text.length > 35000 || !number(item.time)) continue;
      const sources = [];
      for (const source of (Array.isArray(item.sources) ? item.sources : []).slice(0, 10)) {
        try {
          if (typeof source.title !== 'string' || source.title.length > 1000 || typeof source.url !== 'string' || source.url.length > 2048) continue;
          const url = new URL(source.url, location.origin);
          if (url.origin !== location.origin || !['https:', 'http:'].includes(url.protocol)) continue;
          sources.push({title: source.title, url: url.href});
        } catch (_) { /* omitir referencias locales inválidas */ }
      }
      entries.push({id: item.id, text: item.text, user: item.user === true, time: item.time, sources, type: ['message', 'pending', 'warning', 'answer', 'assistance', 'resolved', 'end_confirm', 'human_help'].includes(item.type) ? item.type : 'message'});
    }
    const pending = value.pending && /^[a-f0-9]{32}$/.test(value.pending.id || '') && number(value.pending.until) ? {id: value.pending.id, until: value.pending.until} : null;
    const result = {version: 2, generation: value.generation, revision: Number(value.revision) || 0, closed: false, session: value.session, expires: value.expires, lastActivity: value.lastActivity, idleSeconds: value.idleSeconds, warningSeconds: Math.max(0, Math.min(Number(value.warningSeconds) || 0, value.idleSeconds - 30)), lastHeartbeat: number(value.lastHeartbeat) ? value.lastHeartbeat : 0, context: typeof value.context === 'string' && value.context.length <= 700 ? value.context : '', topic: topics.includes(value.topic) ? value.topic : 'otro', showTopics: value.showTopics === true, available: value.available === true, entries, choices: (Array.isArray(value.choices) ? value.choices : []).filter(v => typeof v === 'string' && v.length <= 60).slice(0, 5), pending, truncated: value.truncated === true || value.entries.length > MAX_MESSAGES};
    while (JSON.stringify(result).length > MAX_BYTES && result.entries.length > 1) { result.entries.shift(); result.truncated = true; }
    return result;
  }
  function create(config, onChange) {
    const shared = config.historyMode === 'shared' && typeof navigator.locks?.request === 'function';
    const mode = shared ? 'shared' : 'tab';
    const key = 'mbn-chat:v2:' + new URL(config.endpoint, location.href).pathname + ':' + mode;
    let storage = null, memory = null, channel = null, serial = Promise.resolve();
    try { storage = shared ? localStorage : sessionStorage; storage.setItem(key + ':probe', '1'); storage.removeItem(key + ':probe'); } catch (_) { storage = null; }
    if (shared) { try { channel = new BroadcastChannel(key); } catch (_) { /* storage sigue sincronizando */ } }
    function read() {
      if (!storage) return memory;
      try { const raw = storage.getItem(key); if (!raw || raw.length > MAX_BYTES + 10000) return null; return clean(JSON.parse(raw)); } catch (_) { return null; }
    }
    function write(value) {
      memory = clean(value); if (!memory) return null;
      try { if (storage) storage.setItem(key, JSON.stringify(memory)); } catch (_) { storage = null; }
      onChange(memory);
      try { channel?.postMessage({revision: memory.revision}); } catch (_) { /* no bloquear el chat */ }
      return memory;
    }
    async function transaction(update) {
      const operation = async () => { const previous = read(), next = await update(previous); if (!next) { if (previous) onChange(previous); return previous; } next.revision = (previous?.revision || 0) + 1; return write(next); };
      if (shared) return navigator.locks.request(key, operation);
      const result = serial.then(operation, operation); serial = result.catch(() => {}); return result;
    }
    function receive() { const value = read(); if (value) onChange(value); }
    if (channel) channel.onmessage = receive;
    window.addEventListener('storage', e => { if (shared && e.key === key) receive(); });
    return {read, transaction, mode, get persistent() { return storage !== null; },
      panelOpen(value) { try { if (typeof value === 'boolean') sessionStorage.setItem(key + ':panel', String(value)); return sessionStorage.getItem(key + ':panel') === 'true'; } catch (_) { return false; } },
      close(value) { return {version: 2, generation: value.generation, closed: true, lastActivity: Date.now(), entries: [], session: '', context: ''}; },
      fresh(token, available) { return {version: 2, generation: id(), closed: false, session: token, expires: Date.now() + 840000, lastActivity: Date.now(), lastHeartbeat: 0, idleSeconds: config.idleSeconds, warningSeconds: config.warningSeconds, entries: [], topic: 'otro', context: '', choices: [], showTopics: true, pending: null, available}; },
      message(text, user = false, sources = [], type = 'message') { return {id: id(), text, user, sources, type, time: Date.now()}; }
    };
  }
  window.MBNChatHistory = {create};
})();
