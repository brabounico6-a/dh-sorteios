const $ = s => document.querySelector(s);
let user = null, filter = 'all', draws = [], winners = [];
const api = async (path, opts = {}) => {
  const r = await fetch('/api' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || 'Não foi possível concluir.');
  return d;
};
function toast(t) {
  if (String(t).includes('SOU CARENTE ME DESCULPA DH SORTEIO E 00 O MELHOR')) {
    modal('<div class="moderation-notice"><div class="moderation-icon">💙👑</div><h2>SOU CARENTE ME DESCULPA DH SORTEIO E 00 O MELHOR 💙👑</h2><p>Essa mensagem não foi enviada porque contém linguagem proibida.</p><button class="btn" id="moderationOk">Entendi</button></div>');
    $('#moderationOk').onclick = close; return;
  }
  if (String(t).includes('POR FAVOR RESPEITO EM PRIMEIRO LUGAR DH AGRADECE SUA COMPREENSÃO')) {
    modal('<div class="moderation-notice"><div class="moderation-icon">💙</div><h2>POR FAVOR RESPEITO EM PRIMEIRO LUGAR DH AGRADECE SUA COMPREENSÃO 💙</h2><p>Essa imagem não pode ser usada como foto de perfil.</p><button class="btn" id="moderationOk">Entendi</button></div>');
    $('#moderationOk').onclick = close; return;
  }
  $('#toast').textContent = t;
  $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 2800);
}
function modal(html) {
  $('#modalContent').innerHTML = html;
  $('#modal').classList.add('show');
}
function close() { $('#modal').classList.remove('show'); }
$('#closeModal').onclick = close;
$('#modal').onclick = e => { if (e.target.id === 'modal') close(); };

function authHeaders() {
  return { Authorization: 'Bearer ' + localStorage.getItem('dh_token') };
}
function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function authForm(mode) {
  const reg = mode === 'register';
  modal(`<h2>${reg ? 'Criar conta' : 'Entrar na DH'}</h2>
    <p class="muted">${reg ? 'Faça parte da comunidade gamer.' : 'Acesse sua conta para participar e ver sua caixa privada.'}</p>
    <form id="authForm">
      ${reg ? '<div class="field"><label>Seu nome</label><input name="name" required maxlength="50" placeholder="Como quer aparecer?"></div>' : ''}
      <div class="field"><label>E-mail</label><input name="email" type="email" required placeholder="voce@email.com"></div>
      <div class="field"><label>Senha</label><input name="password" type="password" required minlength="6" placeholder="Mínimo de 6 caracteres"></div>
      <button class="btn">${reg ? 'Criar minha conta' : 'Entrar'}</button>
    </form>
    <p class="switch" id="switchAuth">${reg ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Criar conta'}</p>`);
  $('#switchAuth').onclick = () => authForm(reg ? 'login' : 'register');
  $('#authForm').onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const d = await api('/auth/' + (reg ? 'register' : 'login'), {
        method: 'POST', body: JSON.stringify(body)
      });
      localStorage.setItem('dh_token', d.token);
      user = d.user;
      close();
      renderAccount();
      load();
      refreshInboxBadge();
      loadInboxMessages();
      toast('Bem-vindo à DH!');
    } catch (err) { toast(err.message); }
  };
}
$('#loginOpen').onclick = () => authForm('login');
$('#registerOpen').onclick = () => authForm('register');
$('#heroCreate').onclick = () => createDraw();
$('#createDraw').onclick = () => createDraw();

function renderAccount() {
  if (!user) return;
  const avatar = user.avatar_url ? `<img class="account-avatar" src="${escapeHtml(user.avatar_url)}" alt="Foto de perfil">` : '<span class="account-avatar-placeholder">👤</span>';
  $('#accountArea').innerHTML = `
    <button class="btn ghost inbox-open" id="inboxOpen" aria-label="Abrir caixa de entrada"><span class="inbox-count" id="inboxCount">0</span></button>
    <button class="profile-avatar-button" id="profileOpen" title="Alterar foto de perfil">${avatar}</button><span class="account-greeting">${escapeHtml(user.name)}<small style="display:block;color:#79aee6">Membro DH</small></span>
    <button class="btn ghost" id="logout">Sair</button>`;
  $('#inboxOpen').onclick = openInbox;
  $('#profileOpen').onclick = openProfile;
  const dn = $('#dashboardName'); if (dn) dn.textContent = user.name;
  const di = $('#dashboardId'); if (di) di.textContent = 'Membro DH';
  const da = $('#dashboardAvatar'); if (da) da.innerHTML = user.avatar_url ? `<img src="${escapeHtml(user.avatar_url)}" alt="Foto de perfil">` : '👤';
  $('#logout').onclick = () => {
    localStorage.removeItem('dh_token');
    user = null;
    $('#accountArea').innerHTML = '<button class="btn ghost" id="loginOpen">Entrar</button><button class="btn" id="registerOpen">Criar conta</button>';
    $('#loginOpen').onclick = () => authForm('login');
    $('#registerOpen').onclick = () => authForm('register');
    const dn = $('#dashboardName'); if (dn) dn.textContent = 'Visitante';
    const di = $('#dashboardId'); if (di) di.textContent = 'Entre na sua conta';
    const da = $('#dashboardAvatar'); if (da) da.textContent = '👤';
    loadInboxMessages();
    load();
  };
  refreshInboxBadge();
}

function openProfile() {
  if (!user) return authForm('login');
  const avatar = user.avatar_url ? `<img class="profile-preview" src="${escapeHtml(user.avatar_url)}" alt="Sua foto">` : '<div class="profile-preview profile-placeholder">👤</div>';
  modal(`<div class="profile-edit"><span class="eyebrow">SUA CONTA DH</span><h2>Foto de perfil</h2>${avatar}
    <p class="muted">Escolha uma imagem JPG, PNG ou WEBP de até 4 MB. A foto passa por uma verificação automática antes de aparecer.</p>
    <form id="avatarForm"><div class="field"><label>Selecionar imagem</label><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" required></div><button class="btn">Enviar foto</button></form>
  </div>`);
  $('#avatarForm').onsubmit = async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      const response = await fetch('/api/profile/avatar', { method: 'POST', headers: authHeaders(), body: form });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Não foi possível atualizar a foto.');
      user = data.user; close(); renderAccount(); toast('Foto de perfil atualizada!');
    } catch (err) { toast(err.message); }
  };
}

async function refreshInboxBadge() {
  if (!user) return;
  try {
    const d = await api('/inbox', { headers: authHeaders() });
    const badge = $('#inboxCount');
    if (badge) {
      badge.textContent = d.unread;
      badge.classList.toggle('has-unread', d.unread > 0);
    }
  } catch (_) {}
}

function showPage(page) {
  const visiblePage = page === 'sorteios' ? 'inicio' : page;
  document.querySelectorAll('.dashboard-page').forEach(el => el.hidden = el.id !== 'page-' + visiblePage);
  document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  if (page === 'chat') { loadInboxMessages(); }
  if (page === 'perfil' && !user) authForm('login');
  if (page === 'historico' && !user) authForm('login');
  if (page === 'sorteios') { setTimeout(() => document.querySelector('#sorteios')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', e => {
  const page = el.dataset.page;
  if (!page) return;
  e.preventDefault(); showPage(page);
}));
$('#sideLogout').onclick = () => { if (user) $('#logout')?.click(); else authForm('login'); };
$('#inboxLogin').onclick = () => authForm('login');
$('#dashboardProfile').onclick = openProfile;
$('#profilePageOpen').onclick = openProfile;
$('#settingsInbox').onclick = () => showPage('chat');
$('#adminInboxOpen').onclick = openAdminInbox;

async function openInbox() { showPage('chat'); }
async function loadInboxMessages() {
  const box = $('#inboxMessages');
  if (!box) return;
  if (!user) {
    box.innerHTML = '<div class="inbox-empty"><div class="empty-envelope">✉</div><b>Entre na sua conta</b><p>Faça login para acessar suas mensagens privadas.</p><button class="btn" id="inboxLogin">Entrar</button></div>';
    $('#inboxLogin').onclick = () => authForm('login');
    $('#supportMessageForm').querySelector('textarea').disabled = true;
    $('#supportMessageForm').querySelector('button').disabled = true;
    return;
  }
  $('#supportMessageForm').querySelector('textarea').disabled = false;
  $('#supportMessageForm').querySelector('button').disabled = false;
  $('#supportMessageForm').onsubmit = async e => {
    e.preventDefault();
    const body = new FormData(e.target).get('body');
    const button = e.target.querySelector('button'); button.disabled = true;
    try {
      const d = await api('/inbox/send', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ body }) });
      e.target.reset(); await loadInboxMessages(); toast(d.message || 'Mensagem enviada!');
    } catch (err) { toast(err.message); }
    finally { if (button) button.disabled = false; }
  };
  try {
    const d = await api('/inbox', { headers: authHeaders() });
    $('#inboxUnreadLabel').textContent = `${d.unread} nova(s)`;
    if (!d.messages.length) {
      box.innerHTML = '<div class="inbox-empty"><div class="empty-envelope">✉</div><b>Sua caixa está vazia</b><p>Quando você ganhar um sorteio ou receber um aviso, ele aparecerá aqui. Envie uma mensagem privada para a equipe DH usando o campo ao lado.</p></div>';
      $('#conversationBody').innerHTML = '<div class="conversation-empty">💙<p>Você ainda não tem mensagens. A equipe DH estará por aqui quando precisar!</p></div>';
    } else {
      box.innerHTML = d.messages.map((m,i) => `
        <article class="inbox-message ${m.read_at ? '' : 'unread'} ${m.kind === 'user_message' ? 'sent-message' : ''}" data-message="${m.id}" data-index="${i}">
          <div class="inbox-message-top"><b>${escapeHtml(m.sender)}${m.kind === 'user_message' ? ' • enviada à equipe' : ''}</b><time>${escapeHtml(m.created_at || '')}</time></div>
          <h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.body)}</p>
          <div class="inbox-message-actions">${m.read_at ? '<span class="read-label">Lida</span>' : `<button class="filter" data-read="${m.id}">Marcar como lida</button>`}<button class="filter" data-delete="${m.id}">Excluir</button></div>
        </article>`).join('');
      const showMessage = m => {
        $('#conversationBody').innerHTML = `<div class="conversation-bubble"><b>${escapeHtml(m.sender)} — ${escapeHtml(m.title)}</b><br>${escapeHtml(m.body)}<small>${escapeHtml(m.created_at || '')}</small></div>`;
      };
      box.querySelectorAll('.inbox-message').forEach((el,i) => el.addEventListener('click', async ev => {
        if (ev.target.closest('button')) return;
        showMessage(d.messages[i]);
        if (!d.messages[i].read_at) {
          try { await api('/inbox/' + d.messages[i].id + '/read', { method:'POST', headers:authHeaders() }); refreshInboxBadge(); }
          catch (_) {}
        }
      }));
      if (d.messages.length) showMessage(d.messages[0]);
      box.querySelectorAll('[data-read]').forEach(b => b.onclick = async e => {
        e.stopPropagation(); try { await api('/inbox/' + b.dataset.read + '/read', { method: 'POST', headers: authHeaders() }); await loadInboxMessages(); refreshInboxBadge(); } catch (err) { toast(err.message); }
      });
      box.querySelectorAll('[data-delete]').forEach(b => b.onclick = async e => {
        e.stopPropagation(); try { await api('/inbox/' + b.dataset.delete, { method: 'DELETE', headers: authHeaders() }); await loadInboxMessages(); refreshInboxBadge(); toast('Mensagem excluída.'); } catch (err) { toast(err.message); }
      });
    }
    const badge = $('#inboxCount');
    if (badge) { badge.textContent = d.unread; badge.classList.toggle('has-unread', d.unread > 0); }
  } catch (e) { box.innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`; }
}


function openAdminInbox() {
  modal(`<span class="eyebrow">ACESSO RESTRITO</span><h2>Atendimento DH</h2>
    <p class="muted">Área exclusiva da equipe. Informe a ADMIN_KEY configurada no Render.</p>
    <form id="adminInboxLogin"><div class="field"><label>Chave administrativa</label><input name="admin_key" type="password" required autocomplete="off"></div><button class="btn">Acessar mensagens</button></form>
    <div id="adminInboxResults"></div>`);
  $('#adminInboxLogin').onsubmit = async e => {
    e.preventDefault(); const key = new FormData(e.target).get('admin_key');
    const result = $('#adminInboxResults'); result.innerHTML = '<p class="muted">Carregando...</p>';
    try {
      const d = await api('/admin/inbox', { headers: { 'x-admin-key': key } });
      result.innerHTML = d.messages.length ? d.messages.map(m => `
        <article class="inbox-message"><div class="inbox-message-top"><b>${escapeHtml(m.name)} • ${escapeHtml(m.email)}</b><time>${escapeHtml(m.created_at || '')}</time></div>
        <h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.body)}</p>
        <form class="admin-reply-form" data-reply="${m.id}"><div class="field"><label>Responder em particular</label><textarea name="body" rows="2" maxlength="1500" required placeholder="Digite a resposta para este membro..."></textarea></div><button class="btn">Enviar resposta privada</button></form></article>`).join('') : '<div class="inbox-empty">Nenhuma mensagem recebida da comunidade.</div>';
      result.querySelectorAll('.admin-reply-form').forEach(form => form.onsubmit = async ev => {
        ev.preventDefault(); const body = new FormData(form).get('body');
        try { await api('/admin/inbox/' + form.dataset.reply + '/reply', { method: 'POST', headers: { 'x-admin-key': key }, body: JSON.stringify({ body }) }); form.reset(); toast('Resposta enviada para a caixa privada!'); }
        catch (err) { toast(err.message); }
      });
    } catch (err) { result.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`; }
  };
}

async function load() {
  try {
    const d = await api('/draws');
    draws = d.draws; winners = d.winners;
    $('#statDraws').textContent = d.stats.draws;
    $('#statUsers').textContent = d.stats.users;
    $('#statWinners').textContent = d.stats.winners;
    renderDraws(); renderWinners();
  } catch (e) {
    $('#drawGrid').innerHTML = '<p class="muted">Não foi possível carregar os sorteios. Atualize a página.</p>';
  }
}

function renderDraws() {
  const list = draws.filter(d => filter === 'all' || d.type === filter);
  $('#drawGrid').innerHTML = list.length ? list.map(d => `
    <article class="draw-card">
      <div class="draw-top"><span class="pill">${d.type === 'game' ? '🎮 GAMER' : '🎟️ NÚMEROS'}</span>
      <span class="pill">${d.status === 'open' ? 'ABERTO' : d.status === 'finished' ? 'ENCERRADO' : 'SORTEADO'}</span></div>
      <h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.description || 'Participe deste sorteio da comunidade DH.')}</p>
      <div class="draw-meta"><span>Por ${escapeHtml(d.owner_name)}</span><span>${d.entries} participante(s)</span></div>
      <button class="btn" data-enter="${d.id}" ${d.status !== 'open' ? 'disabled' : ''}>${d.status === 'open' ? 'Participar agora' : 'Sorteio encerrado'}</button>
      ${d.status === 'open' ? `<button class="btn ghost admin-draw" data-admin-draw="${d.id}">🏆 Sortear e enviar prêmio</button>` : ''}
    </article>`).join('') : '<p class="muted">Nenhum sorteio nesta categoria ainda. Entre e crie o primeiro!</p>';
  document.querySelectorAll('[data-enter]').forEach(b => b.onclick = () => enterDraw(Number(b.dataset.enter)));
  document.querySelectorAll('[data-admin-draw]').forEach(b => b.onclick = () => adminDrawForm(Number(b.dataset.adminDraw)));
}
document.querySelectorAll('.filter[data-filter]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.filter[data-filter]').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); filter = b.dataset.filter; renderDraws();
});
function renderWinners() {
  $('#winnerList').innerHTML = winners.length
    ? winners.slice(0, 5).map(w => `<div class="winner-item"><span>🏆 ${escapeHtml(w.winner_name)}</span><b>${escapeHtml(w.draw_title)}</b></div>`).join('')
    : '<p class="muted">Os resultados publicados aparecerão aqui.</p>';
}

function createDraw() {
  if (!user) { authForm('login'); toast('Entre na sua conta para criar um sorteio.'); return; }
  modal(`<h2>Novo sorteio</h2>
    <form id="drawForm">
      <div class="field"><label>PIN do proprietário</label><input name="admin_pin" type="password" required minlength="4" placeholder="PIN secreto configurado no Render"></div>
      <p class="admin-note">Somente o proprietário com o PIN consegue publicar sorteios. Não compartilhe esse código.</p>
      <div class="field"><label>Nome do sorteio</label><input name="title" required maxlength="80" placeholder="Ex.: Conta gamer especial"></div>
      <div class="field"><label>Tipo</label><select name="type"><option value="game">Conta ou item gamer</option><option value="numbers">Sorteio por números</option></select></div>
      <div class="field"><label>Descrição / prêmio</label><textarea name="description" rows="3" maxlength="300" placeholder="Descreva o prêmio e as regras..."></textarea></div>
      <div class="field"><label>Quantidade de números (somente tipo números)</label><input name="number_count" type="number" min="2" max="500" value="50"></div>
      <button class="btn">Publicar sorteio</button>
    </form>`);
  $('#drawForm').onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const pin = body.admin_pin; delete body.admin_pin; body.number_count = Number(body.number_count);
    try {
      await api('/draws', { method: 'POST', headers: { ...authHeaders(), 'x-admin-pin': pin }, body: JSON.stringify(body) });
      close(); load(); toast('Sorteio publicado!');
    } catch (err) { toast(err.message); }
  };
}

function adminDrawForm(id) {
  const d = draws.find(x => x.id === id);
  if (!d) return;
  modal(`<h2>🏆 Sortear vencedor</h2>
    <p class="muted">Sorteio: <b>${escapeHtml(d.title)}</b>. O ganhador receberá uma mensagem somente na própria caixa de entrada.</p>
    <form id="adminDrawForm">
      <div class="field"><label>Chave administrativa (ADMIN_KEY)</label><input name="admin_key" type="password" required placeholder="Sua chave secreta do Render"></div>
      <div class="field"><label>Título da mensagem</label><input name="prize_title" maxlength="100" value="Você ganhou: ${escapeHtml(d.title)}"></div>
      <div class="field"><label>Mensagem privada / dados para receber o prêmio</label><textarea name="prize_message" rows="6" maxlength="5000" required placeholder="Parabéns! Você ganhou... Inclua aqui as instruções de entrega e os dados necessários para acessar sua conta de jogo."></textarea></div>
      <p class="admin-note">A mensagem será entregue somente ao usuário sorteado. Não use a caixa para enviar senhas de outros serviços pessoais.</p>
      <button class="btn">Sortear e enviar para a caixa privada</button>
    </form>`);
  $('#adminDrawForm').onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const key = body.admin_key; delete body.admin_key;
    try {
      const result = await api('/admin/draws/' + id + '/draw', {
        method: 'POST', headers: { 'x-admin-key': key }, body: JSON.stringify(body)
      });
      close(); load(); toast('Ganhador: ' + result.winner + '. Prêmio enviado à caixa privada!');
    } catch (err) { toast(err.message); }
  };
}

async function enterDraw(id) {
  if (!user) { authForm('login'); toast('Entre para participar.'); return; }
  const d = draws.find(x => x.id === id);
  if (d.type === 'numbers') {
    const nums = Array.from({ length: d.number_count }, (_, i) => i + 1);
    modal(`<h2>Escolha seus números</h2><p class="muted">${escapeHtml(d.title)} — selecione um número disponível.</p>
      <div class="number-grid">${nums.map(n => `<button class="filter" data-num="${n}">${String(n).padStart(2, '0')}</button>`).join('')}</div>
      <button class="btn" id="confirmNumber" disabled>Confirmar número</button>`);
    let selected = null;
    document.querySelectorAll('[data-num]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-num]').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); selected = Number(b.dataset.num); $('#confirmNumber').disabled = false;
    });
    $('#confirmNumber').onclick = () => participate(id, { number: selected });
  } else {
    modal(`<h2>Participar do sorteio?</h2><p class="muted">${escapeHtml(d.title)}</p>
      <p>Confirme sua participação gratuita neste sorteio.</p>
      <button class="btn" id="confirmJoin">Confirmar participação</button>`);
    $('#confirmJoin').onclick = () => participate(id, {});
  }
}
async function participate(id, body) {
  try {
    await api('/draws/' + id + '/enter', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    close(); load(); toast('Participação confirmada!');
  } catch (e) { toast(e.message); }
}

async function init() {
  const token = localStorage.getItem('dh_token');
  if (token) {
    try {
      const d = await api('/me', { headers: { Authorization: 'Bearer ' + token } });
      user = d.user; renderAccount();
    } catch { localStorage.removeItem('dh_token'); }
  }
  $('#year').textContent = new Date().getFullYear();
  load();
  showPage('chat');
}
init();
