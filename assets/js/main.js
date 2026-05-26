/* =========================================
   RBS Projektentwicklung GbR — Main Scripts
   ========================================= */

(function () {
  'use strict';

  /* ─── Navigation Scroll Behavior ─── */
  const nav = document.querySelector('.nav');
  const backTop = document.querySelector('.back-top');

  function onScroll() {
    const y = window.scrollY;
    if (nav) {
      nav.classList.toggle('scrolled', y > 60);
    }
    if (backTop) {
      backTop.classList.toggle('visible', y > 400);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ─── Mobile Menu ────────────────── */
  const toggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('.nav-mobile');

  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const open = toggle.classList.toggle('open');
      mobileNav.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('open');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ─── Smooth Scroll ──────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 80;
      const top = target.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ─── Back to Top ────────────────── */
  if (backTop) {
    backTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ─── Reveal on Scroll ───────────── */
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

  if (revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(el => observer.observe(el));
  }

  /* ─── Animated Counters ──────────── */
  function animateCounter(el, target, duration, suffix) {
    const start = performance.now();
    const isFloat = target % 1 !== 0;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const value = eased * target;
      el.textContent = isFloat ? value.toFixed(1) : Math.round(value).toLocaleString('de-DE');
      if (progress < 1) requestAnimationFrame(update);
      else el.textContent = isFloat
        ? target.toFixed(1)
        : target.toLocaleString('de-DE');
    }

    requestAnimationFrame(update);
  }

  const counterEls = document.querySelectorAll('[data-counter]');

  if (counterEls.length) {
    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseFloat(el.getAttribute('data-counter'));
          const suffix = el.getAttribute('data-suffix') || '';
          animateCounter(el, target, 1800, suffix);
          counterObs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    counterEls.forEach(el => counterObs.observe(el));
  }

  /* ─── Hero Parallax ──────────────── */
  const heroBg = document.querySelector('.hero-bg');

  if (heroBg) {
    heroBg.classList.add('loaded');

    window.addEventListener('scroll', () => {
      if (!heroBg) return;
      const y = window.scrollY;
      if (y < window.innerHeight) {
        heroBg.style.transform = `scale(1) translateY(${y * 0.25}px)`;
      }
    }, { passive: true });
  }

  /* ─── Contact Form ───────────────── */
  const form = document.querySelector('.contact-form');
  const successMsg = document.querySelector('.form-success');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const btn = form.querySelector('[type="submit"]');
      const originalText = btn.textContent;
      btn.textContent = 'Wird gesendet…';
      btn.disabled = true;

      setTimeout(() => {
        form.reset();
        btn.textContent = originalText;
        btn.disabled = false;
        if (successMsg) {
          successMsg.style.display = 'block';
          setTimeout(() => { successMsg.style.display = 'none'; }, 5000);
        }
      }, 1600);
    });
  }

  /* ─── Cookie Banner ──────────────── */
  const banner = document.querySelector('.cookie-banner');
  const acceptBtn = document.querySelector('.cookie-accept');
  const declineBtn = document.querySelector('.cookie-decline');

  const COOKIE_KEY = 'rbs_cookie_consent';

  function hideBanner() {
    if (banner) banner.classList.remove('visible');
  }

  if (banner && !localStorage.getItem(COOKIE_KEY)) {
    setTimeout(() => banner.classList.add('visible'), 1200);
  }

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem(COOKIE_KEY, 'accepted');
      hideBanner();
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener('click', () => {
      localStorage.setItem(COOKIE_KEY, 'declined');
      hideBanner();
    });
  }

  /* ─── Service Card Stagger ───────── */
  const serviceCards = document.querySelectorAll('.service-card');
  serviceCards.forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.08}s`;
  });

  /* ─── Project Card Hover ─────────── */
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 24px 64px rgba(0,0,0,.14)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '';
    });
  });

})();
