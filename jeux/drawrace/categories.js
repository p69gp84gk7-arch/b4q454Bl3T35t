/* Draw Race : les catégories Endurance (prototypes) et Tourisme (voitures de tourisme).
   Chacune a 6 circuits à elle (formes librement inspirées, pas des reproductions), plus 6 circuits de Formule choisis.
   Même format que circuits.js : points de passage dans un cadre de 1000 × 600, départ au premier point. */
window.CIRCUITS_ENDURANCE = [
  { id:'sarthe', n:"La Sarthe", inspi:"Inspiré des 24 Heures du Mans", d:3, tours:5, decor:'campagne',
    p:[[110,430],[100,300],[130,180],[200,120],[300,100],[420,95],[460,128],[500,95],[640,90],[680,123],[720,90],[860,85],[905,135],[890,230],[860,330],[880,400],[830,480],[760,505],[650,470],[560,510],[450,480],[350,515],[230,520],[160,495]] },
  { id:'ovale', n:"Le Grand Ovale", inspi:"Inspiré de Daytona (tracé routier)", d:2, tours:5, decor:'prairie',
    p:[[480,525],[700,525],[860,480],[915,330],[860,160],[700,85],[500,75],[300,80],[160,130],[100,250],[160,360],[280,330],[360,215],[470,240],[440,360],[330,430],[230,470],[290,520]] },
  { id:'marais', n:"Les Marais", inspi:"Inspiré de Sebring", d:3, tours:4, decor:'lac',
    p:[[150,480],[120,350],[170,230],[120,120],[260,80],[420,110],[520,200],[640,120],[800,80],[900,150],[870,260],[760,300],[860,400],[880,500],[700,530],[520,470],[380,530],[230,530]] },
  { id:'volcan', n:"Le Volcan", inspi:"Inspiré de Fuji", d:3, tours:4, decor:'montagne',
    p:[[140,520],[600,525],[860,520],[905,440],[820,390],[700,420],[620,360],[700,280],[860,250],[900,150],[800,85],[620,100],[500,160],[380,110],[240,80],[120,140],[110,260],[200,320],[150,420]] },
  { id:'algarve', n:"L'Algarve", inspi:"Inspiré de Portimão", d:4, tours:4, decor:'collines',
    p:[[120,300],[130,150],[250,80],[400,120],[460,230],[560,150],[700,90],[860,110],[900,230],[800,300],[880,400],[820,510],[640,520],[540,420],[420,500],[260,520],[140,450]] },
  { id:'foretverte', n:"La Forêt verte", inspi:"Inspiré du Nürburgring", d:5, tours:4, decor:'sapins',
    p:[[100,330],[110,170],[200,90],[330,110],[380,220],[300,300],[380,390],[500,350],[540,230],[620,120],[760,80],[890,130],[900,260],[800,330],[880,420],[830,520],[680,520],[600,440],[480,520],[320,520],[180,500],[110,440]] },
];
window.CIRCUITS_TOURISME = [
  { id:'guia', n:"Le Port de Guia", inspi:"Inspiré de Macao", d:4, tours:5, decor:'mer',
    p:[[150,520],[500,530],[800,520],[900,450],[880,330],[780,300],[700,220],[760,140],[700,80],[600,120],[540,200],[460,140],[360,90],[250,120],[200,220],[260,300],[170,380],[110,460]] },
  { id:'vieuxbourg', n:"Le Vieux Bourg", inspi:"Circuit en ville, inspiré de Vila Real", d:4, tours:5, decor:'ville',
    p:[[120,480],[120,300],[130,120],[300,100],[320,250],[480,260],[500,110],[700,90],[880,110],[890,290],[740,310],[720,410],[880,430],[880,525],[600,530],[400,520],[250,530]] },
  { id:'collines', n:"Les Collines", inspi:"Inspiré de Brands Hatch", d:3, tours:5, decor:'campagne',
    p:[[200,500],[120,400],[150,250],[100,130],[220,80],[380,110],[440,220],[560,260],[700,170],[860,120],[900,250],[800,330],[860,450],[760,520],[560,480],[400,530]] },
  { id:'plateau', n:"Le Plateau", inspi:"Très rapide, inspiré de Thruxton", d:2, tours:6, decor:'prairie',
    p:[[130,350],[160,170],[320,90],[560,80],[780,110],[890,220],[880,380],[800,500],[620,530],[460,500],[420,440],[360,500],[220,500]] },
  { id:'puszta', n:"La Puszta", inspi:"Inspiré du Hungaroring", d:4, tours:5, decor:'collines',
    p:[[110,300],[130,130],[300,80],[480,120],[420,240],[540,300],[660,200],[640,90],[820,80],[900,200],[820,300],[880,420],[780,520],[600,470],[480,530],[330,500],[300,380],[180,420]] },
  { id:'boulevard', n:"Le Boulevard", inspi:"Circuit en ville, inspiré de Pau", d:5, tours:5, decor:'fleuve',
    p:[[150,470],[140,300],[200,140],[340,80],[480,130],[520,260],[640,300],[760,200],[700,90],[860,80],[900,230],[860,380],[700,420],[620,520],[440,500],[300,530]] },
];
// Les circuits de Formule repris dans chaque catégorie
window.SELECTION_ENDURANCE = ['ardennes', 'aerodrome', 'texas', 'desert', 'catalogne', 'alpes'];
window.SELECTION_TOURISME = ['anneau', 'parc', 'riviere', 'citadelle', 'principaute', 'huit'];
