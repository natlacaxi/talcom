// Copie du HTML tel qu'il est au chargement (repli si le fichier est ouvert hors serveur)
const SELF = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const logos = [...document.querySelectorAll('.logo')];
const drawer = $('drawer');
let active = null;
let current = 'html';
/* ---------- Favicon : suit le thème du navigateur (onglets clairs ou sombres) ---------- */
const FAVICONS = { light: 'icons/favicon-48.png', dark: 'icons/favicon-dark-48.png' };
const osDark = matchMedia('(prefers-color-scheme: dark)');
const setFavicon = () => $('fav').setAttribute('href', osDark.matches ? FAVICONS.dark : FAVICONS.light);
setFavicon();
osDark.addEventListener('change', setFavicon);
/* ---------- Fond sombre ---------- */
let userChose = false;
try { userChose = !!localStorage.getItem('talco-theme'); } catch (e) {}
function applyTheme(t, save) {
  root.dataset.theme = t;
  $('theme-label').textContent = t === 'dark' ? 'Fond clair' : 'Fond sombre';
  $('tc').setAttribute('content', t === 'dark' ? '#0e111c' : '#eef3f8');
  if (save) { try { localStorage.setItem('talco-theme', t); } catch (e) {} }
}
applyTheme(root.dataset.theme || 'light', false);
$('theme').addEventListener('click', () => {
  userChose = true;
  applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
});
osDark.addEventListener('change', (e) => { if (!userChose) applyTheme(e.matches ? 'dark' : 'light', false); });
/* ---------- Animation d'arrivée : chaque logo vient de son côté ---------- */
const FROM = {
  left:   { x: '-115vw', y: '0',      r: -16 },
  tl:     { x: '-90vw',  y: '-110vh', r: 14 },
  right:  { x: '115vw',  y: '0',      r: 16 },
  top:    { x: '0',      y: '-115vh', r: 10 },
  bottom: { x: '0',      y: '115vh',  r: -10 },
};
async function intro() {
  const box = $('logos');
  // On attend le décodage des images pour que l'animation ne démarre pas "dans le vide"
  await Promise.race([
    Promise.all(logos.map((el) => el.querySelector('img').decode().catch(() => {}))),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches; // plus court, sans rotation
  logos.forEach((el, i) => {
    const f = FROM[el.dataset.from];
    const anim = el.animate(
      [
        { transform: `translate(${f.x}, ${f.y}) rotate(${calm ? 0 : f.r}deg) scale(.8)` },
        { transform: 'none' },
      ],
      { duration: calm ? 650 : 1150, delay: 150 + i * 160, easing: 'cubic-bezier(.2, .9, .25, 1.1)', fill: 'backwards' }
    );
    anim.finished.then(() => el.classList.add('ready')).catch(() => el.classList.add('ready'));
  });
  box.style.visibility = 'visible'; // les logos sont déjà hors écran grâce au remplissage "backwards"
}
if (typeof Element.prototype.animate === 'function') {
  intro();
} else {
  $('logos').style.visibility = 'visible';
  logos.forEach((el) => el.classList.add('ready'));
}
/* ---------- Placement : le logo cliqué se centre ---------- */
function place(card) {
  const slot = card.parentElement.getBoundingClientRect();   // position naturelle
  const top = document.querySelector('header').offsetHeight + 10;
  const bottom = innerHeight - drawer.offsetHeight - 10;      // juste au-dessus du tiroir
  const band = Math.max(bottom - top, 80);
  const cy = top + band / 2;
  const scale = Math.max(.6, Math.min(1.35, (band * .92) / slot.height, (innerWidth * .8) / slot.width));
  const dx = innerWidth / 2 - (slot.left + slot.width / 2);
  const dy = cy - (slot.top + slot.height / 2);
  card.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
}
function openFor(card) {
  if (active && active !== card) active.style.transform = '';
  active = card;
  logos.forEach((el) => {
    el.classList.toggle('active', el === card);
    el.classList.toggle('dim', el !== card);
  });
  drawer.style.setProperty('--accent', card.dataset.accent);
  root.style.setProperty('--accent', card.dataset.accent);
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  place(card);
  show(current);
}
function closeAll() {
  if (!active) return;
  active.style.transform = '';
  active = null;
  logos.forEach((el) => el.classList.remove('active', 'dim'));
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}
/* ---------- Site ouvert en grand, avec une simple croix pour revenir au menu ---------- */
const site = $('site'), frame = $('frame');
let siteOpen = false;
function openSite(card) {
  closeAll();
  frame.src = card.dataset.url;
  site.classList.add('open');
  site.setAttribute('aria-hidden', 'false');
  siteOpen = true;
  try { history.pushState({ site: 1 }, ''); } catch (e) {}   // le bouton « retour » du téléphone ferme aussi le site
  $('site-close').focus({ preventScroll: true });
}
function closeSite(fromPop) {
  if (!siteOpen) return;
  siteOpen = false;
  site.classList.remove('open');
  site.setAttribute('aria-hidden', 'true');
  setTimeout(() => { if (!siteOpen) frame.src = 'about:blank'; }, 520);   // coupe le son et libère la mémoire
  if (!fromPop && history.state && history.state.site) history.back();
}
$('site-close').addEventListener('click', () => closeSite(false));
addEventListener('popstate', () => closeSite(true));
logos.forEach((card) => card.addEventListener('click', () => {
  if (card.dataset.url) return openSite(card);      // IDFM, Lignes d'Azur, TER ZOU, RFN : le site s'ouvre en grand
  card === active ? closeAll() : openFor(card);     // Talco Mobilités : code du site
}));
$('close').addEventListener('click', closeAll);
addEventListener('keydown', (e) => { if (e.key === 'Escape') (siteOpen ? closeSite(false) : closeAll()); });
addEventListener('resize', () => active && place(active));
/* ---------- Visionneuse : le HTML du site dans le HTML, puis js, sw, manifeste, yaml ---------- */
async function getHtml() {
  if (/^https?:/.test(location.protocol)) {
    try {
      const r = await fetch(location.href, { cache: 'no-store' });
      if (r.ok) return await r.text();
    } catch (e) { /* on retombe sur la copie */ }
  }
  return SELF;
}
const clean = (id) => $(id).textContent.replace(/^\n/, '').replace(/\n$/, '');
const FILES = [
  { id: 'html', name: 'index.html', get: getHtml },
  { id: 'js', name: 'app.js', get: () => clean('app') },
  { id: 'sw', name: 'sw.js', get: () => clean('src-sw') },
  { id: 'manifest', name: 'manifest.webmanifest', get: () => clean('src-manifest') },
  { id: 'yaml', name: 'deploy.yml', path: '.github/workflows/deploy.yml', get: () => clean('src-yaml') },
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Les images embarquées (base64) rendraient le code illisible : on les abrège à l'affichage
const shorten = (s) => s.replace(/(data:image\/[a-z]+;base64,)[A-Za-z0-9+\/=]{60,}/g, '$1…[image tronquée]');
let raw = '';
async function show(id) {
  current = id;
  const file = FILES.find((f) => f.id === id);
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.id === id)));
  raw = await file.get();
  const lines = shorten(raw).split('\n');
  $('code').innerHTML = lines.map((l) => `<span class="l">${esc(l)}</span>`).join('');
  $('meta').textContent = `${file.path || file.name}  –  ${lines.length} lignes`;
  $('view').scrollTop = 0;
}
FILES.forEach((f) => {
  const b = document.createElement('button');
  b.className = 'tab'; b.type = 'button'; b.dataset.id = f.id; b.textContent = f.name;
  b.setAttribute('role', 'tab');
  b.addEventListener('click', () => show(f.id));
  $('tabs').appendChild(b);
});
$('copy').addEventListener('click', async () => {
  const btn = $('copy');
  try { await navigator.clipboard.writeText(raw); btn.textContent = 'Copié'; }
  catch (e) { btn.textContent = 'Copie impossible'; }
  setTimeout(() => (btn.textContent = 'Copier'), 1600);
});
/* ---------- Installation de l'application ---------- */
let deferredPrompt = null;
const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
if (installed) $('install').hidden = true;
async function runInstall() {            // fenêtre d'installation native, tout de suite
  if (!deferredPrompt) return false;
  const p = deferredPrompt;
  deferredPrompt = null;
  p.prompt();
  try { if ((await p.userChoice).outcome === 'accepted') $('install').hidden = true; } catch (e) {}
  return true;
}
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
addEventListener('appinstalled', () => { deferredPrompt = null; $('install').hidden = true; });
// Automatique : dès le premier geste (les navigateurs exigent un toucher), l'installation est proposée sans autre étape
let autoTried = false;
['click', 'keydown'].forEach((t) => addEventListener(t, () => {
  if (autoTried || installed || !deferredPrompt) return;
  autoTried = true;
  runInstall();
}, true));
function platform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua)) return 'mac';
  return 'desk'; // Windows, Linux, ChromeOS
}
$('install').addEventListener('click', async () => {
  if (await runInstall()) return;  // Chrome, Edge, Android : installation directe
  const me = platform();           // Safari (iOS) n'a pas d'installation directe : mode d'emploi
  document.querySelectorAll('#howto [data-p]').forEach((n) => n.classList.toggle('me', n.dataset.p === me));
  $('howto').showModal();
});
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
