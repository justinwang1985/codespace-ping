// codespace-ping listener
const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = 'codespace-ping-prefs';

const state = {
  sounds: [],
  prefs: { success: null, error: null, volume: 0.7, showNotif: true },
  activated: false,
  pings: 0,
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(state.prefs, JSON.parse(raw));
  } catch (_) {}
}
function savePrefs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prefs));
}

async function loadSounds() {
  const res = await fetch('/api/sounds');
  const { sounds } = await res.json();
  state.sounds = sounds;

  const successSel = $('#sound-success');
  const errorSel = $('#sound-error');
  successSel.innerHTML = '';
  errorSel.innerHTML = '';

  if (sounds.length === 0) {
    for (const sel of [successSel, errorSel]) {
      const opt = document.createElement('option');
      opt.textContent = '(no audio files in ./sounds)';
      opt.disabled = true;
      sel.appendChild(opt);
    }
    return;
  }

  for (const sel of [successSel, errorSel]) {
    for (const name of sounds) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }
  }

  successSel.value = state.prefs.success && sounds.includes(state.prefs.success)
    ? state.prefs.success : sounds[0];
  errorSel.value = state.prefs.error && sounds.includes(state.prefs.error)
    ? state.prefs.error : (sounds[1] || sounds[0]);

  state.prefs.success = successSel.value;
  state.prefs.error = errorSel.value;
  savePrefs();
}

function play(soundName) {
  if (!soundName) return;
  const audio = new Audio(`/sounds/${encodeURIComponent(soundName)}`);
  audio.volume = state.prefs.volume;
  audio.play().catch((err) => {
    console.warn('Audio blocked:', err);
    $('#activate-card').hidden = false;
  });
}

function notify(event) {
  const sound = event.sound
    || (event.status === 'error' ? state.prefs.error : state.prefs.success);
  play(sound);

  if (state.prefs.showNotif && 'Notification' in window && Notification.permission === 'granted') {
    const title = event.status === 'error' ? '❌ Failed' : '✅ Done';
    new Notification(title, { body: event.message, tag: 'codespace-ping', silent: true });
  }

  addToLog(event);
  state.pings++;
  $('#count').textContent = state.pings;
  flashTitle(event.status === 'error' ? '❌ Failed' : '✅ Done');
}

function addToLog(event) {
  const log = $('#log');
  const empty = log.querySelector('.empty');
  if (empty) empty.remove();

  const li = document.createElement('li');
  li.className = `log-item ${event.status}`;
  const time = new Date(event.time || Date.now()).toLocaleTimeString();
  li.innerHTML = `<span class="time">${time}</span><span class="msg"></span>`;
  li.querySelector('.msg').textContent = event.message;
  log.prepend(li);
  while (log.children.length > 20) log.lastChild.remove();
}

let originalTitle = document.title;
let flashInterval = null;
function flashTitle(prefix) {
  if (!document.hidden) return;
  clearInterval(flashInterval);
  let on = false;
  flashInterval = setInterval(() => {
    document.title = on ? originalTitle : `(!) ${prefix}`;
    on = !on;
  }, 1000);
  document.addEventListener('visibilitychange', stopFlash, { once: true });
}
function stopFlash() {
  clearInterval(flashInterval);
  document.title = originalTitle;
}

let es = null;
function connect() {
  if (es) es.close();
  es = new EventSource('/events');
  es.onopen = () => setStatus('connected', true);
  es.onerror = () => setStatus('reconnecting…', false);
  es.onmessage = (e) => {
    try { notify(JSON.parse(e.data)); }
    catch (err) { console.error('Bad event', err); }
  };
}

function setStatus(text, ok) {
  $('#status-text').textContent = text;
  $('#dot').classList.toggle('ok', ok);
}

async function activate() {
  const a = new Audio();
  a.volume = 0;
  try { await a.play(); } catch (_) {}
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (_) {}
  }
  state.activated = true;
  $('#activate-card').hidden = true;
}

function wireUI() {
  $('#activate-btn').addEventListener('click', activate);
  $('#sound-success').addEventListener('change', (e) => { state.prefs.success = e.target.value; savePrefs(); });
  $('#sound-error').addEventListener('change', (e) => { state.prefs.error = e.target.value; savePrefs(); });
  $('#volume').addEventListener('input', (e) => {
    state.prefs.volume = parseFloat(e.target.value);
    $('#volume-display').textContent = Math.round(state.prefs.volume * 100) + '%';
    savePrefs();
  });
  $('#show-notif').addEventListener('change', (e) => { state.prefs.showNotif = e.target.checked; savePrefs(); });
  document.querySelectorAll('[data-test]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const which = btn.dataset.test;
      play(which === 'error' ? state.prefs.error : state.prefs.success);
    });
  });
}

(async function init() {
  loadPrefs();
  await loadSounds();
  $('#volume').value = state.prefs.volume;
  $('#volume-display').textContent = Math.round(state.prefs.volume * 100) + '%';
  $('#show-notif').checked = state.prefs.showNotif;
  wireUI();
  connect();
  if ('Notification' in window && Notification.permission !== 'granted') {
    $('#activate-card').hidden = false;
  }
})();
