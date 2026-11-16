/* Shared navigation and home-page behavior. Page features live in their own files. */
(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const track = document.getElementById('logoTrack');
    if (track && !track.dataset.started) {
      track.dataset.started = 'true';
      [...track.children].forEach((item) => track.appendChild(item.cloneNode(true)));
      let position = 0;
      const animate = () => {
        position -= 0.4;
        if (position <= -(track.scrollWidth / 2)) position = 0;
        track.style.transform = `translateX(${position}px)`;
        requestAnimationFrame(animate);
      };
      animate();
    }

    const revealSections = () => {
      const triggerPoint = window.innerHeight - 100;
      document.querySelectorAll('section').forEach((section) => {
        if (section.getBoundingClientRect().top < triggerPoint) {
          section.style.opacity = '1';
          section.style.transform = 'translateY(0)';
        }
      });
    };
    revealSections();
    window.addEventListener('scroll', revealSections, { passive: true });

    const burger = document.getElementById('burgerBtn');
    const nav = document.getElementById('mainNav');
    const backdrop = document.getElementById('navBackdrop');
    if (!burger || !nav) return;

    const closeNav = () => {
      nav.classList.remove('nav-open');
      burger.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      backdrop?.classList.remove('active');
      if (!document.querySelector('[role="dialog"].is-open')) document.body.style.overflow = '';
    };
    const openNav = () => {
      nav.classList.add('nav-open');
      burger.classList.add('open');
      burger.setAttribute('aria-expanded', 'true');
      backdrop?.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    burger.addEventListener('click', () => nav.classList.contains('nav-open') ? closeNav() : openNav());
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNav));
    backdrop?.addEventListener('click', closeNav);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeNav(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 768) closeNav(); });

    const page = location.pathname.split('/').pop() || 'index.html';
    const activePage = page === 'index.html' ? 'home.html' : page;
    nav.querySelectorAll('a').forEach((link) =>
      link.classList.toggle('active', link.getAttribute('href') === activePage));
  });
})();
