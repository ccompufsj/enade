// Treino ENADE - lógica da página.
// Cookies:
//   enade_ok      histórico de questões já acertadas (ids)
//   enade_rodada  rodada em andamento: ids sorteados, posição atual e resultados
//   enade_filtros filtros escolhidos (ano, tipo, componente, tentativas, quantidade)

const ASSERCAO = {
  A: 'As asserções I e II são proposições verdadeiras, e a II é uma justificativa correta da I.',
  B: 'As asserções I e II são proposições verdadeiras, mas a II não é uma justificativa correta da I.',
  C: 'A asserção I é uma proposição verdadeira, e a II é uma proposição falsa.',
  D: 'A asserção I é uma proposição falsa, e a II é uma proposição verdadeira.',
  E: 'As asserções I e II são proposições falsas.'
};

const $ = id => document.getElementById(id);
const porId = id => QUESTOES.find(q => q.id === id);

// ---------- cookies ----------
function lerCookie(nome) {
  const m = document.cookie.match('(?:^|; )' + nome + '=([^;]*)');
  return m && m[1] ? decodeURIComponent(m[1]) : '';
}
function gravarCookie(nome, valor) {
  document.cookie = nome + '=' + encodeURIComponent(valor) +
    '; max-age=' + 60 * 60 * 24 * 365 + '; path=/; SameSite=Lax';
}

let ok = new Set(lerCookie('enade_ok').split(',').filter(Boolean));
const salvarOk = () => gravarCookie('enade_ok', [...ok].join(','));

// Rodada: { ids: [...], i: posição atual, res: { id: '1' | 'c' | 'e' } }
//   '1' = acertou na 1ª tentativa, 'c' = acertou depois, 'e' = errou / viu a resposta / pulou
let rodada = null;
try { rodada = JSON.parse(lerCookie('enade_rodada') || 'null'); } catch (e) { rodada = null; }
const salvarRodada = () => gravarCookie('enade_rodada', rodada ? JSON.stringify(rodada) : '');
const rodadaAtiva = () => rodada && rodada.i < rodada.ids.length;

const limite = () => Number($('fTent').value);   // 0 = sem limite

// ---------- códigos ----------
// Código = id da questão: AA-NN para objetivas (ex.: 21-16) e AA-DN para discursivas (ex.: 17-D3).
// Aceita variações como "2021-16", "21 q16", "21-d3", "2116".
function normalizarCodigo(txt) {
  const m = txt.trim().toUpperCase().match(/^(?:20)?(\d{2})[^\dD]*(D?)\D*0*(\d{1,2})$/);
  if (!m) return null;
  return m[1] + '-' + (m[2] ? 'D' + m[3] : m[3].padStart(2, '0'));
}

function abrirCodigo(txt) {
  const id = normalizarCodigo(txt);
  const q = id && porId(id);
  if (!q) {
    $('area').innerHTML = `<p class="vazio">Código <b>${txt.replace(/</g, '&lt;')}</b> não encontrado.<br>Use o formato 21-16 (objetiva) ou 17-D3 (discursiva).</p>`;
    return;
  }
  // se a questão é a atual da rodada, abre dentro da rodada; senão, como avulsa
  mostrar(q, rodadaAtiva() && rodada.ids[rodada.i] === q.id);
}

// ---------- filtros ----------
function filtradas() {
  const ano = $('fAno').value, tipo = $('fTipo').value, comp = $('fComp').value;
  return QUESTOES.filter(q =>
    (!ano || String(q.ano) === ano) && (!tipo || q.tipo === tipo) && (!comp || q.comp === comp));
}

function atualizarHistorico() {
  const qs = filtradas();
  const feitas = qs.filter(q => ok.has(q.id)).length;
  $('progresso').textContent = `Histórico: ${feitas} de ${qs.length} questões deste filtro já acertadas`;
}

// ---------- rodada ----------
const embaralhar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function iniciarRodada() {
  const qs = filtradas();
  if (!qs.length) { $('area').innerHTML = '<p class="vazio">Nenhuma questão neste filtro.</p>'; return; }
  const qtd = Number($('fQtd').value) || qs.length;
  // prioriza as que ainda não foram acertadas; completa com as demais se faltar
  const novas = embaralhar(qs.filter(q => !ok.has(q.id)));
  const velhas = embaralhar(qs.filter(q => ok.has(q.id)));
  const ids = [...novas, ...velhas].slice(0, qtd).map(q => q.id);
  rodada = { ids: embaralhar(ids), i: 0, res: {} };
  irPara(0);
}

function irPara(i) {
  rodada.i = i; salvarRodada();
  if (i >= rodada.ids.length) return resultado();
  mostrar(porId(rodada.ids[i]), true);
}

// registra o resultado da questão atual da rodada (só a primeira vez conta)
function registrar(q, r) {
  if (r !== 'e') { ok.add(q.id); salvarOk(); atualizarHistorico(); }
  if (!rodadaAtiva() || rodada.ids[rodada.i] !== q.id || rodada.res[q.id]) return;
  rodada.res[q.id] = r; salvarRodada(); atualizarPlacar();
}

function contagem() {
  const v = Object.values(rodada.res);
  const certas = v.filter(r => r !== 'e').length;
  return { certas, primeira: v.filter(r => r === '1').length, erradas: v.length - certas, respondidas: v.length };
}

function atualizarPlacar() {
  if (!rodada) { $('rodada').hidden = true; return; }
  $('rodada').hidden = false;
  $('btEncerrar').hidden = !rodadaAtiva();
  const n = rodada.ids.length, { certas, erradas } = contagem();
  $('placar').innerHTML = rodadaAtiva()
    ? `Questão <b>${rodada.i + 1} de ${n}</b> · ✓ ${certas} certas · ✗ ${erradas} erradas`
    : `Rodada encerrada · ✓ ${certas} certas · ✗ ${erradas} erradas`;
  $('trilha').innerHTML = rodada.ids.map((id, k) =>
    `<i class="${rodada.res[id] ? (rodada.res[id] === 'e' ? 'e' : 'c') : ''}${k === rodada.i ? ' atual' : ''}" title="${id}"></i>`).join('');
}

function resultado() {
  const n = rodada.ids.length, { certas, primeira, erradas, respondidas } = contagem();
  const pct = Math.round(100 * certas / n);
  const revisar = rodada.ids.filter(id => rodada.res[id] === 'e' || !rodada.res[id]);
  const item = id => {
    const q = porId(id);
    const nome = q.tipo === 'discursiva' ? 'discursiva ' + String(q.num).slice(1) : 'questão ' + q.num;
    return `<li><a href="#${id}">${id}</a> · ENADE ${q.ano}, ${nome}${rodada.res[id] ? '' : ' (não respondida)'}</li>`;
  };
  $('area').innerHTML = `
    <div class="q resumo">
      <div class="meta">Rodada concluída</div>
      <p class="nota">${certas} de ${n}</p>
      <p>${pct}% de acerto · ${primeira} na 1ª tentativa · ${erradas} erradas${respondidas < n ? ` · ${n - respondidas} não respondidas` : ''}</p>
      ${revisar.length ? `<p><b>Para revisar</b> (clique no código para abrir):</p><ul>${revisar.map(item).join('')}</ul>`
                       : '<p>Você acertou todas! 🎉</p>'}
      <div class="acoes" style="justify-content:center">
        ${revisar.length ? '<button id="btRefazer">Refazer só estas</button>' : ''}
        <button class="prim" id="btNova">Nova rodada</button>
      </div>
    </div>`;
  atualizarPlacar();
  $('btNova').onclick = iniciarRodada;
  if (revisar.length) $('btRefazer').onclick = () => {
    rodada = { ids: embaralhar(revisar), i: 0, res: {} }; irPara(0);
  };
  history.replaceState(null, '', location.pathname);
}

// ---------- exibição de uma questão ----------
// naRodada = true: questão atual da rodada; false: aberta por código (avulsa, não conta no placar)
function mostrar(q, naRodada) {
  const comp = q.comp === 'geral' ? 'Formação geral' : 'Componente específico';
  const rotulo = q.tipo === 'discursiva' ? `Discursiva ${String(q.num).replace('D', '')}` : `Questão ${q.num}`;
  history.replaceState(null, '', '#' + q.id);   // link direto para a questão
  const imgs = (q.img || []).map(src =>
    `<a href="${src}" target="_blank"><img src="${src}" alt="Figura da questão" loading="lazy"></a>`).join('');

  $('area').innerHTML = `
    ${naRodada ? '' : `<p class="dica">Questão avulsa, aberta por código: não conta no placar da rodada.
      ${rodadaAtiva() ? '<button id="btVoltar">← Voltar à rodada</button>' : ''}</p>`}
    <div class="q">
      <div class="meta"><span class="cod" title="Código da questão">${q.id}</span> ENADE ${q.ano} · ${rotulo} · ${comp}
        ${ok.has(q.id) ? '<span class="tag-ok">· já acertada antes</span>' : ''}</div>
      ${q.enunciado.includes('<!--img-->') ? q.enunciado.replace('<!--img-->', imgs) : q.enunciado + imgs}
      <p class="fonte">Fonte: ENADE ${q.ano}, Ciência da Computação (Bacharelado), INEP/MEC.</p>
      <div id="corpo"></div>
    </div>`;

  // botão de avanço: na rodada vai para a próxima (ou para o resultado na última);
  // na avulsa volta para a rodada em andamento ou inicia uma nova
  const avancar = naRodada
    ? { rotulo: rodada.i === rodada.ids.length - 1 ? 'Ver resultado' : 'Próxima questão', acao: () => irPara(rodada.i + 1) }
    : rodadaAtiva()
      ? { rotulo: 'Voltar à rodada', acao: () => irPara(rodada.i) }
      : { rotulo: 'Iniciar rodada', acao: iniciarRodada };
  if ($('btVoltar')) $('btVoltar').onclick = () => irPara(rodada.i);
  q.tipo === 'objetiva' ? montarObjetiva(q, avancar, naRodada) : montarDiscursiva(q, avancar, naRodada);
  atualizarPlacar();
  window.scrollTo({ top: $('area').offsetTop - 12, behavior: 'smooth' });
}

function botaoAvancar(avancar, antes) {
  const b = $('btProx');
  b.textContent = avancar.rotulo;
  b.onclick = () => { if (antes) antes(); avancar.acao(); };
}

function montarObjetiva(q, avancar) {
  const alts = q.alternativas === 'assercao' ? ASSERCAO : q.alternativas;
  const descartadas = new Set();
  let escolhida = null, erros = 0;

  $('corpo').innerHTML = `
    <div class="alts">${Object.entries(alts).map(([l, t]) =>
      `<button class="alt" data-l="${l}"><b>${l}</b><span>${t}</span></button>`).join('')}</div>
    <div class="acoes" id="acoes"><button class="prim" id="btResp" disabled>Responder</button></div>
    <div id="retorno"></div>`;

  const botoes = [...document.querySelectorAll('.alt')];
  botoes.forEach(b => b.onclick = () => {
    escolhida = b.dataset.l;
    botoes.forEach(x => x.classList.toggle('sel', x === b));
    $('btResp').disabled = false;
  });
  $('btResp').onclick = responder;

  const marcarGabarito = () => botoes.find(b => b.dataset.l === q.gabarito).classList.add('certa');

  function responder() {
    const certo = escolhida === q.gabarito;
    botoes.forEach(b => b.disabled = true);
    $('btResp').remove();
    const bt = botoes.find(b => b.dataset.l === escolhida);
    bt.classList.remove('sel');

    if (certo) {
      bt.classList.add('certa');
      registrar(q, erros === 0 ? '1' : 'c');
      $('retorno').innerHTML = `
        <div class="msg ok">Correto! ✓${erros ? ` (na ${erros + 1}ª tentativa)` : ''}</div>
        <div class="acoes"><button id="btVer">Ver resolução</button><button class="prim" id="btProx"></button></div>
        <div id="resol"></div>`;
      $('btVer').onclick = () => { verResolucao(q); $('btVer').remove(); };
      botaoAvancar(avancar);
      return;
    }

    bt.classList.add('errada');
    descartadas.add(escolhida);
    erros++;
    const restam = limite() ? limite() - erros : Infinity;
    if (restam <= 0) {               // limite atingido: conta como errada e mostra a resposta
      registrar(q, 'e');
      marcarGabarito();
      $('retorno').innerHTML = `
        <div class="msg err">Resposta incorreta. Limite de ${limite()} tentativa(s) atingido.</div>
        <div class="acoes"><button class="prim" id="btProx"></button></div>
        <div id="resol"></div>`;
      verResolucao(q);
      botaoAvancar(avancar);
      return;
    }
    $('retorno').innerHTML = `
      <div class="msg err">Resposta incorreta.${restam !== Infinity ? ` Tentativas restantes: ${restam}.` : ''}</div>
      <div class="acoes">
        <button id="btNovo">Tentar novamente</button>
        <button id="btVer">Ver resposta e resolução</button>
        <button class="prim" id="btProx"></button>
      </div>
      <div id="resol"></div>`;
    $('btNovo').onclick = () => {   // reabilita as alternativas ainda não descartadas
      escolhida = null;
      botoes.forEach(b => b.disabled = descartadas.has(b.dataset.l));
      $('retorno').innerHTML = '';
      $('acoes').innerHTML = '<button class="prim" id="btResp" disabled>Responder</button>';
      $('btResp').onclick = responder;
    };
    $('btVer').onclick = () => {
      registrar(q, 'e');
      marcarGabarito();
      $('btNovo').remove(); $('btVer').remove();
      verResolucao(q);
    };
    botaoAvancar(avancar, () => registrar(q, 'e'));   // avançar sem acertar conta como errada
  }
}

function verResolucao(q) {
  $('resol').innerHTML = `<div class="resol"><h3>Resolução (gabarito: ${q.gabarito})</h3>${q.resolucao}</div>`;
}

// Discursiva: mostra o padrão de resposta e pede uma autoavaliação, que conta no placar.
function montarDiscursiva(q, avancar, naRodada) {
  $('corpo').innerHTML = `
    <p class="dica">Escreva sua resposta (no papel ou num editor) e depois compare com o padrão de resposta do INEP.</p>
    <div class="acoes">
      <button class="prim" id="btRef">Mostrar resposta de referência</button>
      <button id="btProx"></button>
    </div>
    <div id="resol"></div>`;
  botaoAvancar(avancar, () => registrar(q, 'e'));   // pular conta como errada
  if (naRodada) $('btProx').textContent = 'Pular';

  $('btRef').onclick = () => {
    $('btRef').closest('.acoes').remove();
    $('resol').innerHTML = `
      <div class="resol"><h3>Padrão de resposta (INEP)</h3>${q.resposta}</div>
      <div class="autoav" id="autoav">
        <p>Comparando com o padrão de resposta, como foi a sua?</p>
        <div class="acoes" style="margin:0">
          <button id="btAcertei">✓ Acertei (ou quase)</button>
          <button id="btErrei">✗ Errei</button>
        </div>
      </div>`;
    const avaliar = r => {
      registrar(q, r);
      $('autoav').innerHTML = `<p>${r === 'e' ? 'Marcada como errada.' : 'Marcada como certa. ✓'}</p>
        <div class="acoes" style="margin:0"><button class="prim" id="btProx"></button></div>`;
      botaoAvancar(avancar);
    };
    $('btAcertei').onclick = () => avaliar('1');
    $('btErrei').onclick = () => avaliar('e');
  };
}

// ---------- inicialização ----------
$('btSortear').onclick = () => {
  if (rodadaAtiva() && !confirm('Já existe uma rodada em andamento. Descartar e começar outra?')) return;
  iniciarRodada();
};
// filtros: restaura do cookie e salva a cada mudança
const FILTROS = ['fAno', 'fTipo', 'fComp', 'fTent', 'fQtd'];
lerCookie('enade_filtros').split('|').forEach((v, k) => { if (FILTROS[k] && v) $(FILTROS[k]).value = v; });
FILTROS.forEach(id => $(id).onchange = () => {
  gravarCookie('enade_filtros', FILTROS.map(f => $(f).value).join('|'));
  atualizarHistorico();
});
$('btCodigo').onclick = () => abrirCodigo($('codigo').value);
$('codigo').onkeydown = e => { if (e.key === 'Enter') abrirCodigo($('codigo').value); };
$('btEncerrar').onclick = () => {
  if (!confirm('Encerrar a rodada agora? As questões restantes ficam como não respondidas.')) return;
  rodada.i = rodada.ids.length; salvarRodada(); resultado();
};
$('btZerar').onclick = () => {
  if (!confirm('Apagar o histórico de acertos e a rodada em andamento neste navegador?')) return;
  ok.clear(); salvarOk(); rodada = null; salvarRodada();
  atualizarHistorico(); atualizarPlacar();
  history.replaceState(null, '', location.pathname);
  $('area').innerHTML = '<p class="vazio">Histórico apagado. Clique em <b>Iniciar rodada</b>.</p>';
};

const abrirHash = () => { if (location.hash.length > 1) abrirCodigo(decodeURIComponent(location.hash.slice(1))); };
window.onhashchange = abrirHash;

if (!(rodada && Array.isArray(rodada.ids) && rodada.ids.every(porId))) rodada = null;
atualizarHistorico();
if (location.hash.length > 1) abrirHash();
else if (rodadaAtiva()) irPara(rodada.i);          // retoma a rodada salva
else if (rodada) resultado();
else atualizarPlacar();
