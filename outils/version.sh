#!/bin/sh
# Nouvelle version d'Altitude : change VERSION dans sw.js et le numéro ?v= des scripts dans les pages,
# pour que les téléphones prennent les nouveaux fichiers (et jamais un mélange d'ancien et de nouveau).
# Usage (à la racine du dépôt) : sh outils/version.sh
set -e
ancien=$(sed -n "s/^const VERSION = 'desdes-v\([0-9]*\)';/\1/p" sw.js)
nouveau=$((ancien + 1))
sed -i "s/^const VERSION = 'desdes-v$ancien';/const VERSION = 'desdes-v$nouveau';/" sw.js
for f in index.html jeux/*.html jeux/nivoculteur/index.html; do
  sed -i "s/\.js?v=$ancien\"/.js?v=$nouveau\"/g; s/fichier + '?v=$ancien'/fichier + '?v=$nouveau'/" "$f"
done
echo "Version $ancien → $nouveau"
