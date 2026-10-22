/* ajusta el extracto al alto que dejan las noticias secundarias */
(() => {
    'use strict';

    const excerpts = document.querySelectorAll('.home .mbn-media-cards__item--featured .mbn-media-cards__excerpt');
    if (!excerpts.length) return;

    const desktop = window.matchMedia('(min-width: 768px)');
    const fit = excerpt => {
        if (!desktop.matches) {
            excerpt.style.removeProperty('--mbn-home-excerpt-lines');
            excerpt.style.removeProperty('--mbn-home-excerpt-height');
            return;
        }
        const lineHeight = parseFloat(getComputedStyle(excerpt).lineHeight);
        if (!lineHeight) return;
        const body = excerpt.closest('.mbn-media-cards__body');
        const bodyStyle = getComputedStyle(body);
        const title = body.querySelector('.mbn-media-cards__card-title');
        const cta = body.querySelector('.mbn-media-cards__cta-wrap');
        const available = body.clientHeight
            - parseFloat(bodyStyle.paddingTop) - parseFloat(bodyStyle.paddingBottom)
            - title.getBoundingClientRect().height - cta.getBoundingClientRect().height
            - 2 * parseFloat(bodyStyle.rowGap);
        const lines = Math.max(1, Math.floor(available / lineHeight));
        excerpt.style.setProperty('--mbn-home-excerpt-lines', lines);
        excerpt.style.setProperty('--mbn-home-excerpt-height', `${lines * lineHeight}px`);
    };

    const observer = new ResizeObserver(entries => {
        entries.forEach(({target}) => {
            const body = target.closest('.mbn-media-cards__body');
            fit(body.querySelector('.mbn-media-cards__excerpt'));
        });
    });
    excerpts.forEach(excerpt => {
        const body = excerpt.closest('.mbn-media-cards__body');
        observer.observe(body);
        observer.observe(body.querySelector('.mbn-media-cards__card-title'));
        observer.observe(body.querySelector('.mbn-media-cards__cta-wrap'));
    });
    desktop.addEventListener('change', () => excerpts.forEach(fit));
    document.fonts.ready.then(() => excerpts.forEach(fit));
})();
