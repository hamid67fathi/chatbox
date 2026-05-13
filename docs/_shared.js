/* Chat-Box Docs — Shared Behavior */
(function () {
  'use strict';

  // ---- Theme toggle ----
  const stored = localStorage.getItem('cb-docs-theme');
  if (stored) document.documentElement.setAttribute('data-theme', stored);

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme')
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('cb-docs-theme', next);
    // re-render mermaid with new theme
    if (window.__mermaidReady && window.mermaid) {
      const isDark = next === 'dark';
      window.mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        themeVariables: { fontFamily: 'Vazirmatn, sans-serif' },
        flowchart: { htmlLabels: true, curve: 'basis' },
        securityLevel: 'loose'
      });
      // Re-render
      document.querySelectorAll('.mermaid').forEach((el, i) => {
        const src = el.dataset.src;
        if (src) {
          el.innerHTML = src;
          el.removeAttribute('data-processed');
        }
      });
      window.mermaid.run({ querySelector: '.mermaid' });
    }
  }
  window.__cbToggleTheme = toggleTheme;

  // ---- Sidebar nav highlight (current page) ----
  document.addEventListener('DOMContentLoaded', () => {
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar nav a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === here) a.classList.add('active');
    });

    // ---- TOC active section on scroll ----
    const tocLinks = document.querySelectorAll('.toc-list a');
    if (tocLinks.length) {
      const map = new Map();
      tocLinks.forEach(a => {
        const id = a.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) map.set(target, a);
      });
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            tocLinks.forEach(l => l.classList.remove('active'));
            const link = map.get(e.target);
            if (link) link.classList.add('active');
          }
        });
      }, { rootMargin: '-80px 0px -70% 0px' });
      map.forEach((_, el) => obs.observe(el));
    }

    // ---- Mobile sidebar ----
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      });
    }

    // ---- Anchor links on headings ----
    document.querySelectorAll('main h2[id], main h3[id]').forEach(h => {
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.className = 'anchor';
      a.textContent = '#';
      a.setAttribute('aria-label', 'link');
      h.appendChild(a);
    });

    // ---- Mermaid init ----
    if (document.querySelector('.mermaid') && window.mermaid) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
        || (!document.documentElement.getAttribute('data-theme')
            && matchMedia('(prefers-color-scheme: dark)').matches);
      // Cache original source so we can re-render on theme toggle
      document.querySelectorAll('.mermaid').forEach(el => {
        if (!el.dataset.src) el.dataset.src = el.innerHTML;
      });
      window.mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        themeVariables: { fontFamily: 'Vazirmatn, sans-serif' },
        flowchart: { htmlLabels: true, curve: 'basis' },
        securityLevel: 'loose'
      });
      window.mermaid.run({ querySelector: '.mermaid' });
      window.__mermaidReady = true;
    }
  });
})();
