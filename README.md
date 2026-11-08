# Sleep Launcher
Tauri 2 (Rust) + interface em HTML/CSS/JS simples, sem build do frontend (compila rápido). Tema igual ao do client Sleep.

## Correr
1. Instalar Node.js e Rust (https://tauri.app/start/prerequisites/)
2. `npm install`
3. `npx tauri icon src-tauri/icons/icon.png`
4. `npm run dev`

Só a interface (sem Rust): abrir `src/index.html` no browser (dados de exemplo).
Se não compilar: `cd src-tauri && cargo check` e manda os erros a uma AI.

## Estrutura
- `src/index.html`, `style.css`, `app.js`: interface (páginas, temas, chamadas ao Rust)
- `src-tauri/src/modrinth.rs` e `curseforge.rs`: pesquisa e instalação de mods, packs e shaders

## CurseForge
A chave vem do ficheiro `.cf_key` na raiz do projeto (fora do git) ou do segredo `KUBO_CF_KEY` no CI. Vai baralhada dentro da app, mas quem quiser muito consegue extraí-la: a proteção a sério seria um servidor intermédio. Nunca aparece na interface.
- `src-tauri/src/mojang.rs`: versões e downloads
- `src-tauri/src/launch.rs`: comando de arranque do jogo
- `src-tauri/src/main.rs`: comandos Tauri e instâncias

## Bandeja e abrir com o PC
- Fechar a janela esconde o launcher na bandeja (Sair no menu da bandeja fecha mesmo)
- Linux: a bandeja precisa de libayatana-appindicator (ex: `sudo apt install libayatana-appindicator3-dev`)
- Definições (tema, última instalação, manifesto) ficam em settings.json na pasta de dados da app

## Login Microsoft
O login usa a janela da Microsoft com o client ID público do Minecraft: não precisa de configuração no Azure. Cada falha mostra o motivo real (sem perfil Xbox, conta de menor, sem o jogo, etc.) e os detalhes técnicos para copiar.

## Amigos e chat (passo 9A)
- Usa o mesmo backend e o mesmo login do mod do client: o launcher envia o token Minecraft a /auth/minecraft (HTTPS, só para o endereço fixo em `src-tauri/src/social.rs`). Quem controla esse backend consegue ver o token, por isso só aponta o launcher para um servidor teu.
- O token Minecraft e a sessão do backend ficam em Rust. A interface só recebe o perfil e as respostas.
- Sem conta Microsoft não há amigos nem chat.

## Separadores da instância (passo 9B)
- Servidores, Mundos, Capturas, Logs e Definições (RAM, argumentos de Java, resolução, nome e ícone) estão na página de cada instância.
- `src/inst.js`: interface destes separadores. `src-tauri/src/inst.rs`: ler mundos, capturas, logs e o servers.dat. Tudo fica dentro da pasta `game` da instância.

## Loaders e consola (passo 9C)
- Fabric, Quilt, Forge e NeoForge: escolhe ao criar a instância. Forge e NeoForge usam o instalador oficial (corre com o Java descarregado pelo launcher) e demoram mais na primeira vez.
- Se um loader falhar a instalar, a mensagem de erro traz as últimas linhas do instalador. Manda-as a uma AI.
- `src-tauri/src/loaders.rs`: Forge e NeoForge. `fabric.rs`: Fabric, Quilt e a fusão dos perfis. `console.rs`: consola do jogo.
- A consola mostra o stdout e o stderr do jogo em direto (separador Consola da instância). Em Definições da instância podes pedir que abra sozinha ao jogar.
- Testes: `cd src-tauri && cargo test` corre os testes de `loaders.rs` (prefixos e escolha de versões do NeoForge).

## Grupos, reações, notificações e convites (passo 10)
- Página Amigos: separador Grupos (criar, membros, sair). Em qualquer mensagem, a carinha deixa reagir.
- Sino na barra de cima: notificações do backend (as mesmas do mod).
- Bandeira no chat: convida o amigo ou o grupo para o servidor onde o jogo se ligou por último (lido da consola do jogo).
- `src/social.js` (bloco "passo 10"): tudo isto. `src-tauri/src/console.rs`: `parse_server` e o comando `current_server`. `cargo test` corre também os testes de `parse_server`.

## Loja, capas e skins Sleep (passo 11)
- Página **Loja** (menu lateral): moedas, categorias, comprar (2 cliques) e equipar ou tirar. É o mesmo backend e a mesma conta do mod. Para usar é preciso ter entrado com a conta Microsoft (como nos amigos).
- Página **Personagem**, separador **Sleep**: capa da loja (equipar ou tirar), skins Sleep (enviar PNG 64x64, Usar, Apagar) e as capas pessoais antigas.
- `src/shop.js`: tudo isto, mais o backend de exemplo do preview (`shopMock`). `src-tauri/src/social.rs`: o `social_req` passou a deixar passar `/wallet`, `/shop`, `/wardrobe` e `/capes` (nunca `/dev`), e o envio de uma skin tem 30 s de tempo limite. `cargo test` corre também os testes de `okpath`.


## Compilar sozinho no GitHub (Windows, macOS e Linux)
1. Cria um repositório no GitHub e faz push desta pasta para a branch `main` (a pasta `.github` tem de ir também).
2. Em **Settings > Actions > General > Workflow permissions**, escolhe **Read and write permissions**.
3. O separador **Actions** compila sozinho. Demora uns 10 a 20 minutos na primeira vez.
4. Os instaladores ficam em **Releases** (`.msi` e `.exe` no Windows, `.dmg` no Mac, `.deb`, `.rpm` e `.AppImage` no Linux).
- Para uma versão nova, muda `version` em `src-tauri/tauri.conf.json` e faz push: cria uma release nova.
- Antes de lançar: muda a versão em `tauri.conf.json`, `Cargo.toml` e `package.json` e usa a etiqueta `v` igual (o CI recusa se não coincidirem). No site liga só ao `.exe` no Windows.
- As apps não são assinadas: o Windows mostra o SmartScreen ("Mais informações > Executar mesmo assim") e no Mac é preciso clicar com o botão direito > Abrir.
