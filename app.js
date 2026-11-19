(function () {
  'use strict';
  const LANGS = ['ar','fr','en'];
  const RTL_LANGS = ['ar'];
  const LANG_KEY = 'assoc_lang';
  const SAFE_PROTOCOLS = ['https:'];
  const state = { settings:{}, translations:{}, menu:[], slices:[], posts:[], icons:{} };

  function escapeHtml(s){
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function safeHref(href){
    if (!href) return '#';
    const h = String(href).trim();
    if (h.startsWith('/') || h.startsWith('#') || h.startsWith('?')) return h;
    if (h.startsWith('data:image/')) return h;
    try {
      const u = new URL(h, location.href);
      if (SAFE_PROTOCOLS.includes(u.protocol)) return h;
    } catch (e) {}
    return '#';
  }
  function iconSvg(name){
    const svg = state.icons && state.icons[name];
    if (svg && /^<svg/i.test(svg)) return svg;
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
  }
  function getLang(){
    const params = new URLSearchParams(location.search);
    let l = params.get('lang');
    if (!l) l = localStorage.getItem(LANG_KEY);
    if (!l) l = state.settings.default_language || 'ar';
    return LANGS.includes(l) ? l : 'ar';
  }
  function setLang(l){
    if (!LANGS.includes(l)) return;
    localStorage.setItem(LANG_KEY, l);
    const url = new URL(location.href);
    url.searchParams.set('lang', l);
    location.href = url.toString();
  }
  function t(key){
    const lang = getLang();
    const dict = state.translations[lang] || {};
    return dict[key] || (state.translations.ar && state.translations.ar[key]) || key;
  }
  async function fetchJson(path){
    try{
      const res = await fetch(path + '?v=' + Date.now(), {cache:'no-store'});
      if (!res.ok) return null;
      return await res.json();
    }catch(e){ return null; }
  }
  async function loadAll(){
    const [s,tr,m,sl,p,ic] = await Promise.all([
      fetchJson('data/settings.json'),
      fetchJson('data/translations.json'),
      fetchJson('data/menu.json'),
      fetchJson('data/slices.json'),
      fetchJson('data/posts.json'),
      fetchJson('data/icons.json'),
    ]);
    state.settings = s || {};
    state.translations = tr || {};
    state.menu = Array.isArray(m) ? m : [];
    state.slices = Array.isArray(sl) ? sl : [];
    state.posts = Array.isArray(p) ? p : [];
    state.icons = ic || {};
  }
  function applyDocLang(){
    const l = getLang();
    document.documentElement.lang = l;
    document.documentElement.dir = RTL_LANGS.includes(l) ? 'rtl' : 'ltr';
  }
  function pickField(obj, base){
    const l = getLang();
    const v = obj[base + '_' + l];
    if (v !== undefined && v !== null && v !== '') return v;
    const ar = obj[base + '_ar'];
    if (ar !== undefined && ar !== null && ar !== '') return ar;
    return '';
  }
  function brandHtml(settings){
    const logo = safeHref(settings.logo_path || 'assets/logo.svg');
    const title = pickField(settings, 'site_title') || 'الجمعية';
    return '<a class="brand" href="index.html"><img src="' + escapeHtml(logo) + '" alt="logo"><span>' + escapeHtml(title) + '</span></a>';
  }
  function langSwitcherHtml(){
    const current = getLang();
    const labels = {ar:'العربية', fr:'Français', en:'English'};
    let html = '<div class="lang-menu">';
    html += '<button class="icon-btn" id="langToggle" type="button" aria-label="' + escapeHtml(t('site.language')) + '">';
    html += iconSvg('globe') + '<span>' + labels[current] + '</span></button>';
    html += '<div class="lang-menu-list" id="langMenu">';
    LANGS.forEach(l => {
      html += '<button type="button" data-lang="' + l + '" class="' + (l===current?'active':'') + '">' + labels[l] + '</button>';
    });
    html += '</div></div>';
    return html;
  }
  function buildHeader(){
    const el = document.getElementById('siteHeader');
    if (!el) return;
    const settings = state.settings;
    const showLogin = settings.show_login_button === true || settings.show_login_button === '1';
    const loginUrl = safeHref(settings.login_url || '#');
    let menuHtml = '';
    state.menu
      .filter(m => m.visible !== false && (!m.roles || m.roles.includes('guest')))
      .sort((a,b) => (a.order||0) - (b.order||0))
      .forEach(m => {
        if (m.type === 'divider') { menuHtml += '<hr>'; return; }
        const label = pickField(m, 'label') || '';
        const href = safeHref(m.target || '#');
        const target = m.open_in_new_tab ? ' target="_blank" rel="noopener noreferrer"' : '';
        menuHtml += '<a href="' + escapeHtml(href) + '"' + target + '>' + escapeHtml(label) + '</a>';
      });
    let html = '<div class="header-inner">';
    html += brandHtml(settings);
    html += '<button class="icon-btn hamburger" id="hamburger" type="button" aria-label="menu">' + iconSvg('menu') + '</button>';
    html += '<nav class="header-nav" id="headerNav">' + menuHtml + '</nav>';
    html += '<div class="header-actions">';
    html += langSwitcherHtml();
    if (showLogin) {
      html += '<a class="icon-btn primary" href="' + escapeHtml(loginUrl) + '">' + iconSvg('user') + '<span>' + escapeHtml(t('site.login')) + '</span></a>';
    }
    html += '</div></div>';
    el.innerHTML = html;
    document.getElementById('hamburger')?.addEventListener('click', () => {
      document.getElementById('headerNav')?.classList.toggle('open');
    });
    document.getElementById('langToggle')?.addEventListener('click', () => {
      document.getElementById('langMenu')?.classList.toggle('open');
    });
    document.querySelectorAll('#langMenu button').forEach(b => {
      b.addEventListener('click', () => setLang(b.dataset.lang));
    });
  }
  function buildHero(){
    const el = document.getElementById('heroSection');
    if (!el) return;
    const title = pickField(state.settings, 'site_title') || '';
    const desc = pickField(state.settings, 'site_description') || '';
    el.innerHTML = '<h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(desc) + '</p>';
  }
  function renderPostsGrid(limit){
    const posts = state.posts.slice().sort((a,b)=> new Date(b.date||0) - new Date(a.date||0)).slice(0, limit||6);
    if (posts.length === 0){
      return '<div class="empty-state">' + escapeHtml(t('site.empty')) + '</div>';
    }
    return posts.map(p => {
      const title = pickField(p, 'title');
      const excerpt = pickField(p, 'excerpt');
      const image = safeHref(p.image || '');
      const imageHtml = image && image !== '#' ? '<img class="post-card-image" src="' + escapeHtml(image) + '" alt="" loading="lazy">' : '';
      return '<article class="post-card" data-animation="' + escapeHtml(state.settings.animation_type||'fade_in') + '">' +
        imageHtml + '<div class="post-card-body"><h3>' + escapeHtml(title) + '</h3>' +
        '<p>' + escapeHtml((excerpt || '').slice(0,200)) + '</p>' +
        '<a class="read-more" href="post.html?id=' + encodeURIComponent(p.id) + '">' + escapeHtml(t('site.readMore')) + ' \u2192</a></div></article>';
    }).join('');
  }
  function renderSlice(slice){
    if (slice.visible === false) return '';
    const type = slice.type || 'text_block';
    const align = slice.alignment || 'center';
    const padMap = {small:'sm', medium:'md', large:'lg'};
    const pad = padMap[slice.padding] || 'md';
    const bg = slice.bg_color || 'var(--pure-white)';
    const fg = slice.text_color || 'var(--charcoal)';
    const anim = slice.animation || state.settings.animation_type || 'fade_in';
    const title = pickField(slice, 'title');
    const content = pickField(slice, 'content');
    const titleHtml = title ? '<h2 class="slice-title">' + escapeHtml(title) + '</h2>' : '';
    let body = '';
    if (type === 'text_block'){
      body = titleHtml + '<div class="slice-content">' + (content || '') + '</div>';
    } else if (type === 'image_text'){
      const img = slice.image ? '<img src="' + escapeHtml(safeHref(slice.image)) + '" alt="" loading="lazy">' : '';
      body = '<div class="image-text"><div><h2 class="slice-title">' + escapeHtml(title) + '</h2><div>' + (content||'') + '</div></div>' + img + '</div>';
    } else if (type === 'gallery'){
      const imgs = Array.isArray(slice.images) ? slice.images : [];
      body = titleHtml + '<div class="gallery">' + imgs.map(u => '<img src="' + escapeHtml(safeHref(u)) + '" alt="" loading="lazy">').join('') + '</div>';
    } else if (type === 'posts_grid'){
      body = titleHtml + '<div class="posts-grid">' + renderPostsGrid(6) + '</div>';
    } else if (type === 'cta'){
      body = '<div class="cta-box"><h2>' + escapeHtml(title) + '</h2><div>' + (content||'') + '</div>' +
             (slice.button_url ? '<a class="btn-solid" href="' + escapeHtml(safeHref(slice.button_url)) + '">' + escapeHtml(pickField(slice,'button_label') || t('site.readMore')) + '</a>' : '') + '</div>';
    } else if (type === 'stats'){
      const stats = Array.isArray(slice.stats) ? slice.stats : [];
      body = titleHtml + '<div class="stats-grid">' + stats.map(s => '<div class="stat-card"><div class="stat-value">' + escapeHtml(String(s.value||'')) + '</div><div class="stat-label">' + escapeHtml(pickField(s,'label')) + '</div></div>').join('') + '</div>';
    } else if (type === 'contact_form'){
      body = titleHtml + '<form class="contact-form" onsubmit="return false"><div><input type="text" placeholder="name"><input type="email" placeholder="email"></div><textarea placeholder="message" rows="4"></textarea><button class="btn-outline" type="submit">' + escapeHtml(t('site.readMore')) + '</button></form>';
    }
    return '<section class="slice ' + pad + ' align-' + align + '" style="background:' + escapeHtml(bg) + ';color:' + escapeHtml(fg) + '" data-animation="' + escapeHtml(anim) + '"><div class="slice-inner">' + body + '</div></section>';
  }
  function buildSlices(){
    const el = document.getElementById('slicesContainer');
    if (!el) return;
    el.innerHTML = state.slices.slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(renderSlice).join('');
  }
  function buildPostsGrid(){
    const grid = document.getElementById('postsGrid');
    if (!grid) return;
    grid.innerHTML = renderPostsGrid(6);
  }
  function buildFooter(){
    const el = document.getElementById('siteFooter');
    if (!el) return;
    const title = pickField(state.settings, 'site_title') || 'الجمعية';
    const logo = safeHref(state.settings.logo_path || 'assets/logo.svg');
    el.innerHTML = '<div class="footer-inner"><div class="footer-brand"><img src="' + escapeHtml(logo) + '" alt=""><span>' + escapeHtml(title) + '</span></div><p>' + escapeHtml(title) + ' - ' + new Date().getFullYear() + '</p></div>';
  }
  function applyTranslations(){
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }
  function setupAnimations(){
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)){
      document.querySelectorAll('[data-animation]').forEach(el => el.classList.add('animated'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting){ e.target.classList.add('animated'); io.unobserve(e.target); }
      });
    }, {threshold: 0.12});
    document.querySelectorAll('[data-animation]').forEach(el => io.observe(el));
  }
  function renderPostPage(){
    const el = document.getElementById('postContainer');
    if (!el) return;
    const id = new URLSearchParams(location.search).get('id');
    const post = state.posts.find(p => String(p.id) === String(id));
    if (!post){
      el.innerHTML = '<div class="notice-box">' + escapeHtml(t('site.notFound')) + '</div><p style="text-align:center;margin-top:20px"><a class="post-back" href="index.html">\u2190 ' + escapeHtml(t('site.back')) + '</a></p>';
      return;
    }
    const title = pickField(post, 'title');
    const content = pickField(post, 'content');
    const date = post.date ? new Date(post.date).toLocaleDateString(getLang()==='ar'?'ar-EG':getLang()) : '';
    const image = safeHref(post.image || '');
    let html = '<a class="post-back" href="index.html">' + iconSvg('arrow-left') + ' ' + escapeHtml(t('site.back')) + '</a>';
    html += '<h1 class="post-title">' + escapeHtml(title) + '</h1>';
    if (date) html += '<div class="post-meta">' + escapeHtml(date) + '</div>';
    if (image && image !== '#') html += '<img class="post-cover" src="' + escapeHtml(image) + '" alt="">';
    html += '<div class="post-content">' + (content || '') + '</div>';
    el.innerHTML = html;
  }
  async function init(){
    await loadAll();
    applyDocLang();
    buildHeader();
    if (document.getElementById('heroSection')) {
      buildHero(); buildSlices(); buildPostsGrid(); buildFooter(); applyTranslations(); setupAnimations();
    }
    if (document.getElementById('postContainer')) {
      renderPostPage(); buildFooter(); applyTranslations();
    }
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();