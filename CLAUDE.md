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
- 🟡 **Phase 2 — Vertical slice (entamée)** : récolte de ferraille (gisements → dépôt), production d'unités (file + coût), ennemi simple + boucle de combat (aggro, riposte, barres de vie, mort).
- ⬜ **Reste Phase 2** : 2e ressource, construction de bâtiments, 2-3 types d'unités distincts, première carte lisible.

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
