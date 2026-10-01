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
3. `SIMULATION` : logique pure, **jamais de Three.js** (pression, coûts, terrain, pistes, réseau construit, et plus tard neige, pannes). Contient `testsSimulation()`.
   Réseau : `creerReseau`, `poserRegard`, `devisTranchee`, `ajouterTranchee`, `annulerAction` (par « lot » = une action du joueur), `alimentes(res, 'eau'|'cable')`, `longueursEau`, `etatRegard` (eau, électricité, pression prévue, ce qui manque), `directionVersPiste`.
4. `MODELES 3D` : terrain (petites facettes sur le domaine, grandes facettes pour les montagnes), sapins, rochers, jalons, retenue, canon, regard, armoire électrique, salle de pompage, télésiège (puis compresseur, perche).
   Les pièces fixes d'un objet sont posées dans un `Atelier` puis fusionnées en une seule forme ; les pièces qui bougent (hélice, trappe, aiguilles, ventilateurs, voyants, gyrophares) restent à part.
   Chaque modèle a ses fonctions : `orienterCanon`, `etatCanon`, `animerCanon` ; `ouvrirRegard`, `animerRegard` ; `etatSallePompage`, `animerSallePompage`, `voirAtravers` (murs et toit transparents quand ils cachent l'intérieur) ; `remplir(f)` pour la retenue ; `creerTranchee3D` (trace en surface + conduite bleue / câble jaune enterrés), `creerIconeEtat` / `textureIcone` (goutte et éclair au-dessus d'un regard).
5. `EFFETS` : ciel, étoiles, lune, lumières (puis particules de neige, brouillard, tas).
6. `INTERFACE` : messages, barre du bas, panneaux.
7. `JEU` : scène, boucle, caméra, commandes.

### Modes spéciaux

- `index.html?test` : lance `testsSimulation()` et affiche OK / ERREUR à l'écran (et dans la console).
- `index.html?modeles` : vitrine des modèles 3D (bouton « Modèles 3D » en haut du terrain). Chaque modèle tourne seul ; les boutons jaunes testent ses mouvements (état du canon, direction, inclinaison, trappe du regard, toit et pompes de la salle, alarme).

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
- Hors du domaine (zone non jouable), le terrain continue et monte en montagnes jusqu'à 1,6 km (décor), plus bas vers la vallée. La caméra monte d'elle-même si une montagne la gêne. Toucher hors du domaine affiche « en dehors du domaine skiable ».
- Replats (`terrain.replats`) : terrain aplani pour la salle de pompage, les gares du télésiège et la retenue, raccordé par un talus enneigé.
- Retenue des Clarines : à côté de la salle de pompage (x −112, z 146), lac de 32 m de rayon et 7 m de profondeur, digue, bâche sombre, clôture ; `eauRetenue()` donne la hauteur et la taille du lac selon le remplissage (le lac rétrécit en se vidant).
- Télésiège des Clarines : fixe la nuit (décor), 446 m, 8 pylônes, sièges 4 places enneigés, à droite de la piste.
- Regards **rectangulaires** (2,0 × 1,5 m, 1,9 m de profondeur), trappe à droite, pied du canon à gauche (`PIED_REGARD`).
- Départs électriques près des bâtiments : salle de pompage, gare aval et gare amont du télésiège (`DEPARTS_COMBE`).
- Pompes à **52 bar** (et non 60) : environ 51 bar en bas de la piste, 33 bar tout en haut ; à 60 bar, les regards bas étaient en surpression.
- Budget du niveau 2 : **650 000 €** (à 750–900 €/m de tranchée, 150 000 € ne permettaient que 2 regards).
- Outil de construction : tranchées en **ligne droite** entre deux points ; on ne peut pas traverser la retenue. Après une validation, le départ devient le regard raccordé (on enchaîne le long de la piste). Toucher un endroit libre comme arrivée pose un nouveau regard au bout. Les canons sont orientés vers la piste la plus proche.
- Salle de pompage : 14 m × 9 m ; la retenue est derrière (aspiration le long du mur arrière), le départ vers les pistes sort à droite après la vanne principale. Manomètres gradués de 0 à 80 bar avec les zones de couleur.

## Coûts et gains de départ (dans `CONFIG`)

Tranchée eau seule 750 €/m · câble seul 550 €/m · commune eau + câble 900 €/m · regard + canon 8 000 € · gain 20 € par m³ de neige tombée sur la piste.

## Plan et avancement

- [x] **Étape 0 — Base du projet** : page avec Three.js, sections en place, nuit (ciel, étoiles, lune), terrain low-poly avec piste damée, jalons, sapins, rochers, montagnes au loin, caméra orbite (tourner, zoomer, déplacer), toucher = altitude + sur/hors piste, barre du bas, messages colorés, mode `?test` (18 vérifications).
- [x] Retouches de l'étape 0 : zone non jouable habillée (montagnes posées sur le terrain, plus de vide), télésiège fixe, emplacement de la retenue.
- [x] **Étape 1 — Modèles 3D** : canon ventilateur (tube creux, hélice arrière derrière sa grille, moteur, couronne de 12 buses et nucléateurs, fourche orientable, voyant gris/vert/orange/rouge) sur son pied ; regard triangulaire enterré (trappe qui s'ouvre, conduite, vanne à volant, coffret électrique) ; salle de pompage (3 pompes multicellulaires, moteurs bleus à ailettes et ventilateur qui tourne, brides boulonnées, vannes à volant rouge, voyants, manomètres à aiguille, collecteurs d'aspiration et de refoulement, vanne principale, armoires, pupitre avec écran, gyrophares, toit amovible) ; armoire « Départ élec » avec étiquette. Vitrine `?modeles`. Sur le terrain : salle de pompage, retenue, départs électriques, télésiège.
- [x] Retouches : murs et toit de la salle de pompage transparents quand ils cachent l'intérieur ; regards rectangulaires ; départs électriques près des bâtiments.
- [x] **Étape 3 — Construction** (faite avant l'étape 2, à la demande) : outils + Regard, Eau, Électricité ; devis (longueur, prix au mètre, tranchée commune, pression prévue, ce qui manque, budget après) ; Valider / Annuler ; icônes goutte/éclair ; vue sous-sol ; Annuler (remboursé) ; Tout effacer. 39 vérifications en mode test.
- [ ] **Étape 2 — Niveau 1** : salle de pompage jouable (3 pompes, vanne principale, pression, retenue, coup de bélier).
- [ ] **Étape 4 — Production et argent** : nuits, particules, tas de neige, gains, objectif du niveau 2.
- [ ] **Étape 5 — Menus et niveaux** : menu, choix du niveau, sauvegarde `localStorage`.
- [ ] **Étape 6 — Perches, air comprimé, compresseur** (niveau 3).
- [ ] **Étape 7 — Pannes et réparations** (niveau 4), dont les fuites.

### Idées de l'utilisateur à planifier (à valider avec lui)

- **Catalogue d'enneigeurs** débloqués au fil des objectifs : plus le canon est gros, plus il est cher et plus il a de débit ; modèles de **perches** inspirés de ce que font les constructeurs (noms inventés, pas de marques).
- **Interface PC de supervision** pour piloter la salle des machines et le réseau de canons.
- **Vent** (direction, force) : rend utiles l'orientation et l'inclinaison des canons.
