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
    <p>O PDF começa com um resumo visual do mês, depois mostra as despesas por categoria e, no final, cada lançamento. Baixe para guardar ou compartilhar.</p>
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
  texto('DOM TAVARES', 18, 11);
  texto('Seu mês em um olhar', 29, 22);
  texto(`${fmtMonth(r.mes)} - ${r.estado}`, 39, 11);
  texto(`Emitido em ${emitido.toLocaleString('pt-BR')}`, 47, 8);
  const cartoes = [ ['Entrou no mês', recebido, verde], ['Despesas pagas', pago, vermelho],
    ['Entradas menos saídas', recebido - pago, recebido - pago < 0 ? vermelho : verde], ['Ainda falta pagar', pendente, vermelho] ];
  cartoes.forEach(([titulo, valor, cor], i) => {
    const x = 16 + (i % 2) * 92, y = 55 + Math.floor(i / 2) * 30;
    doc.setFillColor(244, 246, 249); doc.roundedRect(x, y, 86, 26, 3, 3, 'F');
    rotulo(titulo, x + 5, y + 8, 9);
    rotulo(money(valor), x + 5, y + 19, 16, cor);
  });
  texto('Barbearia e pessoal, lado a lado', 126, 14);
  texto('Verde: entradas recebidas. Vermelho: despesas pagas. Mesma escala nos dois gráficos.', 134, 8);
  const maximo = Math.max(1, ...r.grupos.flatMap(g => [g.entradas, g.saidas]));
  r.grupos.forEach((g, i) => {
    const x = 16 + i * 92;
    rotulo(i ? 'Pessoal · Tavares' : 'Barbearia', x, 146, 12);
    [[g.entradas, 'Entrou', verde], [g.saidas, 'Saiu', vermelho]].forEach(([valor, label, cor], j) => {
      const y = 156 + j * 19;
      rotulo(`${label}: ${money(valor)}`, x, y, 9);
      doc.setFillColor(237, 240, 244); doc.rect(x, y + 3, 84, 5, 'F');
      if (valor > 0) { doc.setFillColor(...cor); doc.rect(x, y + 3, 84 * valor / maximo, 5, 'F'); }
    });
    rotulo(`A pagar: ${money(g.pagar)}`, x, 193, 9, vermelho);
    rotulo(`Entradas previstas: ${money(g.receber)}`, x, 200, 9);
  });
  texto(pago ? `De cada R$ 100 em despesas pagas, R$ ${(r.grupos[0].saidas / pago * 100).toFixed(0)} foram da barbearia e R$ ${(100 - Math.round(r.grupos[0].saidas / pago * 100)).toFixed(0)} foram pessoais.` : 'Ainda não há despesas pagas registradas neste mês.', 214, 10);
  let y = texto('A diferença entre entradas e saídas não é o saldo bancário. Contas a pagar e entradas previstas ficam fora dela. Valores pela data do lançamento; receitas sem divisão automática.', 233, 8);
  texto(aviso, y, 8);
  // Categorias vêm antes de qualquer lançamento individual.
  r.grupos.forEach(g => {
    doc.addPage();
    let inicio = texto(`Para onde foi o dinheiro?`, 20, 18);
    inicio = texto(g.titulo + ' | ' + fmtMonth(r.mes), inicio, 11);
    const categorias = categoriasRelatorio(g);
    if (!categorias.length) { texto('Nenhuma despesa registrada neste mês.', inicio); return; }
    const pagas = categorias.filter(c => c.pago > 0);
    if (pagas.length) {
      const principal = pagas[0];
      const nomePrincipal = principal.nome.length > 100 ? principal.nome.slice(0, 97) + '...' : principal.nome;
      inicio = texto(`Maior despesa paga: ${nomePrincipal}, com ${money(principal.pago / 100)} (${(principal.pago / 100 / g.saidas * 100).toFixed(1).replace('.', ',')}% das despesas pagas).`, inicio, 10);
      inicio = texto('Maiores categorias de despesas pagas', inicio, 11);
      pagas.slice(0, 5).forEach(c => {
        const linhasNome = doc.splitTextToSize(c.nome, 115);
        const nomes = linhasNome.slice(0, 2);
        if (linhasNome.length > 2) nomes[1] = nomes[1].slice(0, -3) + '...';
        doc.setFontSize(9); doc.setTextColor(...azul); doc.text(nomes, 16, inicio);
        doc.text(money(c.pago / 100), 194, inicio, { align: 'right' });
        inicio += nomes.length * 4;
        doc.setFillColor(237, 240, 244); doc.rect(16, inicio, 178, 4, 'F');
        doc.setFillColor(...vermelho); doc.rect(16, inicio, 178 * c.pago / principal.pago, 4, 'F');
        inicio += 11;
      });
    } else inicio = texto('Nenhuma despesa paga. As contas previstas aparecem na tabela abaixo.', inicio, 10);
    inicio = texto('Todas as categorias · valores pagos e a pagar separados', inicio + 3, 10);
    doc.autoTable({ startY: inicio, margin: { top: 20, bottom: 20, left: 16, right: 16 },
      head: [['Categoria', 'Já pago', '% do pago', 'A pagar']],
      body: categorias.map(c => [c.nome, money(c.pago / 100), g.saidas ? `${(c.pago / 100 / g.saidas * 100).toFixed(1).replace('.', ',')}%` : '-', money(c.pendente / 100)]),
      foot: [['Total', money(g.saidas), g.saidas ? '100%' : '-', money(g.pagar)]], showFoot: 'lastPage',
      theme: 'striped', headStyles: { fillColor: azul }, footStyles: { fillColor: azul },
      styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' }, columnStyles: { 0: { cellWidth: 76 } }
    });
  });
  r.grupos.forEach(g => {
    doc.addPage();
    let inicio = texto(g.titulo, 20, 16);
    inicio = texto(`${fmtMonth(r.mes)} | ${g.itens.length} lançamentos`, inicio, 10);
    if (!g.itens.length) { texto('Nenhum lançamento neste mês.', inicio); return; }
    doc.autoTable({ startY: inicio, margin: { top: 20, bottom: 20, left: 12, right: 12 },
      head: [['Data', 'Tipo', 'Descrição / categoria', 'Pagamento', 'Situação', 'Valor']],
      body: g.itens.map(f => [f.data.split('-').reverse().join('/'), f.tipo === 'receita' ? 'Entrada' : 'Despesa',
        `${f.descricao || 'Sem descrição'}\n${f.categoria || 'Sem categoria'}`, PAG_LABEL[f.formaPag] || f.formaPag || 'Não informado', situacaoRelatorio(f), money(f.centavos / 100)]),
      theme: 'striped', headStyles: { fillColor: azul }, styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 18 }, 2: { cellWidth: 61 }, 3: { cellWidth: 28 }, 4: { cellWidth: 24 }, 5: { cellWidth: 33, halign: 'right' } },
      didParseCell: d => { if (d.section === 'body' && d.column.index === 5) d.cell.styles.textColor = g.itens[d.row.index].tipo === 'receita' ? verde : vermelho; }
    });
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
