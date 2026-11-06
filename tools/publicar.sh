#!/bin/bash
# build local + push dist na gh-pages (sem Actions)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
npx vite build --outDir "$OUT" --emptyOutDir >/dev/null
touch "$OUT/.nojekyll"
cd "$OUT"; git init -q -b gh-pages; git add -A; git commit -qm "publicar $(TZ=America/Sao_Paulo date +%F_%H:%M)"
git push -fq https://github.com/LucasOl1337/the-last-arrow-web.git gh-pages
rm -rf "$OUT"; echo "https://lucasol1337.github.io/the-last-arrow-web/"
