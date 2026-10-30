# DH SORTEIOS — versão com caixa de entrada privada

Plataforma gamer pública com identidade visual azul/preta, cadastro/login, sorteios de contas/itens e números, bloqueio de participação por conta e IP, PIN para publicar e caixa de entrada privada para cada usuário.

## O que foi adicionado nesta versão
- Arte do banner usada como fundo do site, aproveitando a cidade e o controle gamer nas laterais e removendo a área central onde estavam as letras e a coroa.
- Caixa de entrada privada por usuário. As mensagens só são consultadas pelo usuário autenticado dono da conta.
- Boas-vindas automáticas ao criar conta.
- Quando o administrador realiza o sorteio, pode inserir as instruções/dados do prêmio. A mensagem é criada automaticamente na caixa privada do ganhador.
- O usuário pode abrir, marcar como lida e excluir suas próprias mensagens.
- O membro pode enviar agradecimentos/perguntas à equipe DH; a mensagem é privada e não pode ser enviada a outro participante. A equipe responde usando a API administrativa.
- Não existe chat entre participantes nem mensagens públicas entre usuários.

## Testar localmente
Requer Node.js 20+:
```bash
npm install
```
Crie um arquivo `.env` copiando `.env.example` e defina `JWT_SECRET`, `ADMIN_PIN` e `ADMIN_KEY`. Depois:
```bash
npm start
```
Acesse `http://localhost:3000`.

## Publicar no GitHub pelo Codespaces (ZIP extraído na raiz)
1. Crie um repositório vazio no GitHub e envie o ZIP `DH-SORTEIOS-GitHub-Render-V6.zip` para a raiz.
2. Abra **Code → Codespaces → Create codespace on main**.
3. No terminal, já na raiz do repositório, extraia o ZIP (os arquivos do projeto ficam diretamente na raiz, inclusive `package.json` e `render.yaml`):
```bash
unzip -o DH-SORTEIOS-GitHub-Render-V6.zip
```
4. Instale as dependências:
```bash
npm install
```
5. Teste o site:
```bash
npm start
```
6. Abra a porta 3000 no navegador do Codespaces. Para parar, pressione Ctrl+C.
7. Salve a versão extraída no GitHub, um comando por vez:
```bash
git add .
```
```bash
git commit -m "DH Sorteios V7 - mensagens e moderacao"
```
```bash
git push origin main
```
Se o repositório já tiver o projeto, envie o ZIP atualizado e repita a extração para substituir os arquivos. Não extraia dentro de uma subpasta: `package.json` e `render.yaml` precisam ficar na raiz do repositório para o Render detectar o serviço.

## Publicar no Render
O repositório tem `render.yaml`. No Render:
1. New + → Blueprint (ou Web Service) e conecte o repositório.
2. Build Command: `npm install`; Start Command: `npm start`.
3. Configure os segredos:
   - `JWT_SECRET`: chave longa e aleatória (não compartilhe).
   - `ADMIN_PIN`: PIN usado no formulário Criar sorteio.
   - `ADMIN_KEY`: chave separada usada para autorizar o sorteio e o envio da mensagem ao ganhador.
   - `DB_PATH`: `/var/data/dh.sqlite`.
4. Configure o disco persistente montado em `/var/data`.
5. Faça o deploy.

## Como publicar e entregar o prêmio
1. Entre com sua conta.
2. Clique em **Criar sorteio** e informe o `ADMIN_PIN` configurado no Render.
3. Quando houver participantes, clique em **Sortear e enviar prêmio** no cartão do sorteio.
4. Informe o `ADMIN_KEY`, o título da mensagem e o texto com as instruções/dados do prêmio.
5. O servidor escolhe um participante e grava a mensagem na caixa de entrada daquele ganhador. Nenhum outro usuário consegue consultar aquela mensagem pela API.
6. O ganhador entra na própria conta e abre **Caixa de entrada** no topo.

**Importante:** `ADMIN_KEY` e `ADMIN_PIN` são segredos diferentes. Nunca coloque nenhum deles no GitHub, no HTML, em mensagens públicas ou em prints.

## Limite por IP
Cada conta só participa uma vez por sorteio e cada IP público só participa uma vez por sorteio. O IP é guardado como hash. Pessoas diferentes no mesmo Wi-Fi podem compartilhar o mesmo IP público e uma delas pode ser bloqueada; mudar de aparelho na mesma rede normalmente não muda o IP. O limite não prova a identidade de uma pessoa.

## Segurança, privacidade e operação
Esta é uma primeira versão funcional, não uma plataforma auditada. Antes de abrir ao público, acrescente termos e política de privacidade, rotina de backup e revisão técnica. Mensagens de prêmio podem conter dados de acesso; envie apenas os dados estritamente necessários, use uma conta de jogo preparada para transferência e evite compartilhar senhas reutilizadas ou dados pessoais. Sorteios pagos, rifas e promoções comerciais podem exigir autorização/regras específicas no Brasil; valide antes de operar.


## Moderação de texto e fotos de perfil (V6)
- Mensagens, nomes, títulos e descrições passam por filtro de linguagem ofensiva. Quando detectar um termo bloqueado, o envio é impedido e aparece: `SOU CARENTE ME DESCULPA DH SORTEIO E 00 O MELHOR 💙👑`.
- O filtro usa uma lista-base de português, inglês e espanhol e normalização de caracteres; não existe lista capaz de cobrir literalmente todos os palavrões, gírias ou evasões. Revise e amplie a lista em `server.js` conforme necessário.
- Cada usuário pode enviar uma foto de perfil JPG/PNG/WEBP de até 4 MB.
- A foto só é gravada depois de passar pela moderação de nudez, armas, violência e gore do Sightengine. Sem credenciais Sightengine configuradas, o upload fica bloqueado por segurança.
- Crie uma conta em https://sightengine.com/ e obtenha as chaves no painel. No Render, adicione `SIGHTENGINE_API_USER` e `SIGHTENGINE_API_SECRET` como variáveis secretas. Nunca publique essas chaves no GitHub.
- A API externa pode ter limites/custos conforme o plano; confira os termos e preços do provedor. A detecção automática pode errar, então ofereça um canal de revisão para usuários.


## Caixa de entrada: mensagens de agradecimento e suporte (V6)
- A área privada tem um campo para o membro enviar mensagem somente à equipe DH.
- O endpoint `POST /api/inbox/send` exige login, limita a 5 mensagens a cada 10 minutos e aplica o filtro de linguagem.
- O administrador consulta mensagens com `GET /api/admin/inbox`, enviando o cabeçalho `x-admin-key: SUA_ADMIN_KEY`.
- Para responder, use `POST /api/admin/inbox/ID_DA_MENSAGEM/reply`, com o mesmo cabeçalho e JSON `{"body":"Sua resposta privada"}`. A resposta entra na caixa do usuário correto.
- Nunca coloque `ADMIN_KEY` no frontend ou no repositório. Use somente ferramenta/API administrativa segura.

## Filtro de palavrões
O filtro usa uma lista-base ampliada, normalização de acentos, caracteres substituídos e formas grudadas. A pesquisa encontrou listas públicas como [SecLists PT](https://github.com/danielmiessler/SecLists/blob/master/Miscellaneous/List-Of-Swear-Words/pt.txt), [palavrao](https://github.com/kyriosdata/palavrao) e [profanities](https://github.com/words/profanities). Não existe uma lista de “todos os palavrões”: gírias, erros, novas expressões e contexto mudam continuamente. Por isso, revise o filtro e evite bloquear palavras de identidade (como “gay” ou “lésbica”) isoladamente.

## Foto de perfil e segurança de imagens
A foto é verificada por serviço externo Sightengine antes de ser salva. Configure `SIGHTENGINE_API_USER` e `SIGHTENGINE_API_SECRET` no Render. Sem credenciais ou se a verificação falhar, a imagem não é aceita. A análise automática pode errar e não substitui denúncia/revisão humana. Confira preços, limites, privacidade e termos do fornecedor antes de publicar.
