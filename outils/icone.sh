#!/bin/sh
# Recopie apple-touch-icon.png (180 px) dans toutes les pages, sous forme de données (data:image/png;base64,…) :
# l'iPhone prend ainsi l'icône de l'écran d'accueil sans rien télécharger. À lancer après avoir changé le logo.
# Usage (à la racine du dépôt) : sh outils/icone.sh
set -e
b64=$(base64 -w0 apple-touch-icon.png)
for f in index.html icone.html jeux/*.html jeux/nivoculteur/index.html; do
  sed -i "s|<link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"data:image/png;base64,[A-Za-z0-9+/=]*\">|<link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"data:image/png;base64,$b64\">|" "$f"
done
echo "Icône recopiée dans les pages"
