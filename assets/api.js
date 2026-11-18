// Acesso a dados: Supabase Auth + REST + RPC.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_KEY, LOGIN_DOMAIN } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

const clienteCadastro = () => createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const TRADUCOES = [
  ['Invalid login credentials', 'CPF/CNPJ ou senha inválidos.'],
  ['Email not confirmed', 'Este login ainda não foi confirmado.'],
  ['row-level security', 'Seu perfil não tem permissão para esta ação.'],
  ['duplicate key value', 'Já existe um registro com este valor.'],
  ['User already registered', 'Este CPF/CNPJ já tem login.'],
];

export function traduzErro(erro) {
  const msg = typeof erro === 'string' ? erro : (erro && erro.message) || String(erro);
  for (const [en, pt] of TRADUCOES) {
    if (msg.toLowerCase().includes(en.toLowerCase())) return pt;
  }
  return msg;
}

export const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
export const emailDoLogin = (doc) => `${soDigitos(doc)}@${LOGIN_DOMAIN}`;

export async function entrar(documento, senha) {
  const entrada = String(documento ?? '').trim();
  const email = entrada.includes('@') ? entrada.toLowerCase() : emailDoLogin(entrada);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(traduzErro(error));
  return data.user;
}

export async function criarLogin(documento, senha) {
  const cli = clienteCadastro();
  const { data, error } = await cli.auth.signUp({
    email: emailDoLogin(documento), password: senha,
  });
  if (error) throw new Error(traduzErro(error));
  if (!data.user) throw new Error('O Supabase não retornou o usuário criado.');
  try { await cli.auth.signOut(); } catch (_) { /* ignora */ }
  return data.user;
}

export async function sair() {
  await sb.auth.signOut();
}

export async function sessao() {
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

export async function listar(tabela, opcoes = {}) {
  let q = sb.from(tabela).select(opcoes.select || '*');
  for (const [campo, valor] of Object.entries(opcoes.eq || {})) q = q.eq(campo, valor);
  if (opcoes.ordem) q = q.order(opcoes.ordem, { ascending: opcoes.asc !== false });
  if (opcoes.limite) q = q.limit(opcoes.limite);
  const { data, error } = await q;
  if (error) throw new Error(traduzErro(error));
  return data || [];
}

export async function criar(tabela, dados) {
  const { data, error } = await sb.from(tabela).insert(dados).select();
  if (error) throw new Error(traduzErro(error));
  return Array.isArray(data) ? data[0] : data;
}

export async function atualizar(tabela, id, dados) {
  const { data, error } = await sb.from(tabela).update(dados).eq('id', id).select();
  if (error) throw new Error(traduzErro(error));
  if (!Array.isArray(data) || !data.length) {
    throw new Error('Sem permissão para alterar este registro.');
  }
  return data[0];
}

export async function excluir(tabela, id) {
  const { data, error } = await sb.from(tabela).delete().eq('id', id).select();
  if (error) throw new Error(traduzErro(error));
  if (!Array.isArray(data) || !data.length) {
    throw new Error('Sem permissão para excluir este registro.');
  }
}

export async function rpc(nome, args = {}) {
  const { data, error } = await sb.rpc(nome, args);
  if (error) throw new Error(traduzErro(error));
  return data;
}

export async function minhasPermissoes() {
  const { data, error } = await sb.rpc('minhas_permissoes');
  return error ? {} : (data || {});
}

export async function meuPerfil() {
  const s = await sessao();
  if (!s) return null;
  const { data, error } = await sb
    .from('usuarios')
    .select('id, nome, cpf_cnpj, tipo, ativo')
    .eq('auth_user_id', s.user.id)
    .maybeSingle();
  if (error) throw new Error(traduzErro(error));
  return data;
}
