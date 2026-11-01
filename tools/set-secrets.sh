#!/bin/bash
# Guarda os segredos no GitHub (repositórios privados). Corre-o TU num terminal: ./tools/set-secrets.sh
# Pede o token (não aparece no ecrã). As outras duas chaves já estão neste computador.
set -e
cd "$(dirname "$0")/.."
O=Martim2012OOG
printf "Cola o token do GitHub (fine-grained) e carrega Enter: "
read -rs TOKEN; echo
[ -n "$TOKEN" ] || { echo "Sem token. A sair."; exit 1; }
gh secret set RELEASES_TOKEN --repo $O/sleep-launcher-src --body "$TOKEN"
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $O/sleep-launcher-src < ~/.tauri/sleep.key
gh secret set KUBO_CF_KEY --repo $O/sleep-launcher-src < .cf_key
gh secret set LAUNCHER_REPO_TOKEN --repo $O/sleep-client --body "$TOKEN"
echo "Feito. Diz ao Claude para lançar o launcher."
