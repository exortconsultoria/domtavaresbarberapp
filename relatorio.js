/* Relatório somente de leitura: não altera lançamentos nem sincroniza dados. */
let relatorioMes = '';
function abrirRelatorio() { relatorioMes = finMes; switchTab('relatorio'); }
function mudarMesRelatorio(mes) {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) { relatorioMes = mes; render(); }
}
function dadosRelatorio(mes, registros, hoje) {
  const linhas = registros.filter(f => String(f.data).slice(0, 7) === mes)
    .map(f => ({ ...f, centavos: Math.round((Number(f.valor) || 0) * 100),
      realizado: f.pago !== false && f.data <= hoje }))
    .sort((a, b) => a.data.localeCompare(b.data) || String(a.id).localeCompare(String(b.id)));
  const grupos = ['barbearia', 'pessoal'].map(escopo => {
    const itens = linhas.filter(f => (f.escopo === 'pessoal' ? 'pessoal' : 'barbearia') === escopo);
    const total = (tipo, realizado) => itens.filter(f => f.tipo === tipo && f.realizado === realizado)
      .reduce((s, f) => s + f.centavos, 0) / 100;
    return { escopo, titulo: escopo === 'pessoal' ? 'Contas pessoais de Tavares' : 'Barbearia', itens,
      entradas: total('receita', true), saidas: total('despesa', true),
      receber: total('receita', false), pagar: total('despesa', false) };
  });
  return { mes, linhas, grupos, estado: mes === hoje.slice(0, 7) ? 'Mês em andamento' : mes < hoje.slice(0, 7) ? 'Mês encerrado' : 'Mês futuro · previsão' };
}
function situacaoRelatorio(f) {
  return f.realizado ? (f.tipo === 'receita' ? 'Recebido' : 'Pago') : (f.tipo === 'receita' ? 'Previsto' : 'A pagar');
}
function categoriasRelatorio(g) {
  const categorias = new Map();
  g.itens.filter(f => f.tipo === 'despesa').forEach(f => {
    const nome = String(f.categoria || '').trim() || 'Sem categoria';
    if (!categorias.has(nome)) categorias.set(nome, { nome, pago: 0, pendente: 0 });
    categorias.get(nome)[f.realizado ? 'pago' : 'pendente'] += f.centavos;
  });
  return [...categorias.values()].sort((a, b) => b.pago - a.pago || b.pendente - a.pendente || a.nome.localeCompare(b.nome));
}
function avisoRelatorio() {
  return syncEstado !== 'ok' || !navigator.onLine
    ? 'Atenção: há falha de conexão ou sincronização em andamento. O relatório usa os dados disponíveis neste aparelho e pode estar incompleto. Confira a sincronização antes de compartilhar.'
    : 'Relatório dos lançamentos disponíveis no app. Mês encerrado indica que o mês já terminou; não significa que as contas foram conferidas.';
}
function renderRelatorio() {
  const r = dadosRelatorio(relatorioMes || finMes, db.financeiro, todayISO());
  return `<div style="max-width:960px;margin:auto">
    <button class="btn" onclick="switchTab('financeiro')">‹ Voltar ao financeiro</button>
    <h2>Seu mês em detalhes</h2>
    <p>Resumo de quanto entrou e quanto foi gasto, com as despesas da barbearia e as pessoais separadas. PDF consolidado, sem a lista de cada lançamento.</p>
    <div class="p-block"><label for="relatorioMes">Qual mês você quer consultar?</label>
      <input id="relatorioMes" type="month" class="srch" style="display:block;width:100%;max-width:240px;margin:12px 0" value="${esc(r.mes)}" onchange="mudarMesRelatorio(this.value)">
      <p><b>${esc(fmtMonth(r.mes))}</b> · ${r.estado}</p>
      <button class="btn" onclick="baixarRelatorioPDF()">Baixar relatório em PDF</button>
      <p style="font-size:.85rem;line-height:1.5">${esc(avisoRelatorio())}</p>
    </div>
    <p>Os valores seguem a data de cada lançamento. Contas a pagar e valores previstos ficam separados dos valores pagos ou recebidos. Receitas não são divididas automaticamente entre a barbearia e Tavares.</p>
    ${r.grupos.map(g => `<section class="p-block"><h3>${g.titulo}</h3>
      <div class="li"><span>Entradas recebidas</span><b class="valor-oculto" style="margin-left:auto;color:var(--green)">${money(g.entradas)}</b></div>
      <div class="li"><span>Despesas pagas</span><b class="valor-oculto" style="margin-left:auto;color:var(--red)">${money(g.saidas)}</b></div>
      <div class="li"><span>Diferença entre entradas e saídas</span><b class="valor-oculto" style="margin-left:auto">${money(g.entradas - g.saidas)}</b></div>
      <p class="valor-oculto">A pagar: ${money(g.pagar)} · Entradas previstas: ${money(g.receber)}</p>
      <small>Essa diferença não é o saldo da conta bancária. Não inclui dinheiro de meses anteriores.</small>
      <details style="margin-top:16px"><summary>Ver os ${g.itens.length} lançamentos</summary>
      ${g.itens.length ? g.itens.map(f => `<div style="padding:12px 0;border-bottom:1px solid var(--border);overflow-wrap:anywhere">
        <b>${esc(f.descricao || 'Sem descrição')}</b><br>
        <small>${esc(fmtDate(f.data))} · ${f.tipo === 'receita' ? 'Entrada' : 'Despesa'} · ${esc(f.categoria || 'Sem categoria')} · ${esc(PAG_LABEL[f.formaPag] || f.formaPag || 'Não informado')}</small><br>
        <span class="valor-oculto">${money(f.centavos / 100)}</span> · ${situacaoRelatorio(f)}</div>`).join('') : '<p>Nenhum lançamento neste mês.</p>'}
      </details></section>`).join('')}
    <p>O PDF mostra os valores completos, mesmo quando o olho do app está ocultando os valores.</p>
  </div>`;
}
function criarRelatorioPDF(r, aviso, emitido = new Date()) {
  const doc = new window.jspdf.jsPDF();
  const azul = [23, 40, 60], vermelho = [173, 37, 48], verde = [25, 112, 76];
  const texto = (s, y, tamanho = 10) => { doc.setFontSize(tamanho); doc.setTextColor(...azul); const ls = doc.splitTextToSize(String(s), 178); doc.text(ls, 16, y); return y + ls.length * tamanho * .42 + 4; };
  const rotulo = (s, x, y, tamanho = 10, cor = azul) => {
    doc.setFontSize(tamanho); doc.setTextColor(...cor); doc.text(String(s), x, y);
  };
  const recebido = r.grupos.reduce((v, g) => v + Math.round(g.entradas * 100), 0) / 100;
  const pago = r.grupos.reduce((v, g) => v + Math.round(g.saidas * 100), 0) / 100;
  const pendente = r.grupos.reduce((v, g) => v + Math.round(g.pagar * 100), 0) / 100;
  const negocio = r.grupos[0], pessoal = r.grupos[1];
  texto('DOM TAVARES | RESUMO FINANCEIRO', 20, 16);
  texto(fmtMonth(r.mes) + ' · ' + r.estado, 31, 11);
  texto('Emitido em ' + emitido.toLocaleString('pt-BR'), 39, 8);
  const cards = [ ['Entradas recebidas', recebido, verde], ['Gastos da barbearia', negocio.saidas, vermelho],
    ['Gastos pessoais', pessoal.saidas, vermelho], ['Diferença final', recebido - pago, recebido >= pago ? verde : vermelho] ];
  cards.forEach(([titulo, valor, cor], i) => {
    const x = 16 + (i % 2) * 92, y = 49 + Math.floor(i / 2) * 31;
    doc.setFillColor(244, 246, 249); doc.roundedRect(x, y, 86, 27, 3, 3, 'F');
    rotulo(titulo, x + 5, y + 9, 10); rotulo(money(valor), x + 5, y + 21, 17, cor);
  });
  texto('Entradas e gastos', 122, 13);
  const barras = [['Entradas', recebido, verde], ['Barbearia', negocio.saidas, vermelho], ['Pessoal', pessoal.saidas, vermelho]];
  const max = Math.max(1, ...barras.map(b => b[1]));
  barras.forEach(([nome, valor, cor], i) => {
    const y = 133 + i * 15;
    rotulo(nome, 16, y + 4, 9);
    doc.setFillColor(237, 240, 244); doc.rect(48, y, 105, 6, 'F');
    if (valor > 0) { doc.setFillColor(...cor); doc.rect(48, y, 105 * valor / max, 6, 'F'); }
    doc.setTextColor(...cor); doc.text(money(valor), 194, y + 4, {align: 'right'});
  });
  doc.autoTable({ startY: 183, margin: {left:16, right:16}, theme:'plain',
    body: [ ['Entradas da barbearia', money(negocio.entradas)], ['(-) Gastos pagos da barbearia', money(negocio.saidas)],
      ['Resultado da barbearia', money(negocio.entradas - negocio.saidas)], ['(+) Outras entradas pessoais registradas', money(pessoal.entradas)],
      ['(-) Gastos pessoais pagos', money(pessoal.saidas)], ['Diferença final', money(recebido - pago)] ],
    styles: {fontSize:10, cellPadding:2.3}, columnStyles:{1:{halign:'right'}},
    didParseCell: d => {if ([2,5].includes(d.row.index)) { d.cell.styles.fillColor=[244,246,249]; d.cell.styles.fontStyle='bold'; }}
  });
  let y = texto('A pagar: ' + money(pendente) + ' · Entradas previstas: ' + money(r.grupos.reduce((v,g)=>v+g.receber,0)), doc.lastAutoTable.finalY + 8, 9);
  y = texto('Valores registrados no app, pela data do lançamento. Previsões não entram no resultado. Diferença final não é saldo bancário nem retirada do titular.', y, 8);
  texto(aviso, y, 8);
  doc.addPage();
  texto('Gastos por categoria', 20, 17);
  texto(fmtMonth(r.mes) + ' · Barbearia e pessoal', 31, 10);
  let inicio = 44;
  r.grupos.forEach(g => {
    if (inicio > 240) { doc.addPage(); inicio = 22; }
    inicio = texto(g.titulo, inicio, 13);
    const categorias = categoriasRelatorio(g);
    doc.autoTable({startY:inicio, margin:{top:20,bottom:20,left:16,right:16}, theme:'striped',
      head:[['Categoria','Pago','A pagar']],
      body:categorias.length ? categorias.map(c=>[c.nome,money(c.pago/100),money(c.pendente/100)]) : [['Sem despesas registradas','-','-']],
      foot:[['Total',money(g.saidas),money(g.pagar)]],showFoot:'lastPage',
      headStyles:{fillColor:azul},footStyles:{fillColor:azul},styles:{fontSize:10,cellPadding:3},
      columnStyles:{0:{cellWidth:96},1:{halign:'right'},2:{halign:'right'}}});
    inicio=doc.lastAutoTable.finalY+15;
  });
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) { doc.setPage(i); doc.setTextColor(100); doc.setFontSize(8); doc.text(`Dom Tavares | ${r.mes} | Página ${i} de ${paginas}`, 16, 289); }
  return doc;
}
function baixarRelatorioPDF() {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF.API.autoTable) throw new Error('Biblioteca PDF indisponível');
    const r = dadosRelatorio(relatorioMes || finMes, db.financeiro, todayISO());
    criarRelatorioPDF(r, avisoRelatorio()).save(`dom-tavares-relatorio-${r.mes}.pdf`);
    toast('PDF gerado. Procure nos downloads do celular.');
  } catch (e) { console.error('Relatório PDF:', e); toast('Não foi possível gerar o PDF. Atualize a página e tente novamente.'); }
}
