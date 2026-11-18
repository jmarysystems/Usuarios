// Tela genérica de cadastro: lista, filtro, formulário e exclusão.
import { listar, criar, atualizar, excluir } from './api.js';
import * as ui from './ui.js';

const rotuloDe = (listas, de, id) => {
  if (!de || !id) return '—';
  const itens = listas[de.tabela] || [];
  const achado = itens.find((x) => x.id === id);
  return achado ? achado[de.rotulo] : '—';
};

export async function render(raiz, ctx, cfg) {
  ctx.setTitulo(cfg.titulo);

  const podeCriar = ctx.pode(cfg.modulo, 'cadastrar');
  const podeEditar = ctx.pode(cfg.modulo, 'editar');
  const podeExcluir = ctx.pode(cfg.modulo, 'excluir');

  const listas = {};
  for (const campo of cfg.campos) {
    if (campo.de && !listas[campo.de.tabela]) {
      listas[campo.de.tabela] = await listar(campo.de.tabela, { ordem: campo.de.rotulo });
    }
  }

  const dados = await listar(cfg.tabela, { select: cfg.select || '*', ordem: cfg.ordem });

  function tabela() {
    if (!dados.length) return ui.vazio(cfg.vazio || 'Nenhum registro cadastrado.');
    return `
      <div class="tabela-rolagem"><table>
        <thead><tr>${cfg.colunas.map((c) => `<th>${ui.esc(c.rotulo)}</th>`).join('')}<th></th></tr></thead>
        <tbody>
          ${dados.map((d) => `<tr data-busca="${ui.esc(JSON.stringify(d).toLowerCase())}">
            ${cfg.colunas.map((c) => `<td class="${c.classe || ''}">${
              c.de ? ui.esc(rotuloDe(listas, c.de, d[c.campo]))
                   : ui.esc(d[c.campo] ?? '—')}</td>`).join('')}
            <td class="acoes">
              ${podeEditar ? `<button type="button" class="botao-pequeno" data-editar="${ui.esc(d.id)}">Editar</button>` : ''}
              ${podeExcluir ? `<button type="button" class="botao-pequeno botao-perigo" data-excluir="${ui.esc(d.id)}">Excluir</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }

  raiz.innerHTML = `
    <div class="cartao">
      <div class="cartao-topo">
        <h2>${dados.length} ${ui.esc(cfg.singular || 'registro')}(s)</h2>
        ${podeCriar ? `<div class="linha-acoes">
          <button type="button" class="botao-primario" id="novo">Novo ${ui.esc(cfg.singular || 'registro')}</button>
        </div>` : ''}
      </div>
      <label class="campo" style="max-width:340px"><span>Filtrar</span>
        <input type="search" id="filtro" placeholder="${ui.esc(cfg.filtro || 'Digite para filtrar')}"></label>
      <div id="lista">${tabela()}</div>
    </div>`;

  const filtro = raiz.querySelector('#filtro');
  filtro.addEventListener('input', () => {
    const t = filtro.value.toLowerCase();
    for (const tr of raiz.querySelectorAll('#lista tbody tr')) {
      tr.hidden = !!t && !tr.dataset.busca.includes(t);
    }
  });

  function abrirFormulario(registro) {
    const editando = !!registro.id;
    const camposHtml = cfg.campos.map((c) => {
      const valor = registro[c.campo] ?? '';
      if (c.tipo === 'select') {
        const itens = listas[c.de.tabela] || [];
        return `<label class="campo"><span>${ui.esc(c.rotulo)}${c.obrigatorio ? ' *' : ''}</span>
          <select name="${ui.esc(c.campo)}" ${c.obrigatorio ? 'required' : ''}>
            <option value="">—</option>
            ${itens.map((i) => `<option value="${ui.esc(i.id)}" ${
              i.id === valor ? 'selected' : ''}>${ui.esc(i[c.de.rotulo])}</option>`).join('')}
          </select></label>`;
      }
      if (c.tipo === 'check') {
        return `<label class="campo"><span>${ui.esc(c.rotulo)}</span>
          <input type="checkbox" name="${ui.esc(c.campo)}" ${valor ? 'checked' : ''}></label>`;
      }
      if (c.tipo === 'opcoes') {
        return `<label class="campo"><span>${ui.esc(c.rotulo)}${c.obrigatorio ? ' *' : ''}</span>
          <select name="${ui.esc(c.campo)}" ${c.obrigatorio ? 'required' : ''}>
            ${c.opcoes.map((o) => `<option value="${ui.esc(o.valor)}" ${
              o.valor === valor ? 'selected' : ''}>${ui.esc(o.rotulo)}</option>`).join('')}
          </select></label>`;
      }
      return ui.campoTexto(c.rotulo, c.campo, valor, {
        obrigatorio: c.obrigatorio,
        tipo: c.tipo === 'numero' ? 'number' : c.tipo === 'email' ? 'email' : 'text',
      });
    }).join('');

    const { fechar, corpo } = ui.modal({
      titulo: `${editando ? 'Editar' : 'Novo'} ${cfg.singular || 'registro'}`,
      largura: '680px',
      corpo: `
        <form id="form" class="grade grade-2">
          ${camposHtml}
          <div class="linha-acoes campo-largo">
            <button type="submit" class="botao-primario">${editando ? 'Salvar' : 'Cadastrar'}</button>
            <button type="button" id="cancelar">Cancelar</button>
          </div>
        </form>`,
    });

    corpo.querySelector('#cancelar').addEventListener('click', fechar);
    corpo.querySelector('#form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = ui.dadosDoForm(ev.target);
      const valores = {};

      for (const c of cfg.campos) {
        if (c.tipo === 'check') {
          valores[c.campo] = !!ev.target.querySelector(`[name="${c.campo}"]`).checked;
        } else if (c.tipo === 'numero') {
          valores[c.campo] = d[c.campo] ? Number(d[c.campo]) : null;
        } else {
          valores[c.campo] = d[c.campo] || null;
        }
        if (c.obrigatorio && (valores[c.campo] === null || valores[c.campo] === '')) {
          ui.toast(`Informe ${c.rotulo}.`, 'erro');
          return;
        }
      }

      try {
        if (editando) await atualizar(cfg.tabela, registro.id, valores);
        else await criar(cfg.tabela, { ...valores, ...(cfg.extra || {}) });
        fechar();
        ui.toast(editando ? 'Registro atualizado.' : 'Registro cadastrado.');
        ctx.recarregar();
      } catch (erro) {
        ui.toast(erro.message, 'erro');
      }
    });
  }

  raiz.querySelector('#novo')?.addEventListener('click', () => abrirFormulario({}));

  for (const b of raiz.querySelectorAll('[data-editar]')) {
    b.addEventListener('click', () => abrirFormulario(dados.find((d) => d.id === b.dataset.editar) || {}));
  }
  for (const b of raiz.querySelectorAll('[data-excluir]')) {
    b.addEventListener('click', async () => {
      if (!window.confirm('Excluir este registro?')) return;
      try {
        await excluir(cfg.tabela, b.dataset.excluir);
        ui.toast('Registro excluído.');
        ctx.recarregar();
      } catch (erro) { ui.toast(erro.message, 'erro'); }
    });
  }
}
