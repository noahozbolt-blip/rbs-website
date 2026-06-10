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

  /* ─── Project Modal ──────────────── */
  const projectData = [
    {
      category: 'Projektentwicklung',
      title: 'Bestandsentwicklung',
      location: 'Deutschland',
      status: 'Aktiv',
      statusClass: 'status-complete',
      img: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80',
      specs: [
        { value: '50+', label: 'Wohneinheiten' },
        { value: '>10.000', label: 'qm Mietfläche' },
        { value: 'Aktiv', label: 'Bewirtschaftung' }
      ],
      desc: '<p>Entwicklung und nachhaltige Bewirtschaftung von Wohn- und Bestandsimmobilien mit über 50 Einheiten und mehr als 10.000 Quadratmetern vermietbarer Fläche.</p><p>RBS Projektentwicklung GbR entwickelt und verwaltet diesen Bestand wirtschaftlich fundiert — mit Fokus auf langfristige Wertschöpfung, stabile Mietrenditen und substanzielle Qualität in der Immobilienbewirtschaftung.</p>'
    },
    {
      category: 'Ambulant betreutes Wohnen & Gastronomie',
      title: 'Soziales Wohnprojekt Niedererbach',
      location: 'Niedererbach, Rheinland-Pfalz',
      status: 'In Betrieb',
      statusClass: 'status-complete',
      img: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
      specs: [
        { value: '15', label: 'Einheiten' },
        { value: 'Gastro', label: 'Gastronomie' },
        { value: 'Sozial', label: 'Betreuung' }
      ],
      desc: '<p>Das Objekt in Niedererbach wird als ambulant betreutes Wohnangebot betrieben und bietet Menschen mit Unterstützungsbedarf die Möglichkeit eines selbstbestimmten Wohnens in einem geeigneten und betreuten Umfeld.</p><p>Ergänzend hierzu wurde eine Gastronomie etabliert, die sowohl den Bewohnern als auch der Öffentlichkeit zur Verfügung steht. Durch die Wiederbelebung eines gastronomischen Angebots im Ort wird ein Beitrag zur Stärkung der lokalen Infrastruktur und zur Belebung des Dorfkerns geleistet.</p><p>Die Gaststätte dient als sozialer Treffpunkt für Einwohner und Besucher und ermöglicht darüber hinaus die Bestellung und Abholung von Speisen. Hierdurch wurde ein Angebot geschaffen, das die Attraktivität des Ortskerns erhöht und die örtliche Nahversorgung ergänzt.</p><p>Das Gesamtobjekt verbindet soziale Betreuung mit einem öffentlich zugänglichen Gastronomiebetrieb und trägt damit zur nachhaltigen Stärkung des Gemeinwesens sowie zur Förderung des gesellschaftlichen Miteinanders in Niedererbach bei.</p>'
    },
    {
      category: 'Revitalisierung & Wohnungsbau',
      title: 'Projekt Flacht',
      location: 'Flacht',
      status: 'In Planung',
      statusClass: 'status-planning',
      img: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80',
      specs: [
        { value: '3', label: 'Nutzungsarten' },
        { value: 'Revita.', label: 'Maßnahme' },
        { value: '2025', label: 'Start' }
      ],
      desc: '<p>Das Projekt Flacht befindet sich derzeit in der Entkernungs-, Abriss- und Planungsphase. Ziel des Vorhabens ist die nachhaltige Revitalisierung einer Bestandsimmobilie sowie die Schaffung von dringend benötigtem Wohnraum für unterschiedliche Bevölkerungsgruppen.</p><p>Nach aktuellem Planungsstand ist eine Kombination aus ambulant betreutem Wohnen, Eigentumswohnungen sowie Mietwohnungen vorgesehen. Durch diesen Nutzungsmix soll sowohl den Bedürfnissen von Menschen mit Unterstützungsbedarf als auch dem allgemeinen Wohnraumbedarf Rechnung getragen werden.</p><p>Ein besonderer Schwerpunkt liegt auf der Schaffung von bezahlbarem Wohnraum für Familien, Berufstätige und Senioren. Gleichzeitig sollen einzelne Wohneinheiten als Eigentumswohnungen entwickelt werden, um eine ausgewogene Bewohnerstruktur und langfristige Investitionen in den Standort zu fördern.</p><p>Das geplante ambulant betreute Wohnen soll Menschen mit Unterstützungsbedarf die Möglichkeit bieten, in einem selbstbestimmten Umfeld zu leben und gleichzeitig bedarfsgerechte Betreuung in Anspruch nehmen zu können.</p><p>Das Projekt verfolgt insgesamt das Ziel, bestehenden Gebäudebestand nachhaltig zu modernisieren, die Wohnraumsituation vor Ort zu verbessern und einen langfristigen Beitrag zur sozialen und städtebaulichen Entwicklung der Gemeinde Flacht zu leisten.</p>'
    }
  ];

  const projectModal = document.getElementById('projectModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalClose = document.getElementById('modalClose');

  function openModal(index) {
    const p = projectData[index];
    if (!p || !projectModal) return;

    document.getElementById('modalImg').src = p.img;
    document.getElementById('modalImg').alt = p.title;

    const badge = document.getElementById('modalBadge');
    badge.textContent = p.status;
    badge.className = 'project-status ' + p.statusClass;

    document.getElementById('modalCat').textContent = p.category;
    document.getElementById('modalHeading').textContent = p.title;
    document.getElementById('modalLoc').innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ' + p.location;

    document.getElementById('modalSpecsRow').innerHTML = p.specs.map(s =>
      '<div class="spec-item"><div class="spec-value">' + s.value + '</div><div class="spec-label">' + s.label + '</div></div>'
    ).join('');

    document.getElementById('modalDesc').innerHTML = p.desc;

    projectModal.setAttribute('aria-hidden', 'false');
    projectModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // scroll panel to top
    const panel = projectModal.querySelector('.modal-panel');
    if (panel) panel.scrollTop = 0;
  }

  function closeModal() {
    if (!projectModal) return;
    projectModal.classList.remove('open');
    projectModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (projectModal) {
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  document.querySelectorAll('[data-project]').forEach(card => {
    card.addEventListener('click', () => openModal(parseInt(card.dataset.project)));
  });

})();
