Continua o projeto "Kubo Launcher" (zip anexo). Lê primeiro README.md e PASSO_ATUAL.md. Os passos 2 a 8 podem não estar compilados: corrige primeiro o que não compilar.
Faz o PASSO 9: o resto dos separadores da instância (hoje desativados) e mais loaders.
1. Separadores: Servidores (servers.dat da instância), Mundos (lista as pastas de saves com tamanho, abrir pasta, apagar com confirmação), Capturas (grelha com as imagens de screenshots), Logs (mostra latest.log, com atualização em direto enquanto o jogo corre) e Definições da instância (RAM mínima e máxima, argumentos de Java, resolução, nome, ícone). launch.rs deve usar a RAM da instância em vez do -Xmx2G fixo.
2. Loaders: Forge, NeoForge e Quilt além de Fabric (instalador de cada um, perfil fundido como já é feito em fabric.rs). A pesquisa de mods filtra pelo loader da instância.
3. Mostrar a consola do jogo em direto ao jogar (stdout do processo) numa janela ou painel.
No fim: explica o que fizeste, dá o zip completo e o preview. Atualiza PASSO_ATUAL.md.
