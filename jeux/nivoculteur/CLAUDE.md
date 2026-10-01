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

- `index.html` contient le HTML et le CSS ; le JavaScript est découpé en fichiers dans `js/`, chargés dans l'ordre par des balises `<script>` classiques. Pas de npm, pas de Vite, pas de TypeScript, **pas de modules ES (`import`)** : le jeu doit s'ouvrir en double-cliquant sur `index.html` (`file://`), en gardant le dossier entier.
- Les fichiers partagent les mêmes noms globaux (`const` de premier niveau). **Aucun fichier ne doit utiliser Three.js au moment de son chargement** (seulement dans des fonctions), pour que le message d'erreur et le mode test marchent sans Three.js.
- **Three.js 0.149.0** en script classique : d'abord la copie locale `three.min.js` (jeu hors ligne), sinon le CDN jsdelivr.
- Graphismes **low-poly** (ombrage plat), toutes les formes créées par le code : pas de modèle 3D ni d'image externe (les textures éventuelles sont dessinées par le code dans un canvas).
- Commandes souris et tactiles : glisser = tourner ; pincer / molette = zoom ; deux doigts / clic droit = déplacer ; toucher court = action.
- Page adaptée au téléphone (portrait et paysage) et à l'ordinateur.
- Performances : réutiliser géométries et matériaux, objets répétés en `InstancedMesh`, peu de particules.
- Sauvegarde dans `localStorage`, toujours dans un `try/catch` (à partir de l'étape 5 ; clés préfixées `nivo-`).
- **Toute l'interface est en français.**
- Unité : **1 unité 3D = 1 mètre**. Axe x de gauche à droite, axe z du haut de la pente (négatif) vers le bas (positif), y = altitude − altitude du bas.

### Fichiers (chargés dans cet ordre)

| Fichier | Contenu |
|---|---|
| `js/config.js` | `CONFIG` (tous les chiffres réglables), `CATALOGUE` (enneigeurs), `SUPPORTS` (trépied, tour, tour haute) |
| `js/niveaux.js` | terrain, piste, retenue, salle de pompage, départs électriques, télésiège, `LEVELS` |
| `js/simulation.js` | logique pure, sans Three.js, et `testsSimulation()` |
| `js/modeles.js` | toutes les formes 3D |
| `js/effets.js` | ciel, étoiles, lune, lumières, jets de neige et brouillard |
| `js/interface.js` | messages, barre du bas, devis, fiches, panneaux |
| `js/jeu.js` | rendu, caméra et commandes, le terrain de jeu (construction, fiches, nuits) |
| `js/vitrine.js` | la vitrine des modèles (`?modeles`) |
| `js/demarrage.js` | choisit le mode (jeu, vitrine, test) — toujours en dernier |

Tester la simulation sans navigateur : concaténer `config.js`, `niveaux.js` et `simulation.js` puis appeler `testsSimulation()` avec Node.

### Sections (les numéros restent dans les en-têtes des fichiers)

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
- `index.html?modeles` : vitrine des modèles 3D (bouton « Modèles 3D » en haut du terrain). Chaque modèle tourne seul ; les boutons jaunes testent ses mouvements : ventilateurs (modèle V8/V9/V10, support, état, direction, inclinaison, trappe), perches (6 m, 10 m, 10 m nouvelle génération), regard, salle de pompage (pompes, alarme ; murs transparents), armoire.

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

Tranchée eau seule 750 €/m · câble seul 550 €/m · commune eau + câble 900 €/m · regard 5 000 € + enneigeur (catalogue) · reprise d'un enneigeur remplacé : 50 % · gain 20 € par m³ de neige tombée sur la piste.

## Catalogue (validé par l'utilisateur, noms inventés inspirés des gammes du marché)

| Enneigeur | Prix | Eau | Pression mini / pleine | Neige à pleine production | Disponible |
|---|---|---|---|---|---|
| Ventilateur V8 | 10 000 € | 6 l/s | 8 / 20 bar | 10 m³/s de jeu (400 m³/nuit) | dès le départ |
| Ventilateur V9 | 18 000 € | 10 l/s | 8 / 22 bar | 16,25 (650/nuit) | après 5 000 m³ sur les pistes |
| Ventilateur V10 | 28 000 € | 15 l/s | 8 / 24 bar | 23,75 (950/nuit) | après 15 000 m³ |
| Perche 6 m | 5 000 € | 3 l/s | 18 / 28 bar | 4,5 (180/nuit) | niveau 3 (air comprimé) |
| Perche 10 m | 7 000 € | 3,5 l/s | 18 / 28 bar | 5,5 (220/nuit) | niveau 3 |
| Perche 10 m nouvelle génération | 10 000 € | 3,5 l/s | 14 / 22 bar, moins d'air | 5,5 | niveau 3, après 10 000 m³ |

Supports des ventilateurs : trépied au sol (posé à côté du regard, relié par un flexible), tour (+4 000 €), tour haute +3 m (+7 000 €). Plus haut = plus de portée, mais plus de dérive au vent.

## Production, vent, nuits (étape 4)

- Production : 35 % à la pression minimale, 100 % à la pression pleine ; surpression > 55 bar = canon en sécurité.
- Pression pendant la nuit : formule du cahier des charges avec le débit total des canons ouverts (l/s × 3,6 = m³/h). Tant qu'un canon manque de pression, on ferme le plus défavorisé et on recalcule (`regimeNuit`).
- Vent tiré au sort par nuit (0 à 35 km/h, direction), annoncé la veille (flèche dans la barre, manche à air près de la salle). Point de chute = direction × portée (modèle, support, inclinaison) + dérive du vent (hauteur du jet / vitesse de chute × vent × 0,5). Seule la part de la zone enneigée qui tombe sur la piste compte et rapporte.
- Une nuit = 40 s de jeu = 12 h (1 s de jeu = 1 080 s réelles) ; la retenue (11 260 m³ pleine) se vide au débit réel et regagne 3 000 m³ par jour ; vide = pompes à sec, tout s'arrête (alarme).
- Les tas de neige restent d'une nuit à l'autre. À la fin de la nuit : bilan, argent ajouté au budget, nouveaux enneigeurs débloqués. On ne peut plus annuler ce qui a été construit avant une nuit.
- Objectif du niveau 2 : 30 000 m³ sur la piste.

## Plan et avancement

- [x] **Étape 0 — Base du projet** : page avec Three.js, sections en place, nuit (ciel, étoiles, lune), terrain low-poly avec piste damée, jalons, sapins, rochers, montagnes au loin, caméra orbite (tourner, zoomer, déplacer), toucher = altitude + sur/hors piste, barre du bas, messages colorés, mode `?test` (18 vérifications).
- [x] Retouches de l'étape 0 : zone non jouable habillée (montagnes posées sur le terrain, plus de vide), télésiège fixe, emplacement de la retenue.
- [x] **Étape 1 — Modèles 3D** : canon ventilateur (tube creux, hélice arrière derrière sa grille, moteur, couronne de 12 buses et nucléateurs, fourche orientable, voyant gris/vert/orange/rouge) sur son pied ; regard triangulaire enterré (trappe qui s'ouvre, conduite, vanne à volant, coffret électrique) ; salle de pompage (3 pompes multicellulaires, moteurs bleus à ailettes et ventilateur qui tourne, brides boulonnées, vannes à volant rouge, voyants, manomètres à aiguille, collecteurs d'aspiration et de refoulement, vanne principale, armoires, pupitre avec écran, gyrophares, toit amovible) ; armoire « Départ élec » avec étiquette. Vitrine `?modeles`. Sur le terrain : salle de pompage, retenue, départs électriques, télésiège.
- [x] Retouches : murs et toit de la salle de pompage transparents quand ils cachent l'intérieur ; regards rectangulaires ; départs électriques près des bâtiments.
- [x] **Étape 3 — Construction** (faite avant l'étape 2, à la demande) : outils + Regard, Eau, Électricité ; devis (longueur, prix au mètre, tranchée commune, pression prévue, ce qui manque, budget après) ; Valider / Annuler ; icônes goutte/éclair ; vue sous-sol ; Annuler (remboursé) ; Tout effacer. 39 vérifications en mode test.
- [x] **Étape 4 — Production, vent et catalogue** (+ découpage en fichiers) : bouton « Lancer la nuit », jets de neige et brouillard, tas, bilan, accélérer ×3 ; vent et manche à air ; fiche d'un canon (état, pression, % sur la piste, direction, inclinaison, remplacement avec reprise, anneau du point de chute) ; choix de l'enneigeur à la pose ; ventilateurs V8/V9/V10 sur trépied/tour/tour haute ; perches 6 m / 10 m / 10 m NG (vitrine ; jouables au niveau 3) ; retenue qui se vide. 55 vérifications.
- [ ] **Poste de travail** (prochaine étape, validée) : toucher l'écran du pupitre de la salle des machines, ou un bouton « Poste de travail », ouvre un écran de contrôle (pompes, vanne principale, pression, liste des canons avec état, pression et marche/arrêt).
- [ ] **Étape 2 — Niveau 1** : salle de pompage jouable (3 pompes, vanne principale, pression, retenue, coup de bélier).
- [ ] **Étape 5 — Menus et niveaux** : menu, choix du niveau, sauvegarde `localStorage`.
- [ ] **Étape 6 — Perches, air comprimé, compresseur** (niveau 3).
- [ ] **Étape 7 — Pannes et réparations** (niveau 4), dont les fuites.

### Idées à garder en tête

- Météo plus complète (température humide, redoux) qui module la production.
- Tranchées avec points intermédiaires (détours) si l'utilisateur le demande.
