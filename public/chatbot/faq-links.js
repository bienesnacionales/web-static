(() => {
  'use strict';
  let revision = 0;
  function triggerFor(root, panel, kind) {
    return [...root.querySelectorAll('[data-bs-toggle="' + kind + '"]')].find(button => button.getAttribute('aria-controls') === panel.id);
  }
  function show(instanceType, target, event) {
    if (instanceType === 'Tab' && target.classList.contains('active')) return Promise.resolve();
    if (instanceType === 'Collapse' && target.classList.contains('show')) return Promise.resolve();
    return new Promise(resolve => {
      target.addEventListener(event, resolve, {once: true});
      window.bootstrap[instanceType].getOrCreateInstance(target, instanceType === 'Collapse' ? {toggle: false} : undefined).show();
    });
  }
  async function openQuestion() {
    const current = ++revision;
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    if (id === 'mbn-chat-contacto') {
      const contact = document.querySelector('.mbn-faq-page .mbn-contact-strip');
      if (contact) { contact.tabIndex = -1; contact.focus({preventScroll: true}); contact.scrollIntoView({block: 'center', behavior: 'instant'}); }
      return;
    }
    const parts = /^mbn-chat-faq-(\d+)-g(\d+)-c(\d+)-q(\d+)$/.exec(id);
    if (!parts) return;
    const targetId = 'mbn-faq-' + parts[1] + '-g' + parts[2] + '-c' + parts[3] + '-acc-panel-' + parts[4];
    const answer = document.getElementById(targetId), root = answer?.closest('.mbn-faq');
    const group = answer?.closest('.mbn-faq__group'), category = answer?.closest('.mbn-faq__panel');
    if (!root || !group || !category || !answer.classList.contains('accordion-collapse') || !window.bootstrap?.Tab || !window.bootstrap?.Collapse) return;
    const groupTab = triggerFor(root, group, 'tab'), categoryTab = triggerFor(root, category, 'tab');
    const questionButton = triggerFor(root, answer, 'collapse');
    if (!groupTab || !categoryTab || !questionButton) return;
    await show('Tab', groupTab, 'shown.bs.tab');
    if (current !== revision) return;
    await show('Tab', categoryTab, 'shown.bs.tab');
    if (current !== revision) return;
    await show('Collapse', answer, 'shown.bs.collapse');
    if (current !== revision) return;
    // El tema actualiza el hash al abrir pestañas; conservar el de la pregunta.
    history.replaceState(history.state, '', '#' + id);
    questionButton.focus({preventScroll: true});
    questionButton.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
  }
  function init() {
    if (!document.querySelector('.mbn-faq, .mbn-faq-page .mbn-contact-strip')) return;
    openQuestion();
    window.addEventListener('hashchange', openQuestion);
    window.addEventListener('pageshow', event => { if (event.persisted) openQuestion(); });
    // Un enlace a la pregunta actual no dispara hashchange si se vuelve a pulsar.
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash && url.hash === location.hash) openQuestion();
    });
  }
  // Los scripts diferidos todavía pueden estar inicializando Bootstrap y el tema.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
