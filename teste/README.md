# Áster Conecta — piloto com Supabase

Endereço do piloto: https://bastosskleber-creator.github.io/gestao-servicos/teste/

O `index.html` da raiz continua sendo a versão principal. O piloto usa exclusivamente a chave publicável do Supabase; não contém senha, chave secret ou service_role.

## Comportamento

- Login por e-mail e senha com usuário previamente criado no Supabase. Não há cadastro público. A sessão usa sessionStorage e chave própria.
- Serviços, viagens, despesas, recebimentos, hotéis particulares, identificação e feriados ficam no JSON privado de cada usuário em `ac_dados_usuario`.
- Após uma alteração, uma cópia pendente é guardada no navegador e enviada automaticamente. O indicador distingue conta conectada, envio pendente, envio em andamento, erro e salvamento confirmado.
- As atualizações filtram por `usuario_id` e `versao`. O trigger do banco incrementa a versão. Um conflito preserva a cópia local, bloqueia novas edições e permite baixar a cópia antes de carregar a versão remota. Não existe mesclagem automática.
- Uma resposta perdida é conferida contra o estado remoto antes de reenviar. Alterações feitas durante um envio ficam na fila. Há nova tentativa ao voltar a conexão e conferência a cada 30 segundos com a página visível.
- O carregamento exige conexão e autenticação. O trabalho já aberto permite guardar alterações pendentes no navegador, sujeito à disponibilidade do armazenamento local.
- As cópias pendentes são separadas por conta e aba. O painel de backup também permite baixar cópias pendentes deixadas por outras abas da mesma conta.
- `ac_hoteis` e `ac_diarias` formam o catálogo compartilhado. O índice do banco impede nomes/cidades/UF equivalentes após normalizar espaços, maiúsculas e acentos. Grafias muito diferentes exigem conferência humana. Cada cidade pode ter vários hotéis.
- As diárias são acrescentadas com data e tipo de quarto. O catálogo mostra até 100 referências recentes de cada hotel. Não são concedidas alterações ou exclusões de hotéis e diárias aos participantes.
- Usar um hotel do catálogo cria uma cópia no cadastro particular. Alterar referências compartilhadas não atualiza reservas, despesas contratadas ou observações particulares.
- Não há importação automática dos dados da versão principal. Um backup pode ser importado de forma explícita pelo painel de backup; ele substitui os dados particulares da conta após confirmação e download da cópia anterior.
- O backup em pasta usa outro armazenamento de permissões e nome de arquivo exclusivo do piloto e do usuário. A gravação depende do sistema aberto e da permissão do navegador.
- Durante esta fase, a sincronização com Google Agenda permanece na versão principal. O piloto não escreve no calendário real e não importa seus vínculos.

## Banco necessário

Tabelas: `ac_dados_usuario`, `ac_hoteis`, `ac_diarias`, todas com RLS habilitado. A tabela particular exige política restrita a `auth.uid() = usuario_id` para todas as operações autorizadas. As tabelas compartilhadas permitem SELECT e INSERT a usuários autenticados, com `criado_por = auth.uid()` nos INSERTs. A role anon não tem acesso às tabelas.

`ac_dados_usuario.versao` começa em 1. O trigger `ac_controle_versao`, BEFORE UPDATE, atribui `new.versao := old.versao + 1`. O cliente depende desse incremento; uma resposta incompatível mantém o envio pendente com aviso.

## Validação

Testes de navegador com API simulada: login, isolamento da versão principal, inclusão inicial, finalização sem recebimento automático, fila de alterações durante um envio, recuperação de pendência após recarregar, conflito entre aparelhos, catálogo compartilhado, preservação de despesa contratada, repetição de diária após perda de resposta, troca de conta, largura móvel e ausência de erros JavaScript.

Execução: instale `playwright`, execute `npx playwright install chromium` e rode `node teste/tests/pilot.cjs` na raiz do repositório. `PILOT_CHROME_PATH` pode indicar um Chromium já instalado.

Também foi verificado no projeto real que consultas anônimas às três tabelas retornam HTTP 401 (permissão negada). Os testes simulados de isolamento entre contas não substituem o teste das políticas reais: antes de usar dados reais ou ampliar o piloto, validar com duas contas de teste que cada uma só consegue ler e alterar seus próprios dados particulares e que ambas consultam o mesmo catálogo.

## Dependência

`vendor/supabase.js`: distribuição UMD de `@supabase/supabase-js` 2.118.0, armazenada junto ao piloto. Licença em `vendor/LICENSE`. Não há dependência de CDN para carregar o cliente em tempo de execução.
