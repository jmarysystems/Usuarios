# Usuarios

Sistema separado da JMarySystems, no mesmo padrão do Controle de Acesso.
Compartilha o mesmo banco Supabase dos outros sistemas.

## Banco

Tabela principal: `usuarios / produto_por_fornecedor`.

## Permissões

As ações de cadastrar, editar e excluir respeitam a matriz do **Controle de Acesso**
(módulo `usuario`), tanto na tela quanto nas políticas do banco.

## Rodar localmente

```bash
python -m http.server 5500
```
