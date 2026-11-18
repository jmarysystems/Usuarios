// Usuários: lista, cadastro (com login) e edição.
import { listar, criar, atualizar, criarLogin, rpc } from '../api.js';
import * as ui from '../ui.js';

const TIPOS = [
  { valor: 'administrador', rotulo: 'Administrador' },
  { valor: 'leitura', rotulo: 'Leitura' },
  { valor: 'fornecedor', rotulo: 'Fornecedor' },
  { valor: 'armazenados', rotulo: 'Armazenados' },
];

const rotuloTipo = (t) => (TIPOS.find((x) => x.valor === t) || { rotulo: t }).rotulo;

export async function render(raiz, ctx) {
  ctx.setTitulo('Usuários');

  const podeCriar = ctx.pode('usuario', 'cadastrar');
  const podeEditar = ctx.pode('usuario', 'editar');
  const usuarios = await listar('usuarios', { ordem: 'nome' });

  raiz.innerHTML = `
    <div class="cartao">
      <div class="cartao-topo">
        <h2>${usuarios.length} usuário(s)</h2>
        ${podeCriar ? '<button type="button" class="botao-primario" id="novo">Novo usuário</button>' : ''}
      </div>
      <div class="tabela-rolagem"><table>
        <thead><tr><th>Nome</th><th>CPF/CNPJ (login)</th><th>Perfil</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          ${usuarios.map((u) => `<tr>
            <td>${ui.esc(u.nome)}</td>
            <td class="mono">${ui.esc(u.cpf_cnpj)}</td>
            <td>${ui.esc(rotuloTipo(u.tipo))}</td>
            <td>${u.ativo ? 'ativo' : 'inativo'}</td>
            <td class="acoes">${podeEditar
              ? `<button type="button" class="botao-pequeno" data-editar="${ui.esc(u.id)}">Editar</button>`
              : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;

  function formulario(registro) {
    const editando = !!registro.id;
    const { fechar, corpo } = ui.modal({
      titulo: editando ? 'Editar usuário' : 'Novo usuário',
      largura: '620px',
      corpo: `
        <form id="form" class="grade grade-2">
          ${ui.campoTexto('Nome', 'nome', registro.nome, { obrigatorio: true })}
          ${ui.campoTexto('CPF/CNPJ', 'cpf_cnpj', registro.cpf_cnpj, { obrigatorio: true })}
          ${editando ? '' : ui.campoTexto('Senha', 'senha', '', { obrigatorio: true, tipo: 'password' })}
          ${ui.campoSelect('Perfil', 'tipo', TIPOS, registro.tipo || 'leitura', { obrigatorio: true })}
          <label class="campo"><span>Ativo</span>
            <input type="checkbox" name="ativo" ${registro.ativo === false ? '' : 'checked'}></label>
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
      const ativo = ev.target.querySelector('[name="ativo"]').checked;
      try {
        if (editando) {
          await atualizar('usuarios', registro.id, {
            nome: d.nome, cpf_cnpj: d.cpf_cnpj, tipo: d.tipo, ativo,
          });
        } else {
          const user = await criarLogin(d.cpf_cnpj, d.senha);
          try {
            await rpc('fn_confirmar_usuario', { p_auth_user_id: user.id });
          } catch (erroConfirmacao) {
            console.warn('Não foi possível confirmar o e-mail:', erroConfirmacao.message);
          }
          await criar('usuarios', {
            auth_user_id: user.id,
            nome: d.nome,
            cpf_cnpj: d.cpf_cnpj,
            tipo: d.tipo,
            ativo,
          });
        }
        fechar();
        ui.toast(editando ? 'Usuário atualizado.' : 'Usuário cadastrado.');
        ctx.recarregar();
      } catch (erro) {
        ui.toast(erro.message, 'erro');
      }
    });
  }

  raiz.querySelector('#novo')?.addEventListener('click', () => formulario({}));
  for (const b of raiz.querySelectorAll('[data-editar]')) {
    b.addEventListener('click', () => formulario(usuarios.find((u) => u.id === b.dataset.editar) || {}));
  }
}
