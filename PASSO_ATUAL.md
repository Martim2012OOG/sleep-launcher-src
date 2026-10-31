# Estado do projeto: Kubo Launcher
## Passo 1 (feito)
- Projeto Tauri 2 (Rust) + interface HTML/CSS/JS sem build, tema igual ao client Kubo (cores e 8 presets de Theme.java)
- Menu: Jogar, Instalações, Skins e capas, Amigos, Loja, Definições

## Passo 2 (feito)
- mojang.rs: versões, client.jar, bibliotecas (regras por sistema e processador), natives, assets, evento "progress"
- launch.rs: monta o comando de arranque (argumentos novos e antigos)

## Passo 3 (feito, NÃO compilado: sem rede no ambiente onde foi escrito)
- java.rs: descarrega sozinho o Java certo (Adoptium Temurin, JRE ou JDK) para app_data/java/<versão>
- fabric.rs: perfil do Fabric (meta.fabricmc.net, loader estável mais recente) fundido com o json vanilla (inheritsFrom)
- mods.rs: lê o manifesto remoto e deixa em game/mods o jar certo para a versão do jogo, com verificação SHA1; apaga jars antigos do mesmo mod
- Instalações têm loader (Fabric ou Vanilla). Definições têm o endereço do manifesto (settings.json)
- Formato do manifesto: manifesto-exemplo.json. Para atualizar o mod em todas as versões: edita esse JSON no teu site

## Passo 4 (feito, NÃO compilado)
- Abrir com o computador: tauri-plugin-autostart, ligado ao interruptor em Definições (arranca com --hidden, escondido na bandeja)
- Bandeja: menu Abrir, Jogar última instalação, Sair; clique esquerdo abre; fechar a janela esconde
- settings.json guarda manifest_url, theme e last (última instalação jogada)

## Passo 5 (feito, NÃO compilado)
- auth.rs: login Microsoft numa janelinha dentro da app (código de autorização com PKCE, a janela apanha o redirecionamento), depois Xbox Live, XSTS e Minecraft. Renova sozinho com o refresh token
- A conta fica em account.json na pasta de dados da app (só neste computador). A interface nunca vê os tokens
- Jogar usa o nome, UUID e token reais; sem conta usa o modo offline "Kubo"
- Skins e capas: ver a skin (2D), trocar por PNG (classic ou slim), escolher a capa ativa ou nenhuma
- Definições: client ID do Azure
- Requer o URI de redirecionamento nativeclient no Azure e a aprovação da Mojang (ver README)

## Passo 6 (feito, NÃO compilado; a interface foi testada em jsdom)
- Interface nova estilo LabyMod, em 3 ficheiros: src/index.html, style.css, app.js (tudo o que existia continua: temas, login, skins e capas, definições, bandeja)
- Menu lateral: Jogar, Instâncias, Servidores, Chat, Personagem, Definições. Barra de cima com a conta
- Jogar: cenário com a skin da conta (2D), botão de lançar grande + trocar de instância, acesso rápido a servidores (--quickPlayMultiplayer, só 1.20+)
- Instâncias: grelha de cartões, criar (nome, versão, Fabric/Vanilla), apagar, abrir pasta. Página da instância com separadores
- Mods, Resource Packs e Shaders (modrinth.rs): Explorar com pesquisa e categorias, instalar (mods com dependências obrigatórias, SHA1 verificado), Instalados com ligar/desligar (.disabled) e apagar, abrir no site
- Registo do que foi instalado em game/kubo-index.json (nome e ícone)
- Amigos na página Jogar são só exemplo; Chat é uma página vazia

## Passo 7 (feito, NÃO compilado; interface testada em jsdom)
- curseforge.rs: pesquisa, categorias e instalar (com dependências obrigatórias, SHA1) na CurseForge para mods, resource packs e shaders
- Botão Modrinth/CurseForge ativo em Explorar. Instalados misturam as duas fontes (ids "cf:123" no kubo-index.json)
- A chave de API fica em settings.json (cf_key) e NUNCA é enviada à interface (get_settings só diz has_cf_key). Põe-se em Definições
- Mods com download desativado pelo autor dão erro claro e o botão de abrir no site continua a funcionar
- Não testado contra a API real (sem acesso de rede no ambiente onde foi escrito)

## Passo 8 (feito, NÃO compilado; interface testada em jsdom)
- Modpacks: botão Modpacks na página Instâncias. Pesquisa na Modrinth (só Fabric) e instala numa instância nova: descarrega o .mrpack, os ficheiros (8 em paralelo, SHA1, só hosts permitidos pela Modrinth), copia overrides e client-overrides. Pede Forge/NeoForge/Quilt → erro claro
- Atualizações: em Instalados, "Procurar atualizações" (Modrinth e CurseForge), botão Atualizar por item e Atualizar tudo. Compara o nome do ficheiro instalado com o mais recente compatível
- Modpacks da CurseForge não são suportados (só .mrpack)
- A instância criada pelo modpack fica "por instalar": o jogo instala-se ao carregar em Jogar

## Passo 9A (feito, Rust NÃO compilado; lógica da interface testada em Node com backend de exemplo)
- social.rs: ligação ao backend de amigos do mod (pal-connect-plaza). Login IGUAL ao do mod: POST /auth/minecraft com o token Minecraft, o username e o uuid. A sessão do backend fica em social.json. A interface nunca vê nenhum token: usa o comando social_req, que só deixa passar caminhos conhecidos (/friends, /messages, /me/, /notifications, /groups, /issue-token, /players/lookup) e o endereço do backend é fixo no código
- Sem conta Microsoft não há amigos (o /auth/offline do mod não foi copiado, para ninguém se fazer passar por outro nome)
- social.js (carrega antes do app.js): página Amigos (antiga Chat) com lista ordenada por estado, pedidos (aceitar, recusar, cancelar), adicionar amigo, remover (2 cliques), chat com polling (mensagens a cada 2,5 s, caixa de entrada a cada 6 s, amigos a cada 20 s), não lidas (também no menu e em avisos), editar e apagar mensagens, reenviar as que falharam, convites de servidor do mod com botão Entrar (usa a instância escolhida e --quickPlayMultiplayer), GIFs do Giphy/Tenor, seletor de estado (Online, Ausente, Ocupado, Invisível) e rascunho por conversa
- Presença: WebSocket para a sala "lobby" do mod (plegumo-presence). Assim os amigos veem-te online e tu vês quem está online no mod. Em Invisível o launcher sai da sala
- Página Jogar: painel de amigos real. Definições: chave do cliente do backend (opcional, só se o admin a ligou)
- Sem conta no preview: dados de exemplo (mockApi em social.js)

## Passo 9B (feito, Rust NÃO compilado; interface testada em Node com DOM simulado)
- Separadores da instância todos ativos: Servidores, Mundos, Capturas, Logs e Definições (src/inst.js, carrega antes do app.js; comandos Rust em src-tauri/src/inst.rs e main.rs)
- Servidores: lê e escreve o servers.dat da instância (NBT sem compressão, feito à mão em inst.rs; guarda servers.dat_old antes de escrever e mantém os campos que não conhece, como o ícone). Adicionar, remover e Jogar (entra direto, 1.20+)
- Mundos: lista as pastas de saves com tamanho e data, abrir pasta, apagar com confirmação
- Capturas: grelha com as 60 mais recentes (miniaturas feitas na interface), ver em grande, apagar com confirmação, abrir pasta
- Logs: latest.log com atualização em direto a cada 1,5 s (só o que é novo), Seguir ao fim, Copiar, ERROR a vermelho e WARN a amarelo. O polling pára ao sair do separador
- Definições da instância: nome (renomeia a pasta), ícone (emoji ou letra), RAM mínima e máxima, argumentos extra de Java e resolução. Ficam no instance.json (ram_min, ram_max, jvm_args, width, height, icon)
- launch.rs: usa -Xms/-Xmx da instância (padrão 2048 MB, como antes), junta os argumentos de Java e play_instance passa --width/--height quando definidos
- Todos os caminhos passam por `safe()` em inst.rs (um só nome de ficheiro, sem barras nem ".."); capturas só .png/.jpg, abrir pasta só saves, screenshots e logs

## Passo 9C (feito, Rust NÃO compilado; interface testada em Chromium sem cabeça, com o backend de exemplo)
- Loaders: Fabric, Quilt, Forge e NeoForge (além de Vanilla). O diálogo Nova instância tem os 5; o separador da instância e os cartões mostram o nome certo
- Quilt (fabric.rs, `profile(mc, parent, quilt)`): mesmo formato do Fabric, em meta.quiltmc.org/v3. Escolhe o loader estável (ou a primeira versão sem "-beta")
- Forge e NeoForge (loaders.rs): descarrega o instalador oficial (Forge: promotions_slim.json, recomendada ou mais recente; NeoForge: maven.neoforged.net, versão pelo prefixo da versão do jogo, estável antes de beta), cria o launcher_profiles.json que ele exige, corre `java -jar instalador --installClient <shared>` com o Java certo e lê o perfil que ele criou. Depois o perfil é fundido com o vanilla (`fabric::merge`, agora também com `minecraftArguments` do Forge antigo e sem `inheritsFrom`). O vanilla é instalado antes, porque o instalador precisa do client.jar. Forge só a partir do 1.12
- NeoForge: versão do jogo 1.X.Y → prefixo "X.Y." (1.21 → "21.0."); 26.1 → "26.1.0.", 26.1.2 → "26.1.2."
- mojang.rs: bibliotecas com url vazio (as que o instalador do Forge/NeoForge já criou) deixam de ser descarregadas
- Mods: Modrinth e CurseForge filtram pelo loader da instância (pesquisa, instalar com dependências, procurar atualizações). Quilt usa também os mods Fabric (Modrinth: quilt + fabric; CurseForge: Fabric). Forge e NeoForge têm o seu filtro
- A mod Kubo (manifesto) é injetada em Fabric e Quilt
- Consola do jogo (console.rs): o jogo arranca com stdout e stderr ligados; guarda as últimas 5000 linhas por instância e a interface lê-as por índice (comando read_console, a cada 0,7 s). Novo separador Consola na instância: estado, Seguir ao fim, Copiar, Limpar, Parar o jogo (com confirmação), ERROR a vermelho e WARN a amarelo. Eventos game-state (arrancou/terminou). Se o jogo fecha com código diferente de 0, aparece um aviso a mandar abrir a Consola
- Chip "● A correr" no cabeçalho da instância e na página Jogar (abre a consola). Definições da instância: interruptor "Abrir a consola ao jogar" (instance.json: open_console)
- Já não se pode lançar a mesma instância duas vezes ao mesmo tempo

## Passo 10 (feito, Rust NÃO compilado; interface testada em Chromium sem cabeça, com o backend de exemplo)
- Grupos (social.js): separador Grupos na página Amigos (lista com não lidas, Novo grupo com nome e até 20 amigos), chat do grupo com o nome de quem escreveu (polling igual ao 1 a 1), painel de Membros (adicionar amigos, remover membros se fores o criador, 2 cliques), Sair do grupo (2 cliques). Os não lidos dos grupos somam ao número do menu Amigos
- Reações: botão de carinha em cada mensagem (1 a 1 e grupos) com 6 emojis; as reações aparecem como chips por baixo da mensagem e carregar numa tira ou soma a tua (otimista, volta atrás se falhar). POST /messages/:id/reactions é tratado como alternar
- Notificações: sino na barra de cima (todas as páginas) com contador, painel com as últimas 30, clicar abre a conversa/grupo/pedidos, Marcar tudo como lido. GET /notifications a cada 15 s, POST /notifications/read. Os avisos novos que ainda não têm toast próprio (mensagem, pedido, grupo) aparecem como toast
- Convidar para o servidor: botão da bandeira no cabeçalho do chat (amigo ou grupo). O Rust (console.rs, `parse_server`, comando `current_server`) lê da consola do jogo o último "Connecting to host, porta"; a interface pré-preenche o endereço e deixa-te mudar o nome/endereço ou escolher um dos teus servidores. Envia a mesma marca `[ghost-invite|v1|nome|endereço]` que o mod usa, por isso aparece com botão Entrar. Limite: o log do jogo não diz quando se sai de um servidor, por isso é "o último a que o jogo se ligou"; num mundo de um jogador depois do servidor devolve nada
- Rust: só o comando current_server e `cargo test` em console.rs (5 testes de parse_server). social_req já deixava passar /groups, /notifications e /messages (inclui reações), por isso não mudou nada ali
- Formatos conferidos com o Social.java do mod (kubo-v118-voice-fix.zip): /groups devolve {groups:[{id,name,ownerId,members,lastMessage}]}, POST /groups {name,memberIds} → {group}, POST /groups/:id/messages {body}, POST /groups/:id/members {userId}, DELETE /groups/:id/members/:userId (sair = o teu id), POST /messages/:id/reactions {emoji} (alterna), GET /notifications → {notifications}. Limites do mod: 10 pessoas por grupo (9 amigos + tu) e 3 grupos por pessoa; o launcher aplica os dois
- Notificações: o backend só marca TUDO como lido (POST /notifications/read com {}). As lidas uma a uma ficam lembradas neste PC (localStorage kubo.nread), como o mod faz. O launcher manda {} e já não manda {ids} nem {all:true}
- O backend não tem "lido" nos grupos: POST /groups/:id/read pode dar erro e é ignorado. O mod também não mostra não lidas de grupos, por isso esse número só aparece se o site o devolver (campo unread)

## Passo 11 (feito, Rust NÃO compilado; interface testada em Chromium sem cabeça, com o backend de exemplo)
- Loja (src/shop.js, página nova no menu): GET /wallet e GET /shop?category= (moedas, categorias e itens com preço, desconto, destaque, comprado e equipado). Comprar = POST /shop/buy {itemId} com confirmação em 2 cliques e sem deixar comprar se faltarem moedas. Equipar = PUT /wardrobe/equip {itemId}; tirar = DELETE /wardrobe/equip/<id> (nas capas usa "Capes", como o mod). Equipar um item tira os outros da mesma categoria. Emotes e Bundles não se equipam
- Personagem, separador Kubo: capa da loja (só as que já compraste), skins Kubo (GET /capes → {capes,skins,active}; POST /capes {name,kind:"skin",image:data URL} só PNG 64x64, até 1 MB; PUT /capes/active manda sempre os dois ids, null = nenhum; DELETE /capes/<id> com 2 cliques) e as capas pessoais antigas (já não se enviam capas novas, como no mod)
- Rust: só social.rs. ALLOWED passou a incluir /wallet, /shop, /wardrobe e /capes (nunca /dev/coins, que dá moedas de teste). POST /capes tem 30 s de limite (os outros 15 s). 2 testes novos de okpath
- Itens da loja sem imageUrl https mostram um quadrado com a inicial. As imagens vêm direto do site da loja
- "Skins da comunidade": o backend do mod não tem nenhum endpoint para navegar skins de outras pessoas, por isso não foi feito. O que existe é enviar as tuas skins Kubo, que os outros jogadores do client veem
- A recompensa diária (GET /wallet traz daily.ready) não se recolhe aqui: o mod também só lê esse campo e não há endpoint conhecido para a recolher
- A skin ativa não aparece no boneco da página Personagem (esse mostra a skin da conta Microsoft)

## Limitações conhecidas

- Grupos: não se edita nem apaga mensagens de grupo (só no 1 a 1). Não há mudar o nome do grupo nem transferir o criador
- Reações: se o backend não devolver as reações na lista de mensagens, desaparecem ao atualizar
- Convidar: o servidor vem do log do jogo (último a que se ligou); não sabe se já saíste

- Logs mostram o latest.log; se o jogo crashar antes de o criar, fica vazio (a Consola mostra o que o jogo escreveu até ao crash)
- Consola: se saíres do launcher (Sair na bandeja) com o jogo aberto, o jogo continua mas a consola perde-se. A consola só guarda as últimas 5000 linhas
- Servidores: sem ping nem ícones; a lista só é fiável com o jogo fechado
- RAM: sem deteção da memória do computador, o limite é 65536 MB
- Presença por WebSocket e polling de amigos/chat: não testados contra o backend real
- Grupos: o mod também tem mudar o nome (PATCH /groups/:id {name}) e apagar o grupo (DELETE /groups/:id) para o criador; o launcher ainda não
- Servidores do acesso rápido guardados no localStorage da janela (não em settings.json)
- O refresh token fica em ficheiro simples (sem keyring do sistema)
- Não verifica SHA1 dos ficheiros do jogo (só dos mods)
- Modpacks continuam só em Fabric (pesquisa e .mrpack). Os de Quilt, Forge e NeoForge dão erro claro
- Forge/NeoForge: a versão do loader é sempre a recomendada/mais recente (ainda não se escolhe). Não testado contra os instaladores reais (sem rede nem cargo no ambiente)
- A mod Kubo só é injetada em Fabric e Quilt
- Versões do jogo sem loader (snapshots) só em Vanilla ou Fabric/Quilt, conforme o que o loader suportar

## Plano
9C. (feito)
10. (feito) Grupos, reações, notificações, convidar para o servidor onde estás. Emotes ficaram de fora
11. (feito) Loja, capas e skins Kubo. Skins da comunidade ficaram de fora (sem endpoint)
12. A decidir: mudar nome e apagar grupo, emotes, recolher a recompensa diária se o site a expuser, compilar e corrigir o Rust (passos 2 a 11)
