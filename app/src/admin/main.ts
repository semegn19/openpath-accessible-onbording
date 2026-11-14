import copy from '../schemas/roha-admin-copy-v1.json';
const root = document.querySelector('main')!;
let lang: 'en' | 'am' = 'en';
let revision = 0;
const c = (key: keyof typeof copy.strings) => copy.strings[key][lang];
const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
function message(text: string) { get('#status').textContent = text; }
async function request(path: string, method = 'GET', data?: unknown, token?: string) {
  const response = await fetch(`/api/admin/${path}`, {
    method, credentials: 'same-origin', signal: AbortSignal.timeout(15000),
    headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) { get('#login').hidden = false; get('#settings').hidden = true; }
    throw new Error(response.status === 401 ? c('admin.signInAgain') : response.status === 409 ? c('admin.changed') : `${c('admin.error')} (${result.error?.code || response.status})`);
  }
  return result;
}
function updateProvider() {
  const provider = get<HTMLSelectElement>('#provider').value;
  get('#remote').hidden = provider === 'disabled';
  get('#endpoint-field').hidden = !['custom', 'ollama'].includes(provider);
  get<HTMLInputElement>('#model').required = provider !== 'disabled';
  get<HTMLInputElement>('#endpoint').required = ['custom', 'ollama'].includes(provider);
  get<HTMLInputElement>('#endpoint').disabled = !['custom', 'ollama'].includes(provider);
  get<HTMLButtonElement>('#test').disabled = provider === 'disabled';
}
function values() {
  return { provider: get<HTMLSelectElement>('#provider').value, model: get<HTMLInputElement>('#model').value,
    apiKey: get<HTMLInputElement>('#key').value, endpoint: get<HTMLInputElement>('#endpoint').disabled ? '' : get<HTMLInputElement>('#endpoint').value,
    requestsPerDay: Number(get<HTMLInputElement>('#limit').value), revision };
}
async function load() {
  const config = await request('config'); revision = config.revision;
  for (const [id, value] of Object.entries({ provider: config.provider, model: config.model, endpoint: config.endpoint, limit: config.requestsPerDay })) get<HTMLInputElement>(`#${id}`).value = String(value);
  get<HTMLInputElement>('#key').value = '';
  get('#key-state').textContent = c(config.hasKey ? 'admin.keySaved' : 'admin.noKey');
  get('#login').hidden = true; get('#settings').hidden = false; updateProvider();
}
function render() {
  document.documentElement.lang = lang; document.title = c('admin.title');
  root.innerHTML = `<h1>${c('admin.title')}</h1><p>${c('admin.intro')}</p>
    <button id="language" type="button" lang="${lang === 'en' ? 'am' : 'en'}">${lang === 'en' ? 'አማርኛ' : 'English'}</button>
    <p id="status" role="status" aria-live="polite" aria-atomic="true"></p>
    <form id="login"><label for="token">${c('admin.token')}</label><input id="token" type="password" required autocomplete="current-password"><button>${c('admin.login')}</button></form>
    <section id="settings" hidden aria-label="${c('admin.title')}">
    <form id="config"><label for="provider">${c('admin.provider')}</label><select id="provider">
      <option value="disabled">${c('admin.disabled')}</option><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="anthropic">Anthropic Claude</option><option value="ollama">Ollama</option><option value="custom">Custom REST</option></select>
    <div id="remote"><label for="model">${c('admin.model')}</label><input id="model" maxlength="160" aria-describedby="model-hint"><p id="model-hint">${c('admin.modelHint')}</p>
      <label for="key">${c('admin.key')}</label><input id="key" type="password" maxlength="4096" autocomplete="off" aria-describedby="key-hint key-state"><p id="key-hint">${c('admin.keyHint')}</p><p id="key-state"></p>
      <div id="endpoint-field"><label for="endpoint">${c('admin.endpoint')}</label><input id="endpoint" type="url" aria-describedby="endpoint-hint"><p id="endpoint-hint">${c('admin.endpointHint')}</p></div>
    </div><label for="limit">${c('admin.limit')}</label><input id="limit" type="number" min="1" max="100000" value="1000" required>
    <p id="test-hint">${c('admin.testHint')}</p><button id="test" type="button" aria-describedby="test-hint">${c('admin.test')}</button><button id="save">${c('admin.save')}</button></form>
    <button id="logout" type="button">${c('admin.logout')}</button>
    <h2>${c('admin.embed')}</h2><p>${c('admin.embedHint')}</p><pre id="snippet" tabindex="0"></pre></section>`;
  get('#snippet').textContent = `<script defer src="${location.origin}/roha.js" data-roha-root="main" data-roha-language="${lang}" data-roha-api="${location.origin}/api/assistant"></script>`;
  get('#language').onclick = () => {
    // Retain unsaved non-secret form values; deliberately clear credential input on rerender.
    const snapshot = values(); const wasOpen = !get('#settings').hidden;
    lang = lang === 'en' ? 'am' : 'en'; render();
    if (wasOpen) {
      for (const [id,value] of Object.entries({provider:snapshot.provider,model:snapshot.model,endpoint:snapshot.endpoint,limit:snapshot.requestsPerDay})) get<HTMLInputElement>(`#${id}`).value=String(value);
      get('#settings').hidden=false;get('#login').hidden=true;updateProvider();
    }
    get('#language').focus();
  };
  get<HTMLFormElement>('#login').onsubmit = async event => {
    event.preventDefault(); const token = get<HTMLInputElement>('#token'); const secret = token.value; token.value = '';
    try { await request('session','POST',undefined,secret); await load(); get('#provider').focus(); message(''); }
    catch (error) { message((error as Error).message); }
  };
  get('#provider').onchange = () => { get<HTMLInputElement>('#key').value = ''; get('#key-state').textContent = ''; updateProvider(); };
  const act = async (test: boolean) => {
    if (!get<HTMLFormElement>('#config').reportValidity()) return;
    const data = values(); if (!test) get<HTMLInputElement>('#key').value = '';
    get<HTMLButtonElement>('#save').disabled = true; get<HTMLButtonElement>('#test').disabled = true;
    message(c(test ? 'admin.testing' : 'admin.saving'));
    try { await request(test ? 'test' : 'config', test ? 'POST' : 'PUT', data);
      if (!test) await load();
      message(c(test ? 'admin.tested' : 'admin.saved'));
    } catch(error) { message((error as Error).message); }
    finally { get<HTMLButtonElement>('#save').disabled = false; updateProvider(); }
  };
  get<HTMLFormElement>('#config').onsubmit = e => { e.preventDefault(); void act(false); };
  get('#test').onclick = () => void act(true);
  get('#logout').onclick = async () => { try { await request('session','DELETE'); render(); get('#token').focus(); } catch(error) { message((error as Error).message); } };
  updateProvider();
}
render();
void load().catch(error => { if (!(error as Error).message.includes(c('admin.signInAgain'))) message((error as Error).message); });
