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
    <p>Veja o que entrou, o que saiu e o que ainda falta pagar. Baixe um PDF para guardar ou compartilhar.</p>
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
  let y = texto('DOM TAVARES | RELATÓRIO FINANCEIRO', 20, 16);
  y = texto(`${fmtMonth(r.mes)} - ${r.estado}`, y, 12);
  y = texto(`Emitido em ${emitido.toLocaleString('pt-BR')}`, y, 9);
  y = texto(aviso, y, 9);
  y = texto('Valores pela data do lançamento. Contas a pagar e entradas previstas não entram nos totais pagos e recebidos. Receitas seguem a classificação cadastrada, sem divisão automática.', y, 9);
  doc.autoTable({ startY: y, margin: { left: 16, right: 16 }, theme: 'grid',
    head: [['Resumo do mês', 'Barbearia', 'Tavares']],
    body: [['Entradas recebidas', ...r.grupos.map(g => money(g.entradas))],
      ['Despesas pagas', ...r.grupos.map(g => money(g.saidas))],
      ['Entradas menos despesas pagas', ...r.grupos.map(g => money(g.entradas - g.saidas))],
      ['Contas a pagar', ...r.grupos.map(g => money(g.pagar))],
      ['Entradas previstas', ...r.grupos.map(g => money(g.receber))]],
    headStyles: { fillColor: azul }, styles: { fontSize: 9, cellPadding: 3 } });
  texto('A diferença não representa o saldo bancário. Não inclui dinheiro de meses anteriores. As páginas seguintes mostram cada lançamento.', doc.lastAutoTable.finalY + 10, 9);
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
