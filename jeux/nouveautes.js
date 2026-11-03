/* Altitude Arcade : les nouveautés, montrées une fois à l'ouverture de l'accueil (fenêtre « Quoi de neuf ? »).
   À chaque nouveau jeu ou mise à jour d'un jeu, ajouter une ligne EN HAUT de la liste, avec le numéro de version
   donné par outils/version.sh (v) : la fenêtre montre ce qui est plus récent que la dernière version vue sur l'appareil.
   type : 'nouveau' (nouveau jeu) ou 'maj' (mise à jour) ; lien : la page du jeu ; ico : un emoji. */
window.ALTITUDE_NOUVEAUTES = [
  { v:136, type:'maj', jeu:'Rock Altitude', ico:'🎸', lien:'jeux/rock.html',
    txt:'De vrais instruments ! Les morceaux sont joués avec des guitares, une basse, une batterie, un piano, un orgue et un violon enregistrés.' },
  { v:135, type:'maj', jeu:'Rock Altitude', ico:'🎸', lien:'jeux/rock.html',
    txt:'Les morceaux changent de nom : Nuit d\'été, Blues de minuit, La gigue du samedi soir, Funky groove, Premier riff, Moteur en feu, Plein gaz et Orage d\'acier.' },
  { v:134, type:'nouveau', jeu:'Rock Altitude', ico:'🎸', lien:'jeux/rock.html',
    txt:'Nouveau jeu dans l\'esprit des jeux de guitare : les notes arrivent sur un manche en 3D, joue-les au bon moment sur 3 ou 4 boutons. 8 morceaux composés pour le jeu, ou tes propres MP3. Notes longues, accords, multiplicateur, mode Star et un public à garder avec toi !' },
  { v:132, type:'maj', jeu:'Dameuse de nuit', ico:'🚜', lien:'jeux/dameuse.html',
    txt:'La dameuse passe en 3D ! La piste en relief, les phares dans la nuit, la lame et la fraise qui bougent. Les commandes ne changent pas, et des boutons en bas permettent de tourner, lever et baisser la caméra. Le bouton 2D / 3D ramène la vue du dessus.' },
  { v:129, type:'maj', jeu:'Chef de quai', ico:'🚡', lien:'jeux/telesiege.html',
    txt:'La couleur des skis donne le niveau du skieur : vert débutant (lent jusqu\'à la ligne), bleu, rouge, noir confirmé (rapide).' },
  { v:128, type:'maj', jeu:'Nuancier', ico:'🎨', lien:'jeux/nuancier.html',
    txt:'119 images : 29 nouveaux personnages (Kirby, Pac-Man, Spider-Man, Hello Kitty, Stitch, Doraemon…) et 36 nouveaux logos (Red Bull, Ferrari, Shell, PlayStation, Microsoft, eBay…).' },
  { v:126, type:'nouveau', jeu:'Nuancier', ico:'🎨', lien:'jeux/nuancier.html',
    txt:'Nouveau jeu : la couleur a disparu d\'une partie de l\'image (la casquette de Mario, le rouge de Coca-Cola…). Retrouve-la de mémoire avec le spectre et la luminosité.' },
  { v:125, type:'maj', jeu:'Le Grand Quiz', ico:'❓', lien:'jeux/quiz.html',
    txt:'L\'échelle continue après une erreur, et le petit bac propose des idées de mots une fois les résultats donnés.' },
  { v:125, type:'maj', jeu:'Blocs', ico:'🧱', lien:'jeux/blocs.html',
    txt:'8 nouveaux thèmes : moderne, néon, pastel, bonbons, espace, glace, bois et pierre.' },
  { v:125, type:'maj', jeu:'Paddock', ico:'🏎️', lien:'jeux/paddock.html',
    txt:'Au QG, un schéma de la voiture vue de dessus : touche une pièce pour la régler ou l\'améliorer.' },
  { v:124, type:'maj', jeu:'Fusée Rythme', ico:'🚀', lien:'jeux/fusee.html',
    txt:'11 nouveaux morceaux : rock, punk, métal, disco, funk et pop.' },
];
