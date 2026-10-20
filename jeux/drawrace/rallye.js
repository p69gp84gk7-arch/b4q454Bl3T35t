/* Draw Race : circuits de rallye (formes librement inspirées des grands rallyes, mais en circuit fermé).
   Mêmes règles que circuits.js (cadre de 1000 × 600, départ au premier point) ; sols : le sol de la piste par morceaux,
   [début (part du tour, de 0 à 1), sol] : asphalte, terre, gravier ou neige. */
window.CIRCUITS_RALLYE = [
  { id:'r-chili', n:"Le Chili", inspi:"Gravier rapide, inspiré du Rallye du Chili", d:2, tours:4, decor:'prairie', sols:[[0, 'gravier']],
    p:[[200,520],[100,420],[130,280],[100,150],[220,80],[400,120],[600,90],[800,100],[910,180],[880,280],[740,300],[740,380],[880,400],[900,500],[760,530],[560,480],[400,530]] },

  { id:'r-suede', n:"La Suède", inspi:"Tout sur la neige, inspiré du Rallye de Suède", d:2, tours:4, decor:'neige', sols:[[0, 'neige']],
    p:[[500,530],[200,520],[110,460],[200,400],[260,320],[180,250],[200,160],[320,110],[520,90],[700,140],[800,90],[900,140],[910,280],[880,400],[820,480],[700,530]] },

  { id:'r-finlande', n:"Les Mille Lacs", inspi:"Gravier très rapide, inspiré du Rallye de Finlande", d:2, tours:4, decor:'lac', sols:[[0, 'gravier']],
    p:[[520,520],[300,525],[150,480],[90,370],[130,250],[230,150],[400,100],[560,130],[680,80],[830,100],[910,200],[900,330],[820,420],[700,440],[640,500]] },

  { id:'r-safari', n:"Le Safari", inspi:"Terre rouge et savane, inspiré du Safari Rally", d:3, tours:3, decor:'savane', sols:[[0, 'terre']],
    p:[[160,520],[90,420],[100,260],[170,140],[320,90],[520,100],[700,80],[880,120],[920,250],[860,310],[700,280],[560,235],[440,310],[560,390],[760,395],[900,440],[880,530],[700,540],[450,530]] },

  { id:'r-portugal', n:"Le Portugal", inspi:"Terre et forêts, inspiré du Rallye du Portugal", d:3, tours:3, decor:'sapins', sols:[[0, 'terre']],
    p:[[480,300],[620,230],[760,120],[880,140],[920,260],[880,400],[760,480],[620,420],[520,470],[380,520],[200,500],[100,400],[120,260],[220,160],[340,120],[420,200]] },

  { id:'r-sardaigne', n:"La Sardaigne", inspi:"Gravier sablonneux au bord de la mer, inspiré du Rallye d'Italie", d:3, tours:3, decor:'mer', sols:[[0, 'gravier']],
    p:[[850,530],[400,530],[200,520],[100,450],[130,360],[240,330],[260,250],[160,200],[150,110],[280,80],[400,150],[520,110],[600,190],[540,270],[620,340],[760,300],[780,200],[880,150],[920,260],[900,400],[920,480]] },

  { id:'r-galles', n:"Le Pays de Galles", inspi:"Boue et gravier en forêt, inspiré du Rallye de Grande-Bretagne", d:3, tours:3, decor:'foret', sols:[[0, 'terre'], [.45, 'gravier'], [.75, 'terre']],
    p:[[150,480],[100,340],[150,200],[260,110],[420,90],[520,170],[480,260],[560,330],[700,290],[740,180],[860,120],[920,230],[890,380],[800,470],[640,520],[460,470],[320,530],[220,540]] },

  { id:'r-japon', n:"Le Japon", inspi:"Goudron étroit dans la forêt, inspiré du Rallye du Japon", d:4, tours:3, decor:'japon', sols:[[0, 'asphalte']],
    p:[[800,520],[500,520],[300,500],[160,520],[90,430],[150,350],[300,330],[380,260],[300,190],[160,170],[130,100],[300,70],[500,90],[640,170],[700,280],[800,240],[860,130],[920,200],[920,350],[860,430],[900,500]] },

  { id:'r-catalogne', n:"La Catalogne", inspi:"Goudron et terre mélangés, inspiré du Rallye d'Espagne", d:4, tours:3, decor:'collines', sols:[[0, 'asphalte'], [.4, 'terre'], [.75, 'asphalte']],
    p:[[880,500],[600,520],[420,500],[300,530],[160,500],[100,400],[180,320],[320,300],[400,220],[310,170],[190,115],[320,60],[460,80],[580,150],[680,90],[820,100],[900,190],[830,270],[720,280],[680,360],[800,400],[900,430]] },

  { id:'r-monte', n:"Monte-Carlo", inspi:"Épingles de montagne, goudron et plaques de neige, inspiré du Rallye Monte-Carlo", d:4, tours:3, decor:'montagne', sols:[[0, 'asphalte'], [.3, 'neige'], [.55, 'asphalte'], [.8, 'neige'], [.9, 'asphalte']],
    p:[[700,520],[300,520],[150,500],[110,430],[170,390],[380,380],[420,330],[380,290],[160,280],[110,220],[150,160],[380,150],[480,100],[700,80],[870,110],[910,200],[850,280],[760,300],[800,380],[900,420],[890,500]] },

  { id:'r-acropole', n:"L'Acropole", inspi:"Pierres et virages lents, inspiré du Rallye de l'Acropole", d:5, tours:2, decor:'collines', sols:[[0, 'gravier']],
    p:[[300,520],[130,500],[90,400],[160,330],[300,350],[380,290],[300,230],[150,210],[120,120],[260,80],[420,110],[520,200],[600,120],[740,80],[880,120],[900,230],[800,280],[680,260],[640,340],[760,380],[900,400],[900,500],[760,530],[560,520],[480,450],[400,520]] },

  { id:'r-corse', n:"La Corse", inspi:"Le rallye aux 10 000 virages, inspiré du Tour de Corse", d:5, tours:2, decor:'collines', sols:[[0, 'asphalte']],
    p:[[600,520],[480,500],[380,530],[260,500],[150,520],[90,440],[140,370],[100,290],[150,210],[110,140],[200,80],[310,120],[400,80],[520,120],[620,80],[740,120],[860,90],[920,170],[860,240],[910,320],[850,400],[900,470],[820,530],[720,500]] },
];
