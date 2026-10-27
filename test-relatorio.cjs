const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const { jsPDF } = require('./jspdf.umd.min.js');
require('./jspdf.plugin.autotable.min.js').applyPlugin(jsPDF);
const ctx = vm.createContext({ window: { jspdf: { jsPDF } },
  money: n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  fmtMonth: s => s, PAG_LABEL: { pix: 'PIX' } });
vm.runInContext(fs.readFileSync('relatorio.js', 'utf8'), ctx);
const rows = [
  { id: '1', data: '2026-10-01', tipo: 'receita', valor: 90, descricao: 'Cabelo e barba', formaPag: 'pix' },
  { id: '2', data: '2026-10-02', tipo: 'despesa', valor: 20, pago: true },
  { id: '3', data: '2026-10-03', tipo: 'despesa', valor: 30, pago: false },
  { id: '4', data: '2026-10-30', tipo: 'despesa', valor: 40, pago: true },
  { id: '5', data: '2026-10-02', tipo: 'despesa', valor: 10, escopo: 'pessoal' },
  { id: '6', data: '2026-09-02', tipo: 'receita', valor: 999 },
  { id: '7', data: '2026-10-04', tipo: 'receita', valor: 15, escopo: 'pessoal' }
];
const snapshot = JSON.stringify(rows);
const r = ctx.dadosRelatorio('2026-10', rows, '2026-10-27');
assert.equal(r.linhas.length, 6);
assert.equal(r.grupos[0].entradas, 90);
assert.equal(r.grupos[0].saidas, 20);
assert.equal(r.grupos[0].pagar, 70);
assert.equal(r.grupos[1].entradas, 15);
assert.equal(r.grupos[1].saidas, 10);
assert.equal(JSON.stringify(rows), snapshot);
const categorias = ctx.categoriasRelatorio(r.grupos[0]);
assert.equal(categorias.length, 1);
assert.equal(categorias[0].pago, 2000);
assert.equal(categorias[0].pendente, 7000);
assert.equal(ctx.dadosRelatorio('2026-09', rows, '2026-10-27').estado, 'Mês encerrado');
assert.equal(ctx.dadosRelatorio('2026-11', rows, '2026-10-27').estado, 'Mês futuro · previsão');
assert.equal(ctx.dadosRelatorio('2025-01', rows, '2026-10-27').linhas.length, 0);
const muitos = Array.from({length: 130}, (_, i) => ({id: String(i), data: '2026-10-02', tipo: i % 3 ? 'despesa' : 'receita', escopo: i % 2 ? 'pessoal' : 'barbearia', valor: 10.01,
  descricao: 'EXEMPLO - descrição longa de serviço ou compra para verificar a quebra de linhas e a leitura em todas as páginas.', categoria: ['Energia', 'Mercado', 'Aluguel', 'Insumos', 'Internet', 'Transporte', 'Outros'][i % 7], formaPag: 'pix', pago: i % 4 !== 0}));
const pdf = ctx.criarRelatorioPDF(ctx.dadosRelatorio('2026-10', muitos, '2026-10-27'), 'DADOS FICTÍCIOS - somente teste de apresentação.');
assert.ok(pdf.getNumberOfPages() > 3);
const conteudoPDF = pdf.output();
assert.ok(conteudoPDF.indexOf('Seu m') < conteudoPDF.indexOf('Para onde foi'));
const vazio = ctx.criarRelatorioPDF(ctx.dadosRelatorio('2025-01', rows, '2026-10-27'), 'Sem registros.');
assert.equal(vazio.getNumberOfPages(), 5);
if (process.argv.includes('--pdf')) fs.writeFileSync('teste-relatorio.pdf', Buffer.from(pdf.output('arraybuffer')));
const html = fs.readFileSync('index.html', 'utf8');
for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
console.log('OK: totais, escopos, pendências, períodos, dados preservados, sintaxe e PDF com ' + pdf.getNumberOfPages() + ' páginas.');
