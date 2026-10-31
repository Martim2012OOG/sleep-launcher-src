Continua o projeto "Kubo Launcher" (zip anexo). Lê primeiro README.md e PASSO_ATUAL.md. Os passos 2 a 9 podem não estar compilados: se algo não compilar, corrige primeiro.
Amigos e chat 1 a 1 já estão feitos (passo 9A, social.rs e social.js, mesmo backend do mod). Faz o PASSO 10: o que falta do social.
1. Grupos (GET/POST /groups, /groups/:id/messages, membros) e reações a mensagens (POST /messages/:id/reactions).
2. Notificações do backend (GET /notifications, POST /notifications/read) com sino na barra de cima.
3. Convidar um amigo para o servidor onde estou a jogar (precisa de ler o servidor atual do jogo).
Usa o Social.java do mod (kubo-v118-voice-fix.zip, src/main/java/dev/solclient/social) como referência dos endpoints. Mantém a regra: nenhum token sai do Rust.
No fim: explica o que fizeste, dá o zip completo e atualiza PASSO_ATUAL.md.
