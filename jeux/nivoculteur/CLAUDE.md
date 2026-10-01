# Nivoculteur — jeu de neige de culture

Jeu 3D de gestion et de construction sur le métier de nivoculteur (technicien de production de neige de culture).
Il fait partie de la plate-forme DesDés (carte sur l'accueil `../../index.html`), mais s'ouvre aussi seul en double-cliquant sur `index.html`.

L'utilisateur est nivoculteur de métier, pas développeur : le jeu doit être crédible techniquement mais simple à jouer.
Expliquer les choix simplement, sans jargon non expliqué, et **demander avant toute décision importante**.
Avancer étape par étape : proposer un plan court, attendre la validation, puis coder ; à la fin de chaque étape, dire comment tester et mettre ce fichier à jour.

## Vision

Enneiger les pistes d'une station avant la date d'ouverture, puis tenir la saison, en construisant et en faisant fonctionner un réseau de neige de culture, avec un budget limité (esprit « jeu de construction de ponts »).

Boucle : **construire** le jour (regards, canons, conduites d'eau, câbles) → **produire** la nuit (pression, eau, tas de neige) → **gagner** (la neige tombée sur la piste rapporte) → **agrandir / réparer**.

## Règles techniques

- Tout le jeu tient dans **`index.html`** (HTML + CSS + JavaScript). Pas de npm, pas de Vite, pas de TypeScript, **pas de modules ES (`import`)** : le fichier doit s'ouvrir en double-cliquant (`file://`).
- **Three.js 0.149.0** en script classique : d'abord la copie locale `three.min.js` (jeu hors ligne), sinon le CDN jsdelivr.
- Graphismes **low-poly** (ombrage plat), toutes les formes créées par le code : pas de modèle 3D ni d'image externe (les textures éventuelles sont dessinées par le code dans un canvas).
- Commandes souris et tactiles : glisser = tourner ; pincer / molette = zoom ; deux doigts / clic droit = déplacer ; toucher court = action.
- Page adaptée au téléphone (portrait et paysage) et à l'ordinateur.
- Performances : réutiliser géométries et matériaux, objets répétés en `InstancedMesh`, peu de particules.
- Sauvegarde dans `localStorage`, toujours dans un `try/catch` (à partir de l'étape 5 ; clés préfixées `nivo-`).
- **Toute l'interface est en français.**
- Unité : **1 unité 3D = 1 mètre**. Axe x de gauche à droite, axe z du haut de la pente (négatif) vers le bas (positif), y = altitude − altitude du bas.
- Si le fichier dépasse ~3 000 lignes, proposer de le découper en quelques `.js` chargés par des `<script>` classiques.

### Sections du script (dans cet ordre)

1. `CONFIG` : tous les chiffres réglables, commentés en français (valeurs provisoires, à ajuster par l'utilisateur).
2. `LEVELS` : description des niveaux (terrain, pistes, pompage, retenue, départs électriques, budget, objectif).
3. `SIMULATION` : logique pure, **jamais de Three.js** (pression, coûts, terrain, pistes, et plus tard réseau, neige, pannes). Contient `testsSimulation()`.
4. `MODELES 3D` : terrain, sapins, rochers, jalons, montagnes (puis canon, regard, salle de pompage, armoire, compresseur, perche).
5. `EFFETS` : ciel, étoiles, lune, lumières (puis particules de neige, brouillard, tas).
6. `INTERFACE` : messages, barre du bas, panneaux.
7. `JEU` : scène, boucle, caméra, commandes.

### Modes spéciaux

- `index.html?test` : lance `testsSimulation()` et affiche OK / ERREUR à l'écran (et dans la console).
- `index.html?modeles` : vitrine des modèles 3D (prévu à l'étape 1).

On peut aussi vérifier que la simulation tourne sans Three.js en extrayant les sections 1 à 3 et en les lançant avec Node.

### Intégration DesDés

- Carte `.gnivo` dans `../../index.html`, raccourci dans `../../manifest.webmanifest`.
- `index.html` et `three.min.js` sont dans la liste `SHELL` de `../../sw.js` : **changer `VERSION`** dans `sw.js` à chaque mise à jour.

## Choix déjà faits (à confirmer ou ajuster par l'utilisateur)

- Terrain de démonstration : combe de 300 m × 500 m, 150 m de dénivelé (1 650 → 1 800 m), piste bleue « Les Clarines » de 40 m de large.
- Formule de pression : `P_regard = P_pompes − longueur/100 × 0,6 − dénivelé/10 × 1,2 − débit × 0,05`.
  Les coefficients du cahier des charges (0,6 et 1,2) sont compris **par 100 m de conduite** et **par 10 m de montée** (sinon 100 m de conduite feraient perdre 60 bar). Un regard plus bas que le pompage gagne de la pression.
- Zones de pression : < 22 bar arrêt, 22–30 faible, 30–50 correcte, **50–55 « haute »** (on produit normalement, mais à surveiller), > 55 surpression.
- Sur la piste, la neige est « damée » : le terrain y a moins de petites bosses (`altitude(t, x, z, pistes)`).

## Coûts et gains de départ (dans `CONFIG`)

Tranchée eau seule 750 €/m · câble seul 550 €/m · commune eau + câble 900 €/m · regard + canon 8 000 € · gain 20 € par m³ de neige tombée sur la piste.

## Plan et avancement

- [x] **Étape 0 — Base du projet** : page avec Three.js, sections en place, nuit (ciel, étoiles, lune), terrain low-poly avec piste damée, jalons, sapins, rochers, montagnes au loin, caméra orbite (tourner, zoomer, déplacer), toucher = altitude + sur/hors piste, barre du bas, messages colorés, mode `?test` (18 vérifications).
- [ ] **Étape 1 — Modèles 3D** : canon ventilateur (cylindre creux, hélice arrière sous grille, couronne de buses, fourche orientable, voyant), regard triangulaire avec vanne, salle de pompage (pompes, manomètres, collecteurs, pupitre, gyrophare), armoire électrique « Départ élec ». Vitrine `?modeles`.
- [ ] **Étape 2 — Niveau 1** : salle de pompage jouable (3 pompes, vanne principale, pression, retenue, coup de bélier).
- [ ] **Étape 3 — Construction** : regards, tracé de l'eau et de l'électricité (choix du départ), coûts, tranchée commune, vue sous-sol, annuler.
- [ ] **Étape 4 — Production et argent** : nuits, particules, tas de neige, gains, objectif du niveau 2.
- [ ] **Étape 5 — Menus et niveaux** : menu, choix du niveau, sauvegarde `localStorage`.
- [ ] **Étape 6 — Perches, air comprimé, compresseur** (niveau 3).
- [ ] **Étape 7 — Pannes et réparations** (niveau 4), dont les fuites.
