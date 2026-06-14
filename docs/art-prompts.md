# Bibliothèque de prompts IA — Wasteland Empires

Prompts pour générer les assets via Midjourney / DALL·E / Stable Diffusion (SDXL).
Les prompts sont en **anglais** (meilleurs résultats), les explications en français.

> DA cible (cf. `plan-jeu-rts-post-apo.md`) : 2D isométrique détaillée, industriel/sale/lisible,
> palette désaturée + accents néon ou alerte, rétro-futurisme militaire, effets de lumière localisés.

---

## 0. Comment s'en servir (cohérence avant tout)

La cohérence visuelle est le point le plus dur. Règles d'or :

1. **Réutiliser le bloc "STYLE BASE"** ci-dessous dans CHAQUE prompt (copier-coller le préfixe).
2. **Verrouiller un seed** (SD/MJ `--seed`) une fois qu'un rendu plaît, et le garder pour les variantes d'une même famille.
3. **Angle isométrique constant** : true isometric / dimetric, vue 2:1, caméra à ~30° (« 3/4 top-down isometric »). Toujours le même angle pour tuiles, bâtiments et unités, sinon ça ne s'aligne pas en jeu.
4. **Fond transparent** pour tout ce qui est sprite (`transparent background`, ou fond magenta `#FF00FF` à détourer). Les tuiles de terrain peuvent être sur fond plein.
5. **Éclairage cohérent** : lumière principale venant du **haut-gauche** partout (sinon les ombres se contredisent).
6. **Générer grand** (1024+) puis downscaler pour la netteté du sprite.
7. **Midjourney** : ajouter `--ar 1:1 --style raw --v 6` (ou version courante). **SDXL** : CFG 5-7, sampler DPM++ 2M Karras.

### STYLE BASE (préfixe réutilisable)

```
post-apocalyptic industrial wasteland strategy game asset, true isometric view (2:1 dimetric, 30-degree top-down angle), hand-painted detailed 2D game art, desaturated grimdark palette of rust, oxidized metal, concrete grey and dust beige, with selective neon and warning-light accents, gritty weathered surfaces, soldered and salvaged construction, retro-futuristic military design, soft localized lighting from top-left, clean readable silhouette, consistent scale, no text
```

### NEGATIVE PROMPT (SD — à mettre partout)

```
blurry, lowres, jpeg artifacts, watermark, signature, text, ui frame, multiple angles, front view, side view, perspective distortion, cartoonish, cute, pastel, oversaturated, photo, realistic photograph, 3d render turntable, cropped, deformed, extra limbs
```

---

## 1. Palettes (référence)

### Par faction (à injecter via "dominant color")
- **Résistants** (survivants polyvalents, récup tech) : khaki/olive drab + accents cyan electrique. Bricolé mais soigné.
- **Nomades** (convois mobiles) : sand/ochre + accents orange rouille. Plaques de tôle, roues, bâches.
- **Fondeurs** (cités-usines, industrie lourde) : graphite/gunmetal + accents lave/orange chauffé. Béton, acier massif.
- **Cultistes de la Machine** (techno-religieux) : noir/violet sombre + accents magenta/cyan « saint ». Hybride organique-machine, câbles, néons rituels.
- **Machines** (3e force hostile) : metal froid bleu-acier + accents **rouge optique agressif** (yeux/scanners rouges). Lignes nettes, anguleux, inhumain.

### Codes couleur en jeu (liseré/contour des sprites, géré côté code)
- Allié = cyan/vert, Ennemi = rouge, Neutre = jaune, Machines = rouge sombre pulsant.

### Par biome
- Urbain détruit : gris béton + verre brisé + suie noire.
- Désert industriel : beige/ocre + métal cuit au soleil.
- Vallée radioactive : vert toxique malsain + brun + brume.
- Centrale abandonnée : gris-bleu + traînées de fuite + rouille.

---

## 2. Tuiles de terrain (tilesets isométriques)

> Générer en **set** sur une grille, ou tuile par tuile. Demander explicitement « seamless tileable isometric diamond tile ».

**Tuile de base — béton fissuré**
```
[STYLE BASE], single seamless isometric diamond ground tile, cracked concrete with dust and small debris, top-down 2:1 isometric, tileable edges, flat even lighting, game tileset asset, transparent background
```

**Variantes** (remplacer la description centrale) :
- Sol asphalte / route : `cracked asphalt road segment with faded markings, oil stains`
- Terre/poussière : `dry cracked dirt, scattered pebbles and rust flecks`
- Boue toxique (ralentit) : `toxic green sludge puddle, bubbling, faint glow, hazard`
- Zone irradiée (malus) : `irradiated scorched ground, sickly green-yellow haze, glowing cracks`
- Débris épais (couverture) : `pile of metal rubble and broken concrete chunks, partial cover`
- Ruines (bonus défensif) : `ruined building foundation, broken low walls, rebar exposed`
- Hauteur / plateau : `elevated rocky platform edge, cliff face, isometric ramp`

**Décor / props posables**
```
[STYLE BASE], isometric prop, <X>, small game object, transparent background, single object centered
```
Remplacer `<X>` : `rusted car wreck` · `dead industrial pipeline segment` · `concrete barrier` · `barbed wire fence section` · `broken streetlight` · `mutant twisted tree` · `oil barrel cluster` · `collapsed highway pillar`.

---

## 3. Ressources (gisements + icônes)

Gisements sur la carte (objet iso) :
```
[STYLE BASE], isometric resource node, <X>, harvestable deposit, transparent background, single object
```
- Ferraille : `heap of scrap metal, twisted rebar, car parts, magnetic salvage pile`
- Carburant : `cluster of fuel barrels and a rusted pump, leaking, flammable`
- Eau (contaminée) : `murky contaminated water pool with debris, ripples`
- Composants électroniques : `pile of broken circuit boards, server racks, salvageable electronics, faint blinking LEDs`

Voir aussi **section 8** pour les icônes UI de ces ressources.

---

## 4. Bâtiments (par faction)

> Toujours préciser la **faction palette** (section 1) + l'angle iso + l'empreinte au sol (footprint) carrée pour l'alignement grille.

**Template**
```
[STYLE BASE], isometric building sprite, <BÂTIMENT>, <FACTION palette>, square footprint on isometric grid, salvaged industrial construction, weathered, single structure centered, transparent background, soft top-left lighting
```

Bâtiments à décliner (cf. plan, section Construction) :
- **Commandement** : `command HQ bunker with antenna mast` · `control center` · `communications node with satellite dishes`
- **Production ressources** : `scrap collector crane` · `water pumping station` · `fuel refinery with tanks` · `electronics disassembly shed`
- **Industrie** : `foundry with chimney and molten glow` · `mechanical workshop` · `light factory` · `heavy factory with cranes`
- **Militaire** : `barracks` · `weapons workshop` · `armored vehicle garage` · `defense turret tower` · `reinforced bunker` · `modular wall segment`
- **Science** : `research laboratory with glowing windows` · `reverse-engineering center` · `hacking station with antenna array` · `radar relay dish`
- **Soutien/survie** : `water purifier tanks` · `hydroponic farm dome` · `field medical center` · `logistics depot with crates` · `power generator with cables`

**Exemple complet (Fondeurs, fonderie)**
```
[STYLE BASE], isometric building sprite, heavy industrial foundry with tall chimney and molten orange glow from vents, Fondeurs faction palette (graphite gunmetal with lava-orange accents), massive concrete and steel construction, square footprint on isometric grid, weathered, soot stains, single structure centered, transparent background, soft top-left lighting
```

**Astuce** : générer une variante « damaged / ruined » de chaque bâtiment (`heavily damaged, smoking, partially collapsed`) pour l'état détruit / la mécanique d'usure du plan.

---

## 5. Unités

> Unités = petites, **silhouette ultra lisible** prioritaire sur le détail. Générer en pied, vue iso 3/4, pose neutre idle. Prévoir des variantes de direction plus tard (ou rotation par code).

**Template**
```
[STYLE BASE], isometric game unit, <UNITÉ>, <FACTION palette>, small character/vehicle sprite, strong readable silhouette, idle pose facing front-right, transparent background, consistent scale with other infantry
```

**Infanterie** : `scout in light gear with binoculars` · `scavenger with salvage backpack` · `rifleman with makeshift armor` · `sniper with long rifle and ghillie scraps` · `engineer with welding tool` · `saboteur with explosives, hooded` · `medic with red-cross-painted satchel`

**Véhicules** : `recon buggy / dirt bike` · `logistics cargo truck` · `light armored car` · `troop transport APC` · `mobile artillery truck` · `improvised heavy tank welded from scrap`

**Drones & robots alliés** : `small recon quadcopter drone` · `repair drone with arm and sparks` · `mobile auto-turret on tracks` · `combat exoskeleton suit` · `light salvage mech`

**Unités spéciales** : `faction hero commander, imposing` · `combat hacker with rig and antenna` · `stealth operative, cloaked shimmer` · `siege commander` · `man-machine hybrid cyborg`

**Exemple (Machines — ennemi)**
```
[STYLE BASE], isometric game unit, hostile autonomous war machine, quadruped hunter-killer robot, cold steel-blue metal with aggressive glowing red optical scanner, sharp angular inhuman design, menacing idle pose, strong readable silhouette, transparent background
```

---

## 6. Les Machines (3e force) — assets dédiés

Bestiaire machine (toujours bleu-acier froid + rouge optique) :
```
[STYLE BASE], isometric hostile machine, <X>, cold steel and dark metal, glowing red sensors, angular inhuman military design, transparent background
```
- `bipedal sentinel robot with cannon arm`
- `small swarm drone, insect-like`
- `heavy tracked siege machine`
- `spider-like turret defender`
- `large boss-tier war mech, multi-weapon`

Structures machine (à capturer/détruire) : `automated factory`, `data center bunker`, `missile silo`, `machine patrol beacon`.

---

## 7. Effets visuels (FX) — spritesheets

> Demander des **séquences / sprite sheets** sur fond noir ou transparent, puis découper en frames.
```
[STYLE BASE-light], <FX> animation spritesheet, sequential frames on a grid, transparent or pure black background, stylized game VFX, no isometric perspective needed
```
- Explosion : `fiery explosion with debris and smoke, 8 frames`
- Fumée : `rising grey smoke plume, looping, 6 frames`
- Feu : `burning fire loop`
- Muzzle flash : `gun muzzle flash, 4 frames`
- Impact balistique / énergétique / explosif : 3 styles d'impact distincts
- Pluie acide / radiation : `falling acid rain overlay` · `green radiation particle haze overlay`
- Étincelles de réparation, électricité, brouillard.

---

## 8. UI — icônes, HUD, cadres

> Style **rétro-futuriste militaire**, lisible en petit. Souvent mieux en vue de face (pas iso) pour les icônes.

**Icônes (set cohérent)**
```
flat military HUD game icon, <X>, retro-futuristic industrial UI, desaturated metal with single neon accent color, clean readable silhouette, dark background, icon set style, no text
```
- Ressources : `scrap/gear icon` (ferraille) · `fuel drop/jerrycan icon` (carburant) · `water drop icon` (eau) · `microchip icon` (composants)
- Actions : `build / hammer` · `attack / crosshair` · `move / arrow` · `repair / wrench` · `stop` · `patrol` · `research / flask`
- Alertes : `warning triangle`, `under-attack red blip`, `radiation hazard`, `power/no-power`.

**Cadres / HUD**
```
retro-futuristic military RTS HUD frame, bottom command panel and top resource bar, brushed dark metal with neon warning accents, rivets and worn edges, sci-fi grimdark, layout mockup, no text
```

**Mini-map / curseurs / boutons** : décliner avec le même préfixe.

---

## 9. Portraits & écrans (narratif)

**Portraits de commandants** (un par faction)
```
post-apocalyptic faction commander portrait, <description>, grimdark realistic painted style, desaturated palette with <FACTION accent>, military scavenger aesthetic, bust shot, dark moody lighting, game character portrait
```
- Résistants : `weathered pragmatic leader, scarred, determined`
- Nomades : `nomad warlord, goggles, dust scarf, wiry`
- Fondeurs : `industrial overseer, heavy build, soot-stained, augmented arm`
- Cultistes : `techno-cult prophet, cybernetic implants, hooded, glowing eye`

**Écrans de briefing / fond de menu**
```
[STYLE BASE], wide cinematic establishing shot, ruined post-apocalyptic city skyline at dusk, dying neon signs, acid rain, distant machine silhouettes, atmospheric, game menu background, 16:9
```
(Midjourney : `--ar 16:9`.)

---

## 10. Checklist de production d'assets

- [ ] Figer le STYLE BASE + un seed de référence par famille.
- [ ] Valider 1 tuile + 1 bâtiment + 1 unité ALIGNÉS sur la grille iso avant d'en générer 50.
- [ ] Détourer les fonds (ou générer en transparent) → PNG.
- [ ] Normaliser les tailles (tuiles à dimensions fixes, ex. 128×64 pour iso 2:1).
- [ ] Regrouper en **atlas / spritesheet** (TexturePacker ou format atlas Phaser) pour le chargement.
- [ ] Ranger dans `public/assets/` (terrain, buildings, units, fx, ui, portraits) et référencer en data-driven dans `src/content/`.
```

> Rappel pipeline : ces images = DA finale. En attendant, le jeu peut tourner avec des placeholders procéduraux (option dispo si besoin) sans bloquer la Phase 1.
