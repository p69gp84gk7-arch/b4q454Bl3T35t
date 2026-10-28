/* Nuancier : les illustrations. Elles sont dessinées pour le jeu et rappellent des personnages, des logos et des objets très connus,
   sans les reproduire (noms inventés). Chaque image est un SVG de 200 × 200 ; une zone à trouver s'écrit « $nom » à la place
   d'une couleur, et sa vraie couleur (approchée) est dans « zones ». */
window.NUANCIER_IMAGES = (() => {
  const T = '#1E1E1E';                       // le trait
  const g = (inner, sw = 3) => `<g stroke="${T}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;
  const fond = c => `<rect width="200" height="200" fill="${c}"/>`;
  const yeux = (x1, x2, y, r = 5) => `<ellipse cx="${x1}" cy="${y}" rx="${r}" ry="${r * 1.4}" fill="#fff"/><ellipse cx="${x2}" cy="${y}" rx="${r}" ry="${r * 1.4}" fill="#fff"/><circle cx="${x1 + 1}" cy="${y + 1}" r="${r * .5}" fill="${T}" stroke="none"/><circle cx="${x2 + 1}" cy="${y + 1}" r="${r * .5}" fill="${T}" stroke="none"/>`;
  // le plombier et son frère : la même silhouette, d'autres couleurs
  const plombier = (cas, sal, grand) => fond('#DDF1FF') + g(`
    <path d="M58 200 L62 150 Q100 132 138 150 L142 200 Z" fill="${cas}"/>
    <path d="M66 200 L70 156 L84 156 L88 176 L112 176 L116 156 L130 156 L134 200 Z" fill="${sal}"/>
    <circle cx="80" cy="166" r="4" fill="#FBD000"/><circle cx="120" cy="166" r="4" fill="#FBD000"/>
    <ellipse cx="100" cy="${grand ? 100 : 104}" rx="38" ry="${grand ? 44 : 40}" fill="#F9C9A0"/>
    <path d="M58 ${grand ? 78 : 84} Q60 ${grand ? 36 : 44} 100 ${grand ? 36 : 44} Q140 ${grand ? 36 : 44} 142 ${grand ? 78 : 84} Q100 ${grand ? 70 : 76} 58 ${grand ? 78 : 84} Z" fill="${cas}"/>
    <path d="M100 ${grand ? 78 : 84} Q132 ${grand ? 72 : 78} 156 ${grand ? 86 : 92} Q130 ${grand ? 92 : 98} 100 ${grand ? 88 : 94} Z" fill="${cas}"/>
    <circle cx="100" cy="${grand ? 56 : 62}" r="11" fill="#fff"/>
    ${yeux(88, 112, grand ? 98 : 102, 6)}
    <ellipse cx="100" cy="${grand ? 116 : 118}" rx="12" ry="10" fill="#F4B07E"/>
    <path d="M76 ${grand ? 128 : 130} Q88 ${grand ? 120 : 122} 100 ${grand ? 126 : 128} Q112 ${grand ? 120 : 122} 124 ${grand ? 128 : 130} Q112 ${grand ? 138 : 140} 100 ${grand ? 132 : 134} Q88 ${grand ? 138 : 140} 76 ${grand ? 128 : 130} Z" fill="#3B2314"/>`);
  const L = [
    /* ---------- Les personnages ---------- */
    { id:'plombier', n:'Le plombier moustachu', cat:'perso', zones:{ casquette:['Sa casquette', '#E52521'], salopette:['Sa salopette', '#2B4FB8'] },
      svg:plombier('$casquette', '$salopette') },
    { id:'frere', n:'Le grand frère du plombier', cat:'perso', zones:{ casquette:['Sa casquette', '#3BA935'] },
      svg:plombier('$casquette', '#23339B', true) },
    { id:'souris-elec', n:'La souris électrique', cat:'perso', zones:{ corps:['Son pelage', '#F8D030'], joues:['Ses joues', '#E94B3C'] },
      svg:fond('#E8F5E0') + g(`
        <path d="M58 70 L30 8 L80 50 Z" fill="$corps"/><path d="M42 30 L30 8 L50 26 Z" fill="${T}"/>
        <path d="M142 70 L170 8 L120 50 Z" fill="$corps"/><path d="M158 30 L170 8 L150 26 Z" fill="${T}"/>
        <path d="M150 150 L186 120 L170 104 L190 84 L160 92 L176 110 L140 136 Z" fill="$corps"/>
        <ellipse cx="100" cy="150" rx="52" ry="46" fill="$corps"/>
        <ellipse cx="100" cy="88" rx="56" ry="46" fill="$corps"/>
        <circle cx="78" cy="80" r="8" fill="${T}"/><circle cx="122" cy="80" r="8" fill="${T}"/><circle cx="80" cy="77" r="3" fill="#fff" stroke="none"/><circle cx="124" cy="77" r="3" fill="#fff" stroke="none"/>
        <circle cx="62" cy="104" r="12" fill="$joues"/><circle cx="138" cy="104" r="12" fill="$joues"/>
        <path d="M92 104 Q100 112 108 104" fill="none"/><path d="M98 94 L102 94" />
        <path d="M70 150 Q80 140 88 150" fill="none"/><path d="M112 150 Q120 140 130 150" fill="none"/>`) },
    { id:'herisson', n:'Le hérisson supersonique', cat:'perso', zones:{ corps:['Son corps', '#1D4FC5'], chaussures:['Ses chaussures', '#E2262C'] },
      svg:fond('#BFE6FF') + g(`
        <path d="M60 84 L4 60 L50 104 L0 120 L56 128 L22 160 L80 136 Z" fill="$corps"/>
        <ellipse cx="100" cy="146" rx="30" ry="34" fill="$corps"/><ellipse cx="100" cy="152" rx="18" ry="22" fill="#F3C99A"/>
        <circle cx="100" cy="86" r="46" fill="$corps"/>
        <path d="M86 70 Q106 60 130 72 L132 106 Q110 124 86 108 Z" fill="#F3C99A"/>
        <ellipse cx="102" cy="82" rx="10" ry="14" fill="#fff"/><ellipse cx="122" cy="82" rx="9" ry="14" fill="#fff"/>
        <ellipse cx="106" cy="84" rx="4" ry="7" fill="#2BB24C"/><ellipse cx="124" cy="84" rx="4" ry="7" fill="#2BB24C"/>
        <ellipse cx="136" cy="96" rx="5" ry="4" fill="${T}"/><path d="M104 108 Q118 116 130 106" fill="none"/>
        <path d="M60 182 Q60 168 84 168 L96 176 Q96 192 76 192 L60 192 Z" fill="$chaussures"/><rect x="74" y="170" width="6" height="22" fill="#fff"/>
        <path d="M104 182 Q104 168 128 168 L142 176 Q142 192 122 192 L104 192 Z" fill="$chaussures"/><rect x="118" y="170" width="6" height="22" fill="#fff"/>`) },
    { id:'eponge', n:'L\'éponge carrée de la mer', cat:'perso', zones:{ eponge:['L\'éponge', '#FFF35C'], short:['Son short', '#9C6A3A'] },
      svg:fond('#7FD3F0') + g(`
        <path d="M44 20 Q100 12 156 20 L160 130 L40 130 Z" fill="$eponge"/>
        <ellipse cx="60" cy="40" rx="6" ry="4" fill="#C9C33A" stroke="none"/><ellipse cx="142" cy="46" rx="7" ry="5" fill="#C9C33A" stroke="none"/><ellipse cx="56" cy="110" rx="6" ry="5" fill="#C9C33A" stroke="none"/><ellipse cx="146" cy="116" rx="5" ry="4" fill="#C9C33A" stroke="none"/>
        <circle cx="80" cy="62" r="16" fill="#fff"/><circle cx="120" cy="62" r="16" fill="#fff"/><circle cx="82" cy="62" r="7" fill="#5AA9E6"/><circle cx="118" cy="62" r="7" fill="#5AA9E6"/><circle cx="82" cy="62" r="3" fill="${T}" stroke="none"/><circle cx="118" cy="62" r="3" fill="${T}" stroke="none"/>
        <path d="M66 92 Q100 120 134 92" fill="#fff"/><path d="M90 98 L90 108 L98 108 L98 100 M102 100 L102 108 L110 108 L110 98" fill="#fff"/>
        <rect x="40" y="130" width="120" height="16" fill="#fff"/><path d="M96 130 L104 130 L106 150 L100 158 L94 150 Z" fill="#D01C1C"/>
        <rect x="40" y="146" width="120" height="26" fill="$short"/><path d="M48 158 L70 158 M84 158 L116 158 M130 158 L152 158" stroke-dasharray="6 6"/>
        <rect x="62" y="172" width="12" height="20" fill="$eponge"/><rect x="126" y="172" width="12" height="20" fill="$eponge"/>`) },
    { id:'lutins', n:'Le petit lutin bleu de la forêt', cat:'perso', zones:{ peau:['Sa peau', '#4AA4DE'] },
      svg:fond('#D9F2C6') + g(`
        <path d="M54 92 Q50 30 110 22 Q150 24 158 60 Q172 66 170 84 Q150 76 146 92 Z" fill="#fff"/>
        <ellipse cx="100" cy="112" rx="46" ry="40" fill="$peau"/>
        <ellipse cx="50" cy="114" rx="10" ry="14" fill="$peau"/><ellipse cx="150" cy="114" rx="10" ry="14" fill="$peau"/>
        ${yeux(86, 114, 104, 8)}<ellipse cx="100" cy="124" rx="12" ry="10" fill="$peau"/>
        <path d="M84 138 Q100 150 116 138" fill="none"/>
        <path d="M64 200 L70 160 Q100 150 130 160 L136 200 Z" fill="#fff"/>`) },
    { id:'chat', n:'Le gros chat orange qui aime les lasagnes', cat:'perso', zones:{ pelage:['Son pelage', '#F59222'] },
      svg:fond('#F3E6FF') + g(`
        <path d="M44 70 L50 26 L82 54 Z" fill="$pelage"/><path d="M156 70 L150 26 L118 54 Z" fill="$pelage"/>
        <ellipse cx="100" cy="164" rx="64" ry="44" fill="$pelage"/>
        <ellipse cx="100" cy="90" rx="62" ry="50" fill="$pelage"/>
        <path d="M84 44 L88 58 M100 40 L100 56 M116 44 L112 58" />
        <ellipse cx="82" cy="84" rx="16" ry="18" fill="#fff"/><ellipse cx="118" cy="84" rx="16" ry="18" fill="#fff"/>
        <path d="M66 82 Q82 72 98 82" fill="$pelage"/><path d="M102 82 Q118 72 134 82" fill="$pelage"/>
        <circle cx="86" cy="90" r="4" fill="${T}" stroke="none"/><circle cx="114" cy="90" r="4" fill="${T}" stroke="none"/>
        <ellipse cx="86" cy="116" rx="18" ry="12" fill="#FCE3A8"/><ellipse cx="114" cy="116" rx="18" ry="12" fill="#FCE3A8"/><ellipse cx="100" cy="106" rx="7" ry="5" fill="#F06EA9"/>
        <path d="M150 160 L172 156 M150 176 L174 178 M46 160 L26 156 M48 176 L24 180"/>`) },
    { id:'princesse', n:'La princesse du royaume des champignons', cat:'perso', zones:{ robe:['Sa robe', '#F5A3C7'], cheveux:['Ses cheveux', '#FDE35A'] },
      svg:fond('#FFF6E0') + g(`
        <path d="M100 96 Q52 110 34 200 L166 200 Q148 110 100 96 Z" fill="$robe"/>
        <path d="M60 170 Q100 182 140 170" fill="none"/>
        <path d="M58 80 Q50 130 70 150 L76 88 Z M142 80 Q150 130 130 150 L124 88 Z" fill="$cheveux"/>
        <ellipse cx="100" cy="76" rx="34" ry="36" fill="#FCDCC2"/>
        <path d="M64 70 Q70 30 100 30 Q130 30 136 70 Q118 52 100 56 Q82 52 64 70 Z" fill="$cheveux"/>
        <path d="M80 34 L84 14 L92 28 L100 10 L108 28 L116 14 L120 34 Z" fill="#F6C343"/><circle cx="100" cy="26" r="4" fill="#E9425B"/>
        ${yeux(88, 112, 78, 6)}<path d="M92 100 Q100 106 108 100" fill="none"/>
        <circle cx="100" cy="122" r="7" fill="#5AB3E6"/>`) },
    { id:'dino', n:'Le petit dinosaure vert qui avale tout', cat:'perso', zones:{ corps:['Son corps', '#6ABF44'], chaussures:['Ses chaussures', '#F28A1F'] },
      svg:fond('#FFF3C4') + g(`
        <ellipse cx="96" cy="140" rx="40" ry="38" fill="$corps"/><ellipse cx="94" cy="146" rx="24" ry="26" fill="#fff"/>
        <path d="M120 116 Q150 110 146 140 Q140 132 128 132 Z" fill="#E2251E"/>
        <path d="M60 110 Q40 76 70 50 Q90 30 120 40 Q170 40 172 76 Q172 100 140 100 Q110 100 100 116 Z" fill="$corps"/>
        <ellipse cx="146" cy="74" rx="22" ry="18" fill="#fff"/><circle cx="160" cy="70" r="3" fill="${T}" stroke="none"/>
        <ellipse cx="98" cy="40" rx="12" ry="18" fill="#fff"/><ellipse cx="118" cy="40" rx="11" ry="17" fill="#fff"/><circle cx="102" cy="44" r="5" fill="${T}" stroke="none"/><circle cx="120" cy="44" r="5" fill="${T}" stroke="none"/>
        <path d="M70 52 L60 40 L74 42 L70 30 L82 38" fill="#E2251E"/>
        <path d="M58 188 Q56 170 78 170 L92 178 Q92 194 72 194 Z" fill="$chaussures"/><path d="M104 188 Q102 170 124 170 L138 178 Q138 194 118 194 Z" fill="$chaussures"/>`) },
    { id:'souris-oreilles', n:'La souris aux grandes oreilles rondes', cat:'perso', zones:{ short:['Son short', '#E21F26'], chaussures:['Ses chaussures', '#FDC82F'] },
      svg:fond('#E9F7F2') + g(`
        <circle cx="52" cy="40" r="28" fill="${T}"/><circle cx="148" cy="40" r="28" fill="${T}"/>
        <circle cx="100" cy="76" r="40" fill="${T}"/><path d="M72 76 Q72 112 100 116 Q128 112 128 76 Q118 64 100 72 Q82 64 72 76 Z" fill="#F5C8A0"/>
        ${yeux(90, 110, 78, 5)}<ellipse cx="100" cy="94" rx="8" ry="6" fill="${T}"/><path d="M86 104 Q100 112 114 104" fill="none"/>
        <ellipse cx="100" cy="136" rx="22" ry="18" fill="${T}"/>
        <path d="M70 140 L130 140 L136 170 L106 170 L100 160 L94 170 L64 170 Z" fill="$short"/>
        <ellipse cx="88" cy="150" rx="4" ry="6" fill="#fff"/><ellipse cx="112" cy="150" rx="4" ry="6" fill="#fff"/>
        <ellipse cx="72" cy="186" rx="24" ry="12" fill="$chaussures"/><ellipse cx="128" cy="186" rx="24" ry="12" fill="$chaussures"/>`) },
    { id:'papa-jaune', n:'Le papa jaune de la série animée', cat:'perso', zones:{ peau:['Sa peau', '#FED90F'] },
      svg:fond('#BFE3FF') + g(`
        <path d="M50 200 L56 156 Q100 140 144 156 L150 200 Z" fill="#fff"/>
        <path d="M70 60 Q70 20 104 20 Q138 20 138 60 L138 130 L70 130 Z" fill="$peau"/>
        <path d="M86 26 Q96 12 100 26 M104 24 Q112 10 118 24" fill="none"/>
        <circle cx="94" cy="66" r="14" fill="#fff"/><circle cx="122" cy="66" r="14" fill="#fff"/><circle cx="96" cy="68" r="3" fill="${T}" stroke="none"/><circle cx="124" cy="68" r="3" fill="${T}" stroke="none"/>
        <path d="M108 78 Q130 80 128 94 Q118 96 108 92" fill="$peau"/>
        <path d="M80 100 Q84 130 112 128 Q138 126 136 100 Q120 108 106 104 Q92 98 80 100 Z" fill="#C8A26B"/>
        <path d="M96 112 Q110 118 124 112" fill="none"/>
        <path d="M76 70 Q60 70 64 84 Q70 92 78 86" fill="$peau"/>`) },
    { id:'petit-jaune', n:'Le petit être jaune à lunettes', cat:'perso', zones:{ corps:['Son corps', '#FCE029'], salopette:['Sa salopette', '#2E5A9C'] },
      svg:fond('#F2F2F2') + g(`
        <path d="M54 80 Q54 18 100 18 Q146 18 146 80 L146 170 Q146 196 100 196 Q54 196 54 170 Z" fill="$corps"/>
        <path d="M54 136 L146 136 L146 170 Q146 196 100 196 Q54 196 54 170 Z" fill="$salopette"/>
        <rect x="74" y="120" width="52" height="30" rx="4" fill="$salopette"/><path d="M54 120 L76 126 M146 120 L124 126"/>
        <path d="M84 132 L116 132" stroke="#1B3A66"/>
        <rect x="50" y="60" width="100" height="12" fill="${T}"/>
        <circle cx="100" cy="66" r="26" fill="#9EA4AE"/><circle cx="100" cy="66" r="17" fill="#fff"/><circle cx="100" cy="66" r="8" fill="#7A4A1E"/><circle cx="100" cy="66" r="4" fill="${T}" stroke="none"/>
        <path d="M84 104 Q100 116 116 104" fill="none"/>
        <path d="M90 18 L86 6 M100 18 L100 4 M110 18 L114 6"/>`) },
    { id:'ogre', n:'L\'ogre vert du marais', cat:'perso', zones:{ peau:['Sa peau', '#9DB343'] },
      svg:fond('#E6E0C6') + g(`
        <path d="M40 200 L46 160 Q100 140 154 160 L160 200 Z" fill="#E9E1C4"/><path d="M70 150 L76 200 M130 150 L124 200" stroke-width="6" stroke="#5A3A22"/>
        <path d="M48 70 L32 52 L36 48 L50 62 Z M152 70 L168 52 L164 48 L150 62 Z" fill="$peau"/>
        <ellipse cx="100" cy="96" rx="54" ry="58" fill="$peau"/>
        ${yeux(82, 118, 84, 7)}<path d="M70 70 Q82 62 94 70 M106 70 Q118 62 130 70" fill="none"/>
        <ellipse cx="100" cy="106" rx="14" ry="10" fill="$peau"/>
        <path d="M76 126 Q100 142 124 126" fill="none"/>`) },

    /* ---------- Les logos et les marques (dessinés autrement) ---------- */
    { id:'arches', n:'Le cornet de frites du fast-food aux arches dorées', cat:'logo', zones:{ fond:['Le rouge du cornet', '#DA291C'], arches:['Le jaune des frites', '#FFC72C'] },
      svg:fond('#F1F1F1') + g(`
        ${[52, 66, 80, 94, 108, 122, 136].map((x, i) => `<rect x="${x}" y="${30 + (i % 3) * 8}" width="12" height="90" rx="3" fill="$arches" transform="rotate(${(i - 3) * 4} ${x + 6} 120)"/>`).join('')}
        <path d="M40 92 Q100 112 160 92 L148 186 Q100 196 52 186 Z" fill="$fond"/>
        <path d="M76 124 Q88 104 100 124 Q112 104 124 124" fill="none" stroke="$arches" stroke-width="7"/>`) },
    { id:'soda', n:'La canette du soda le plus célèbre', cat:'logo', zones:{ canette:['La canette', '#E61D2B'] },
      svg:fond('#FFF7EC') + g(`
        <path d="M60 30 Q60 20 70 18 L130 18 Q140 20 140 30 L146 44 L146 168 L140 182 Q130 188 100 188 Q70 188 60 182 L54 168 L54 44 Z" fill="$canette"/>
        <path d="M70 18 L130 18 L136 30 L64 30 Z" fill="#C9CDD2"/><path d="M60 182 L140 182 Q130 192 100 192 Q70 192 60 182 Z" fill="#C9CDD2"/>
        ${[[72, 140, 4], [84, 152, 3], [120, 146, 5], [128, 160, 3], [110, 164, 2.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="none" opacity=".8"/>`).join('')}`) +
        `<text x="100" y="104" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="34" fill="#fff">Cola</text>` },
    { id:'sirene', n:'Le gobelet du café à la sirène', cat:'logo', zones:{ vert:['Le vert du logo', '#00704A'] },
      svg:fond('#F4EFE6') + g(`
        <path d="M54 50 L146 50 L134 188 L66 188 Z" fill="#fff"/>
        <path d="M48 34 Q100 26 152 34 L152 50 L48 50 Z" fill="#fff"/><rect x="58" y="22" width="84" height="12" rx="4" fill="#fff"/>
        <path d="M60 86 L140 86 L136 132 L64 132 Z" fill="#C49A6C"/>
        <circle cx="100" cy="108" r="30" fill="$vert"/>`, 2.5) +
        `<path d="M100 88 L106 102 L121 102 L109 111 L114 126 L100 117 L86 126 L91 111 L79 102 L94 102 Z" fill="#fff"/>` },
    { id:'oiseau', n:'L\'oiseau bleu des messages courts', cat:'logo', zones:{ oiseau:['L\'oiseau', '#1DA1F2'] },
      svg:fond('#FFFFFF') + g(`
        <path d="M60 120 Q20 110 26 84 Q50 104 72 100 Z" fill="$oiseau"/>
        <ellipse cx="102" cy="112" rx="56" ry="46" fill="$oiseau"/>
        <path d="M86 108 Q110 80 132 112 Q112 126 86 108 Z" fill="$oiseau"/>
        <circle cx="134" cy="88" r="9" fill="#fff"/><circle cx="136" cy="88" r="4" fill="${T}" stroke="none"/>
        <path d="M156 96 L180 102 L156 110 Z" fill="#F6C343"/>
        <path d="M86 156 L82 176 M112 156 L116 176" />`) },
    { id:'reseau-f', n:'Le grand réseau social bleu (j\'aime !)', cat:'logo', zones:{ fond:['Le bleu de l\'appli', '#1877F2'] },
      svg:fond('#F0F2F5') + `<rect x="26" y="26" width="148" height="148" rx="36" fill="$fond"/>` + g(`
        <path d="M70 96 L88 96 L88 152 L70 152 Z M92 150 L92 98 L112 62 Q122 58 124 70 L118 92 L144 92 Q154 94 152 106 L144 142 Q140 152 128 152 Z" fill="#fff"/>`, 3) },
    { id:'video', n:'La télé des vidéos en ligne', cat:'logo', zones:{ rouge:['Le rouge de la télé', '#FF0000'] },
      svg:fond('#FFFFFF') + g(`
        <path d="M76 30 L100 54 L124 30" fill="none" stroke-width="5"/>
        <rect x="22" y="54" width="156" height="110" rx="24" fill="$rouge"/><rect x="40" y="70" width="120" height="78" rx="12" fill="#fff"/>
        <path d="M88 88 L88 130 L122 109 Z" fill="$rouge"/>
        <path d="M54 164 L48 180 M146 164 L152 180" stroke-width="5"/>`) },
    { id:'meubles', n:'Le grand sac du magasin de meubles suédois', cat:'logo', zones:{ bleu:['Le bleu du sac', '#0058A3'], jaune:['Le jaune des poignées', '#FFDB00'] },
      svg:fond('#EDEDED') + g(`
        <path d="M58 70 Q58 20 82 20 Q96 20 96 70" fill="none" stroke="$jaune" stroke-width="10"/><path d="M104 70 Q104 20 128 20 Q142 20 142 70" fill="none" stroke="$jaune" stroke-width="10"/>
        <path d="M24 66 L176 66 L166 186 L34 186 Z" fill="$bleu"/>
        <path d="M58 66 L52 186 M142 66 L148 186" stroke="$jaune" stroke-width="10"/>
        <path d="M30 100 L170 100" stroke="#00427A" stroke-width="2"/>`) },
    { id:'films', n:'L\'appli rouge des films et des séries', cat:'logo', zones:{ rouge:['Le rouge du N', '#E50914'] },
      svg:fond('#141414') + g(`<rect x="20" y="40" width="160" height="104" rx="8" fill="#000" stroke="#555"/><path d="M80 144 L74 168 M120 144 L126 168 M62 168 L138 168" stroke="#555" stroke-width="4"/>`, 3) +
        `<text x="100" y="128" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="92" fill="$rouge">N</text>` },
    { id:'musique', n:'L\'appli de musique verte', cat:'logo', zones:{ vert:['Le vert de l\'appli', '#1DB954'] },
      svg:fond('#191414') + `<circle cx="100" cy="100" r="80" fill="$vert"/>` + g(`
        <path d="M92 52 L140 42 L140 124" fill="none" stroke="#191414" stroke-width="9"/><path d="M92 52 L92 134" fill="none" stroke="#191414" stroke-width="9"/>
        <ellipse cx="80" cy="136" rx="16" ry="12" fill="#191414"/><ellipse cx="128" cy="126" rx="16" ry="12" fill="#191414"/>`, 0) },
    { id:'messagerie', n:'La messagerie à la bulle verte', cat:'logo', zones:{ vert:['Le vert de la bulle', '#25D366'] },
      svg:fond('#ECE5DD') + g(`<path d="M100 26 Q172 26 174 92 Q172 156 100 158 Q84 158 70 154 L30 176 L42 140 Q26 120 26 92 Q28 26 100 26 Z" fill="$vert"/>`, 3) +
        `<circle cx="70" cy="92" r="11" fill="#fff"/><circle cx="100" cy="92" r="11" fill="#fff"/><circle cx="130" cy="92" r="11" fill="#fff"/>` },
    { id:'fantome', n:'Le petit fantôme des photos qui disparaissent', cat:'logo', zones:{ jaune:['Le jaune du fond', '#FFFC00'] },
      svg:`<rect width="200" height="200" fill="$jaune"/>` + g(`<path d="M100 30 Q150 30 150 90 L150 168 L134 154 L118 170 L100 154 L82 170 L66 154 L50 168 L50 90 Q50 30 100 30 Z" fill="#fff"/>
        <ellipse cx="82" cy="86" rx="9" ry="13" fill="${T}"/><ellipse cx="118" cy="86" rx="9" ry="13" fill="${T}"/><path d="M84 118 Q100 130 116 118" fill="none"/>`, 4) },
    { id:'chocolat', n:'La tablette de chocolat violette des Alpes', cat:'logo', zones:{ violet:['Le violet de l\'emballage', '#7B6DB0'] },
      svg:fond('#E9F4FF') + g(`<rect x="20" y="40" width="160" height="120" rx="10" fill="$violet"/><path d="M20 128 Q60 112 100 124 Q140 136 180 120 L180 150 Q180 160 170 160 L30 160 Q20 160 20 150 Z" fill="#fff"/>`) +
        `<text x="100" y="98" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="44" fill="#fff">Lila</text><path d="M44 62 L52 50 L60 62 L70 48 L80 62" fill="none" stroke="#fff" stroke-width="3"/>` },
    { id:'operateur', n:'Le téléphone de l\'opérateur orange', cat:'logo', zones:{ orange:['L\'orange du téléphone', '#FF7900'] },
      svg:fond('#1A1A1A') + g(`<rect x="56" y="16" width="88" height="168" rx="16" fill="$orange"/><rect x="66" y="36" width="68" height="120" rx="4" fill="#fff"/><circle cx="100" cy="168" r="7" fill="#fff"/>
        <rect x="74" y="132" width="34" height="8" fill="$orange" stroke="none"/>`, 3) },
    { id:'brique', n:'La brique de construction', cat:'logo', zones:{ rouge:['La brique', '#C91A09'] },
      svg:fond('#F4F4F4') + g(`
        <path d="M20 96 L100 136 L180 96 L180 150 L100 190 L20 150 Z" fill="$rouge"/><path d="M100 136 L100 190" />
        <path d="M20 96 L100 56 L180 96 L100 136 Z" fill="$rouge"/>
        ${[[62, 80], [100, 62], [100, 100], [138, 80]].map(([x, y]) => `<path d="M${x - 16} ${y} L${x - 16} ${y - 12} A16 8 0 0 1 ${x + 16} ${y - 12} L${x + 16} ${y} A16 8 0 0 1 ${x - 16} ${y} Z" fill="$rouge"/><ellipse cx="${x}" cy="${y - 12}" rx="16" ry="8" fill="$rouge"/>`).join('')}`) },
    { id:'poupee', n:'La poupée la plus célèbre', cat:'logo', zones:{ rose:['Le rose du logo', '#E0218A'] },
      svg:fond('#FFF0F7') + `<rect x="14" y="58" width="172" height="84" rx="42" fill="$rose"/><text x="100" y="116" text-anchor="middle" font-family="Brush Script MT, cursive" font-style="italic" font-weight="700" font-size="50" fill="#fff">Bobbie</text>` },
    { id:'bijoutier', n:'La petite boîte du grand bijoutier', cat:'logo', zones:{ boite:['La boîte', '#81D8D0'] },
      svg:fond('#FFFFFF') + g(`
        <path d="M40 90 L160 90 L160 176 L40 176 Z" fill="$boite"/><path d="M32 66 L168 66 L168 92 L32 92 Z" fill="$boite"/>
        <path d="M92 66 L92 176 M108 66 L108 176 M32 76 L168 76 M32 82 L168 82" stroke="#fff" stroke-width="7"/>
        <path d="M100 64 Q70 30 62 50 Q60 64 100 64 Q140 64 138 50 Q130 30 100 64 Z" fill="#fff" stroke="#DADADA"/>`, 2) },
    { id:'colis', n:'Le carton souriant des colis', cat:'logo', zones:{ fleche:['La flèche-sourire', '#FF9900'] },
      svg:fond('#FFFFFF') + g(`<path d="M30 70 L100 44 L170 70 L170 160 L100 186 L30 160 Z" fill="#C8A06A"/><path d="M30 70 L100 96 L170 70 M100 96 L100 186" fill="none"/><path d="M60 58 L130 84 L130 104" fill="none" stroke="#E2C99A" stroke-width="10"/>`, 3) +
        `<path d="M42 116 Q66 138 92 128 L88 120 L100 126 L94 140 L92 134 Q64 146 38 122 Z" fill="$fleche" transform="skewY(14) translate(0 -14)"/>` },
    { id:'taxi', n:'Le taxi de New York', cat:'objet', zones:{ taxi:['La carrosserie', '#F7B500'] },
      svg:fond('#CFE8FF') + g(`
        <path d="M14 140 L20 110 L54 104 L74 74 L132 74 L152 104 L184 112 L188 140 Z" fill="$taxi"/>
        <path d="M80 82 L126 82 L140 104 L66 104 Z" fill="#BFE0FF"/><path d="M103 82 L103 104"/>
        <rect x="86" y="58" width="32" height="14" rx="3" fill="#fff"/><text x="102" y="69" text-anchor="middle" font-size="9" font-weight="700" fill="${T}" stroke="none">TAXI</text>
        <path d="M30 122 L176 122" stroke-dasharray="6 5"/>
        <circle cx="54" cy="142" r="18" fill="#333"/><circle cx="54" cy="142" r="7" fill="#AAA"/><circle cx="150" cy="142" r="18" fill="#333"/><circle cx="150" cy="142" r="7" fill="#AAA"/>`) },
    { id:'bus-londres', n:'Le bus à étage de Londres', cat:'objet', zones:{ bus:['Le bus', '#DA291C'] },
      svg:fond('#D8E4EE') + g(`
        <rect x="26" y="34" width="150" height="136" rx="14" fill="$bus"/>
        ${[0, 1, 2, 3].map(i => `<rect x="${36 + i * 34}" y="48" width="28" height="30" rx="3" fill="#CFE6FA"/><rect x="${36 + i * 34}" y="100" width="28" height="30" rx="3" fill="#CFE6FA"/>`).join('')}
        <rect x="26" y="86" width="150" height="8" fill="#F0E6C8"/>
        <circle cx="60" cy="172" r="16" fill="#333"/><circle cx="144" cy="172" r="16" fill="#333"/>`) },
    { id:'boite-lettres', n:'La boîte aux lettres française', cat:'objet', zones:{ boite:['La boîte', '#FFCD00'] },
      svg:fond('#DCEAF4') + g(`
        <rect x="56" y="150" width="88" height="44" fill="#6F6F6F"/>
        <path d="M44 80 Q44 30 100 30 Q156 30 156 80 L156 156 L44 156 Z" fill="$boite"/>
        <rect x="70" y="70" width="60" height="10" rx="4" fill="${T}"/>
        <path d="M84 108 L96 98 L104 106 L116 96" fill="none" stroke="#1F3B8C" stroke-width="5"/>
        <rect x="80" y="124" width="40" height="14" fill="#fff"/>`) },
    { id:'stop', n:'Le panneau stop', cat:'objet', zones:{ rouge:['Le rouge du panneau', '#C8102E'] },
      svg:fond('#BFE3B4') + `<rect x="94" y="140" width="12" height="60" fill="#8E8E8E"/><path d="M70 14 L130 14 L172 56 L172 116 L130 158 L70 158 L28 116 L28 56 Z" fill="#fff" stroke="#777" stroke-width="1"/><path d="M73 22 L127 22 L164 59 L164 113 L127 150 L73 150 L36 113 L36 59 Z" fill="$rouge"/><text x="100" y="102" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="40" fill="#fff">STOP</text>` },
    { id:'drapeau-fr', n:'Le drapeau français', cat:'objet', zones:{ bleu:['Le bleu', '#0055A4'], rouge:['Le rouge', '#EF4135'] },
      svg:fond('#D6EEFF') + g(`<rect x="22" y="20" width="6" height="176" fill="#8E8E8E"/><rect x="28" y="24" width="50" height="104" fill="$bleu"/><rect x="78" y="24" width="50" height="104" fill="#fff"/><rect x="128" y="24" width="50" height="104" fill="$rouge"/>`, 2) },
    { id:'pont', n:'Le grand pont suspendu de San Francisco', cat:'objet', zones:{ pont:['Le pont', '#C0362C'] },
      svg:fond('#BFD9EC') + `<rect y="150" width="200" height="50" fill="#5A88A8"/>` + g(`
        <rect x="44" y="30" width="16" height="150" fill="$pont"/><rect x="140" y="30" width="16" height="150" fill="$pont"/>
        <path d="M0 130 Q22 128 52 34 Q100 140 148 34 Q178 128 200 130" fill="none" stroke="$pont" stroke-width="5"/>
        <rect x="0" y="128" width="200" height="10" fill="$pont"/>
        <path d="M70 76 L70 128 M86 104 L86 128 M114 104 L114 128 M130 76 L130 128" stroke="$pont" stroke-width="2"/>`, 2) },
    { id:'liberte', n:'La grande statue de New York', cat:'objet', zones:{ statue:['La statue', '#82B9A5'] },
      svg:fond('#DCEFFF') + g(`
        <rect x="58" y="160" width="84" height="40" fill="#C7B89A"/>
        <path d="M70 160 L80 92 Q100 84 120 92 L130 160 Z" fill="$statue"/>
        <circle cx="100" cy="74" r="16" fill="$statue"/>
        <path d="M84 62 L78 46 L90 56 L94 40 L100 56 L106 40 L110 56 L122 46 L116 62 Z" fill="$statue"/>
        <path d="M118 96 L142 52 L150 56 L128 100 Z" fill="$statue"/>
        <path d="M140 52 L152 50 L150 36 Q146 30 142 36 Z" fill="#F6C343"/>
        <path d="M76 112 L66 124 L82 132 Z" fill="$statue"/>`) },
    { id:'note', n:'La petite note collante', cat:'objet', zones:{ note:['La note', '#FFF68F'] },
      svg:fond('#8A8F98') + g(`<path d="M30 30 L170 30 L170 150 L140 172 L30 172 Z" fill="$note"/><path d="M170 150 L140 150 L140 172" fill="#D9CF62"/>`, 2) +
        `<path d="M48 70 L130 70 M48 96 L112 96 M48 122 L122 122" stroke="#5A6CD9" stroke-width="4" stroke-linecap="round"/>` },
    { id:'crayon', n:'Le crayon à papier de l\'école', cat:'objet', zones:{ crayon:['Le crayon', '#F8C61E'] },
      svg:fond('#EFE9DC') + g(`
        <path d="M30 150 L130 50 L160 80 L60 180 Z" fill="$crayon"/><path d="M80 100 L145 65 M95 115 L150 75" fill="none" stroke="#C99A12" stroke-width="2"/>
        <path d="M130 50 L148 32 Q160 24 168 32 Q176 40 168 52 L160 80 Z" fill="#F29BB0"/><path d="M124 56 L142 38 L172 68 L154 86 Z" fill="#C0C4CA"/>
        <path d="M30 150 L60 180 L18 192 Z" fill="#F2D3A7"/><path d="M24 170 L30 176 L18 192 Z" fill="${T}"/>`) },
    { id:'bus-ecole', n:'Le bus scolaire américain', cat:'objet', zones:{ bus:['Le bus', '#FFD800'] },
      svg:fond('#CDEBC3') + g(`
        <path d="M10 140 L10 60 Q10 50 20 50 L150 50 Q160 50 162 60 L166 92 L190 100 L192 140 Z" fill="$bus"/>
        ${[0, 1, 2, 3].map(i => `<rect x="${20 + i * 32}" y="60" width="24" height="26" rx="2" fill="#CFE6FA"/>`).join('')}
        <path d="M10 104 L166 104 M10 116 L192 116" stroke-width="3"/>
        <circle cx="46" cy="142" r="17" fill="#333"/><circle cx="160" cy="142" r="17" fill="#333"/>`) },
    { id:'tennis', n:'La balle de tennis', cat:'objet', zones:{ balle:['La balle', '#CCFF00'] },
      svg:fond('#5B9A4C') + `<rect x="0" y="96" width="200" height="6" fill="#fff"/>` + g(`<circle cx="100" cy="100" r="70" fill="$balle"/><path d="M42 58 Q90 100 42 142 M158 58 Q110 100 158 142" fill="none" stroke="#fff" stroke-width="6"/>`, 2) },
  ];
  return L;
})();
