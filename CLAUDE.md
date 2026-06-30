# Wasteland Empires

RTS isométrique post-apocalyptique (univers guerre hommes-machines, type *Terminator*), jouable solo et multijoueur, entièrement sur stack web. Vision complète et game design dans [plan-jeu-rts-post-apo.md](plan-jeu-rts-post-apo.md) — **lire ce fichier avant tout travail de design**.

## Stack technique

- **Moteur de jeu** : Phaser 4 (`phaser@^4.1.0`) — rendu WebGL (RenderNode, Sprite GPU Layer, filtres unifiés).
- **Langage** : TypeScript (strict).
- **Build / dev** : Vite 6.
- **Backend multi (à venir)** : Node.js + Socket.io, serveur autoritaire.
- **Persistance (à venir)** : PostgreSQL (+ Redis plus tard).

> ⚠️ On cible les API **Phaser 4** dès le départ (pas de Phaser 3). Différences clés vs v3 : `setTint()` + `setTintMode()` (plus de `setTintFill()`), `Geom.Point` → `Vector2`, `BitmapMask` → filtre `Mask`, pipelines custom = render nodes. Mesh/Plane et Camera3D supprimés.

## Commandes

```bash
npm run dev        # serveur de dev Vite (http://localhost:5173)
npm run build      # typecheck + build production
npm run typecheck  # tsc --noEmit
```

## Structure

```
src/
  main.ts            # point d'entrée — instancie Phaser.Game
  core/              # config, scènes, boucle, événements
    config.ts        # GAME_CONFIG
    scenes/          # BootScene (placeholder pour l'instant)
  world/             # cartes, tuiles iso, navigation, brouillard
  entities/          # unités, bâtiments, projectiles
  systems/           # économie, combat, production, vision, IA
  ui/                # HUD, panneaux, menus, mini-carte
  network/           # synchro client (intentions -> serveur autoritaire)
  content/           # data-driven : factions, unités, recherches, cartes
```
Alias d'import : `@/*` → `src/*`.

## État d'avancement

- ✅ **Scaffolding** : Vite + TS + Phaser 4, structure de dossiers (build OK).
- ✅ **Phase 1 — Prototype moteur** (complète) :
  - Terrain isométrique peint (pack Golbanc) + grille logique iso **calibrée** (tile 270×156), dans `GameScene`.
  - Caméra : pan (glisser / flèches / edge-scroll) + zoom (molette).
  - Grille d'occupation (`world/Grid.ts`) : obstacles bloquent des cases.
  - **Pathfinding A\*** 8 directions (`world/pathfinding.ts`) : contournement d'obstacles.
  - Unité (`entities/Unit.ts`) : suit le chemin, **sprite animé 8 directions** (idle/run/attack/die), depth-sorting iso.
  - **Sélection** : clic simple, rectangle, **Maj+clic additif**, **groupes de contrôle Ctrl+[1-9] / rappel [1-9]** (double-tap = recentrer).
  - **Ordres de groupe** : déplacement en formation (`freeCellsAround`), **évitement/séparation** entre unités, **recalcul de chemin** sur blocage (`resolveStuck`).
- 🟡 **Phase 2 — Vertical slice (en cours)** :
  - Récolte de ferraille (gisements → dépôt), production d'unités (file + coût).
  - Ennemi simple + boucle de combat (aggro, riposte, barres de vie, mort).
  - **Construction de bâtiments** data-driven (`content/buildings.ts`, `entities/Building.ts`) : mode placement (ghost + validation footprint + coût), footprint bloqué sur la grille de nav. Tourelle défensive (tir hitscan + FX), mur, **caserne**. Ennemis assiègent les bâtiments (boucle attaque/défense fermée).
  - **Production par bâtiment** : la caserne se sélectionne (clic → contour iso du footprint), `T` met en file (coût ferraille), spawn en sortie de bâtiment, **point de ralliement** au clic droit.
  - **IA ennemie plus crédible** (`content/ai.ts` + `processEnemyAI`) : en plus des vagues d'assaut croissantes, l'IA garde une **garnison** défensive (`garrisonRatio` / `minGarrison`) au lieu de vider sa base à chaque vague, et **fortifie son QG** via un fonds défensif séparé (`fundPerSec`) qui finance des **tourelles** posées sur le flanc exposé (`maxTurrets`, `turretRadius`). Ciblage des tourelles **conscient des camps** (`nearestUnitOfTeam`) — corrige le tir fratricide d'une tourelle ennemie ; l'assaut final sur le QG ennemi n'est plus trivial.
  - **3 ressources** data-driven (`content/resources.ts`) : ferraille ⛏, carburant ⛽ (citerne jaune), eau 💧 (mare). Gisements récoltables (récolte → dépôt → compteurs HUD). **Coûts multi-ressources** (`Cost = Partial<Record<ResourceType, number>>`, `canAfford`/`payCost`/`formatCost`) : tourelle et costaud consomment du carburant, fusilier et costaud de l'eau — les 3 ressources ont désormais un usage réel (l'IA ennemie, elle, ne gère qu'un budget ferraille simplifié).
  - **Map 40×40** (vs 20×20) : 2 bases opposées (joueur HG / ennemi BD), gisements répartis (ferraille près des bases, carburant/eau au centre contestés), décor + barrière diagonale. Fond peint mis à l'échelle pour couvrir la grille.
  - **Types d'unités** data-driven (`content/units.ts`) : récupérateur (R, rapide/fragile), fusilier (F, à distance + FX de tir), costaud (V, lent/tanky). Stats par type (hp/vitesse/dégâts/portée/cooldown) ; teinte de rôle côté joueur. Caserne produit une file mixte (R/F/V).
  - **HUD refait** : chips ressources colorées, bandeau prod (caserne sélectionnée), aide togglable (H). **Lisible à tout zoom** (`layoutHud` : ancrage écran + contre-scale 1/zoom chaque frame).
  - **QG + objectif de victoire/défaite** : QG joueur/ennemi posés d'office (`PLAYER_HQ`/`ENEMY_HQ`), détruire le QG ennemi = victoire (clic droit dessus = ordre de siège), perdre le sien = défaite (overlay de fin).
  - **Carte avec vrai choke point** : barrière centrale en anti-diagonale étanche (col+row = 39), passage unique au centre — oblige à transiter par un point défendable entre les deux bases. **2 gisements de ferraille flanquent le passage** (16,21 et 23,18, hors cases de mur/passage — connectivité vérifiée) : point de contestation directe devant le verrou.
  - **Silhouettes distinctes par type d'unité** : échelle propre à chaque type (`UnitDef.scale` : récupérateur plus petit, costaud plus massif) + **badge de forme** au-dessus de chaque unité (cercle/carré/losange, `UnitDef.badge`) en complément de la teinte de rôle, faute d'art distinct disponible (spritesheet toujours partagé).
  - **Équilibrage IA** (`content/ai.ts`) : délai de démarrage allongé (90s), garnison de départ allégée (plus de costaud d'entrée de jeu), revenu/croissance budget ralentis — évite de mettre un nouveau joueur face à une vague écrasante avant d'avoir pu poser une économie.
- ⬜ **Reste Phase 2** : calage visuel fin des décors (ox/oy de crate/building-b/tree-a/fuel approximés — nécessite un retour visuel, non vérifiable en headless).

### Assets (état)
- **Terrain/décor** : pack "Golbanc Homestead" (Starlight Furnace), iso. Cartes faites main (pas de procédural).
- **Unités** : pack perso "HD Survivor" (TheLazyStone/CraftPix-like) — **top-down** posé sur sol iso (compromis validé visuellement). Spritesheet 128px, 8 dir × 14 frames. Mapping direction→rangée : `rangée = k` (0=E,1=SE,2=S,…,7=NE).
- Tous les packs sont sous licence **No Redistribution** → gitignorés (`public/assets/golbanc`, `public/assets/units`, dossiers packs à la racine).
- Outil de calibrage de grille : `core/scenes/PocScene.ts` (hors scène active).

Voir le phasage complet (Phases 1→6) dans le plan, section « Phasage de développement ».

## Conventions

- TypeScript strict, pas de variables/paramètres inutilisés (enforced par tsconfig).
- Une scène Phaser par fichier dans `core/scenes/`.
- Contenu de jeu (stats unités, coûts, tech) = data-driven dans `content/`, pas en dur dans la logique.
- Architecture pensée multijoueur dès le départ (serveur autoritaire), mais validation d'abord sur un solo propre.
