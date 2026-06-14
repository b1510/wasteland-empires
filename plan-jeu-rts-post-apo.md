# Plan complet — Jeu de stratégie isométrique post-apocalyptique

## Vision du projet

Le projet vise un jeu de stratégie en temps réel 2D isométrique, jouable en solo et en multijoueur, dans un univers futur post-apocalyptique inspiré d'une guerre hommes-machines à la *Terminator*. L'objectif est de construire un jeu ambitieux, entièrement codé sur une stack web moderne, avec une forte emphase sur la simulation, l'asymétrie des factions, la survie et la rejouabilité.

Le positionnement recherché n'est pas une simple copie d'Age of Empires, mais une réinterprétation plus sombre, plus systémique et plus moderne : économie sous tension, environnement hostile, factions asymétriques, pression constante des machines et boucle de progression lisible.

## Direction produit

### Ambition

Le jeu doit être pensé comme un vrai produit complet, pas comme un simple prototype technique. Cela implique :

- Une boucle de gameplay solide dès le départ.
- Une architecture compatible solo et multijoueur.
- Une direction artistique cohérente dès les premiers assets.
- Des systèmes assez profonds pour soutenir plusieurs dizaines d'heures de jeu.
- Une base technique qui permet ensuite d'ajouter campagne, équilibrage, contenu saisonnier ou extensions.

### Promesse joueur

La promesse centrale peut se résumer ainsi :

> Reconstruire, exploiter, défendre et conquérir dans les ruines d'un monde dominé par les machines.

Le joueur ne doit pas seulement « développer une base ». Il doit aussi gérer la rareté, sécuriser des lignes de production, arbitrer entre expansion et survie, et s'adapter à des menaces mécaniques et humaines.

## Choix technologiques

### Recommandation principale

Pour un jeu 2D isométrique browser-native, ambitieux, solo et multijoueur, la recommandation principale est :

- **Frontend jeu** : Phaser 4
- **Langage** : TypeScript
- **Build tool** : Vite
- **Backend multijoueur** : Node.js + Socket.io
- **Persistance** : PostgreSQL
- **Cartes** : Tiled + génération procédurale complémentaire
- **Pathfinding** : A* avec grille de navigation
- **Déploiement** : Vercel pour le client, Railway ou équivalent pour le serveur temps réel

### Pourquoi ne pas partir sur Three.js

Three.js est excellent pour le rendu 3D et certaines expériences interactives, mais il n'est pas pensé comme un moteur 2D orienté RTS. Pour un jeu isométrique avec sélection d'unités, gestion de tilemaps, HUD, logique de combat, pathfinding, états d'unités et simulation multijoueur, il obligerait à reconstruire beaucoup de briques fondamentales.

Three.js peut rester utile plus tard pour :

- Des menus premium avec décors 3D.
- Une carte stratégique stylisée.
- Des cinématiques temps réel.
- Certains effets visuels avancés.

Mais pour le cœur du jeu, Phaser 4 offre un point de départ plus pragmatique et plus rapide.

### Pourquoi Phaser 4 est le bon compromis

Phaser 4 permet de garder une stack web simple, cohérente et entièrement maîtrisable. Il est adapté à un pipeline de développement "vibe codé", car il permet d'itérer vite, de prototyper rapidement et d'intégrer facilement l'UI, les inputs, le rendu 2D, les animations et la logique réseau.

Ses avantages dans ce projet :

- Très bon fit avec un jeu 2D isométrique.
- Contrôle fin du rendu et de la logique.
- Intégration simple avec TypeScript.
- Connexion naturelle à un backend Node.js.
- Déploiement web direct, sans friction de distribution.
- Facilité d'intégrer des outils maison, de l'IA de gameplay et des pipelines de génération de contenu.

## Vision du gameplay

### Boucle principale

La boucle principale du jeu doit être claire et satisfaisante :

1. Explorer la carte.
2. Sécuriser des ressources.
3. Construire une base ou un réseau de bases.
4. Produire une économie viable.
5. Déverrouiller des technologies.
6. Former une armée.
7. Défendre contre les menaces humaines et machines.
8. Étendre son contrôle territorial.
9. Atteindre une condition de victoire.

### Ce qui rend le jeu différent

Pour éviter l'effet « clone d'Age of Empires dans le futur », le jeu doit insister sur des différenciateurs forts :

- **Monde post-apo vivant** : ruines, pollution, zones irradiées, tempêtes, récupération de technologies anciennes.
- **Pression environnementale** : la carte n'est pas neutre, elle attaque le joueur indirectement.
- **Factions asymétriques** : philosophies radicalement différentes, pas juste des skins avec bonus de pourcentage.
- **Machines autonomes** : présence constante d'une troisième force qui restructure les parties.
- **Économie de survie** : chaque expansion est un risque, pas juste une optimisation.
- **Multi-mode natif** : le solo et le multi partagent la même base systémique.

## Univers et direction narrative

### Cadre fictionnel

Le monde se situe plusieurs décennies après une guerre totale entre l'humanité et des intelligences artificielles militaires. Les grandes nations ont disparu. Les survivants vivent dans des enclaves fortifiées, des convois mobiles ou des cités-usines improvisées. Les anciennes infrastructures sont en ruine, mais des poches technologiques subsistent.

### Tonalité

La tonalité doit mélanger :

- Désespoir industriel.
- Brutalisme militaire.
- Technologie dégradée.
- Survie organisée.
- Espoir fragile de reconstruction.

Le monde ne doit pas être seulement « gris et cassé ». Il doit aussi être lisible, contrasté et identifiable : néons mourants, métal rouillé, végétation mutante, béton fracturé, interfaces rétro-futuristes, drones, poussière, pluie acide, braises, centrales abandonnées.

### Axe narratif

Le récit doit opposer trois dynamiques :

- Les humains qui veulent reconstruire.
- Les humains qui veulent dominer les restes du monde.
- Les machines qui considèrent toute reconstruction comme une menace.

Cela permet d'avoir à la fois une campagne solo forte et des parties escarmouche cohérentes.

## Piliers de design

### 1. Lisibilité stratégique

Même avec une forte ambiance, le jeu doit rester lisible. Le joueur doit comprendre rapidement :

- Ce qu'il possède.
- Ce qu'il peut produire.
- D'où vient une menace.
- Quel terrain est dangereux.
- Quelles unités dominent un affrontement.

### 2. Pression constante

Le joueur ne doit jamais se sentir en roue libre trop longtemps. Même en phase économique, il doit anticiper :

- Une pénurie.
- Une attaque machine.
- Un raid ennemi.
- Un événement environnemental.
- Un arbitrage technologique.

### 3. Choix significatifs

Chaque décision importante doit avoir un coût d'opportunité :

- Produire plus d'unités ou réparer les infrastructures.
- S'étendre ou fortifier.
- Investir dans la récupération technologique ou dans la survie immédiate.
- Jouer défensif face aux machines ou agressif contre une faction rivale.

### 4. Asymétrie forte

Les factions ne doivent pas simplement partager les mêmes bâtiments avec des statistiques modifiées. Elles doivent proposer de vraies approches différentes du contrôle territorial, de la production et du combat.

## Systèmes de ressources

### Ressources principales

Le jeu peut s'appuyer sur quatre ressources centrales :

| Ressource | Rôle principal | Fonction gameplay |
|---|---|---|
| Ferraille | Construction de base | Bâtiments, murs, réparations, structures défensives |
| Carburant | Mobilité et énergie | Véhicules, générateurs, logistique, certaines armes |
| Eau purifiée | Survie humaine | Population, croissance, maintien de la base |
| Composants électroniques | Technologie avancée | Recherche, drones, piratage, unités avancées |

### Ressources secondaires

Pour enrichir le jeu sans trop le complexifier dès le départ :

- Rations alimentaires.
- Alliages avancés.
- Cellules énergétiques.
- Données récupérées.
- Biomasse mutante.

Ces ressources peuvent être introduites plus tard ou réservées à certaines factions.

### Philosophie économique

L'économie doit être tendue. Les ressources ne doivent pas se résumer à des compteurs abstraits produits à cadence fixe. L'idéal est de créer :

- Des gisements limités.
- Des zones dangereuses mais riches.
- Des chaînes de transformation.
- Des points de friction logistiques.
- Des besoins d'entretien.

### Exemple de chaîne de production

- Déchets métalliques → tri → fonderie → acier recyclé.
- Eau contaminée → purification → eau potable.
- Carcasses électroniques → démontage → composants → modules avancés.
- Biomasse → traitement → rations ou produits chimiques.

## Construction et urbanisme militaire

### Typologie des bâtiments

Les bâtiments peuvent être organisés en grandes familles :

#### Centre de commandement

- QG
- Centre de contrôle
- Nœud de communication

#### Production de ressources

- Récupérateur de ferraille
- Station de pompage
- Raffinerie de carburant
- Démonteur électronique

#### Transformation industrielle

- Fonderie
- Atelier mécanique
- Usine légère
- Usine lourde

#### Militaire

- Caserne
- Atelier d'armement
- Garage blindé
- Tour de défense
- Bunker
- Muraille modulaire

#### Science et technologie

- Laboratoire
- Centre de rétro-ingénierie
- Station de piratage
- Relais radar

#### Soutien et survie

- Purificateur d'eau
- Ferme hydroponique
- Centre médical
- Dépôt logistique
- Générateur

### Logique d'implantation

La base doit ressembler à une forteresse industrielle improvisée, pas à une ville médiévale. Les décisions de placement doivent avoir des conséquences réelles :

- Les générateurs alimentent des zones proches.
- Les tourelles couvrent des angles et choke points.
- Les usines lourdes demandent des accès logistiques.
- Les murs ralentissent sans tout résoudre.
- Les bâtiments critiques attirent les raids.

### Dégradation et maintenance

Un excellent différenciateur consiste à ajouter une logique d'usure :

- Les bâtiments se dégradent dans le temps.
- Les tempêtes et radiations augmentent cette usure.
- Les ingénieurs doivent réparer ou recycler.
- Les bases abandonnées deviennent des sources de loot ou de reprise.

## Factions jouables

### 1. Les Résistants

**Identité** : survivants structurés, polyvalents, récupération technologique.

**Style de jeu** : équilibré, flexible, adaptable.

**Forces** :

- Bonne transition early/mid/late game.
- Capacités de piratage limitées.
- Excellente défense réactive.

**Faiblesses** :

- Peu spécialisés.
- Dépendent d'une bonne micro-gestion des priorités.

### 2. Les Nomades

**Identité** : convois mobiles, campements déployables, guerre d'attrition.

**Style de jeu** : harcèlement, mobilité, économie dispersée.

**Forces** :

- Déplacement rapide.
- Repositionnement stratégique permanent.
- Très bons en raids et récupération opportuniste.

**Faiblesses** :

- Plus fragiles en siège prolongé.
- Faible puissance de fortification.

### 3. Les Fondeurs

**Identité** : cités-usines, industrie lourde, défense bétonnée.

**Style de jeu** : turtle, production massive, domination par l'attrition.

**Forces** :

- Construction rapide des structures lourdes.
- Excellents murs, bunkers et tourelles.
- Très bon late game industriel.

**Faiblesses** :

- Mobilité faible.
- Vulnérables aux frappes rapides et au sabotage.

### 4. Les Cultistes de la Machine

**Identité** : fanatiques techno-religieux, hybridation homme-machine.

**Style de jeu** : contrôle, propagande, effets psychologiques, corruption.

**Forces** :

- Capacité de conversion limitée.
- Synergies fortes avec unités augmentées.
- Accès à des capacités perturbatrices.

**Faiblesses** :

- Courbe d'apprentissage plus élevée.
- Dépendance à des ressources rares.

## Troisième force : les Machines

### Rôle dans le jeu

Les machines ne sont pas juste une faction comme les autres. Elles doivent agir comme une pression systémique globale.

### Fonctions possibles

- Patrouilles autonomes sur certaines zones.
- Réponse punitive en cas de bruit technologique trop élevé.
- Contrôle de secteurs hautement dangereux.
- Défense de bunkers, data centers, usines automatisées et silos.
- Vagues périodiques en mode survie ou en certaines cartes.

### Intérêt design

Cette troisième force apporte plusieurs bénéfices :

- Empêche les ouvertures trop greedies.
- Rend la carte vivante.
- Crée des opportunités tactiques entre joueurs.
- Renforce la fantasy post-apocalyptique.
- Donne une identité très forte au projet.

## Unités

### Catégories principales

#### Infanterie

- Éclaireur
- Récupérateur
- Fusilier
- Sniper
- Ingénieur
- Saboteur
- Médic

#### Véhicules

- Moto ou buggy de reconnaissance
- Camion logistique
- Blindé léger
- Transport de troupes
- Artillerie mobile
- Char lourd artisanal

#### Drones et robots alliés

- Drone éclaireur
- Drone de réparation
- Tourelle mobile
- Exosquelette de combat
- Mech léger de récupération

#### Unités spéciales

- Héros de faction
- Hacker de combat
- Unité furtive
- Commandant de siège
- Hybride homme-machine

### Principes d'équilibrage

Les unités doivent être lisibles par rôle plutôt que par surcharge de statistiques. Chaque unité doit répondre à une fonction claire :

- Reconnaître.
- Tanker.
- Infliger du burst.
- Assurer le siège.
- Soutenir.
- Réparer.
- Contrôler la vision.

## Combat et tactique

### Bases du combat

Le combat doit être semi-réaliste dans ses conséquences tout en restant lisible. Les systèmes les plus intéressants pour ce projet sont :

- Portée réelle des armes.
- Temps d'acquisition de cible.
- Couverture du terrain.
- Différence entre dégâts explosifs, balistiques et énergétiques.
- Ligne de vue.
- Vision partagée ou non selon les factions.

### Couverture et terrain

Le terrain doit avoir un impact fort :

- Ruines : bonus défensif.
- Hauteurs : meilleure vision.
- Boue toxique : ralentissement.
- Zone irradiée : dégâts ou malus progressifs.
- Routes : mobilité accrue.
- Débris épais : couverture et blocage partiel.

### Moral et pression psychologique

Pour donner une identité moderne au RTS, le moral peut devenir une mécanique importante :

- Une unité isolée combat moins bien.
- Une escouade sous tir d'artillerie peut paniquer.
- Certains leaders ou unités spéciales stabilisent le moral.
- Les Cultistes peuvent exploiter des mécaniques de peur ou de conversion.

### Siège et destruction

Le siège doit être spectaculaire et stratégique :

- Les murs ralentissent, mais peuvent être percés.
- L'artillerie ouvre des brèches.
- Les ingénieurs réparent en direct.
- Les bâtiments détruits laissent des carcasses utilisables comme couverture.

## Carte, exploration et contrôle territorial

### Typologie des cartes

Le jeu gagnerait à proposer plusieurs familles de cartes :

- Zones urbaines détruites.
- Déserts industriels.
- Vallées radioactives.
- Centrales abandonnées.
- Périphéries d'anciennes mégapoles.
- Réseaux autoroutiers effondrés.

### Objectifs d'une bonne carte RTS

Chaque carte doit offrir :

- Des points de ressources contestables.
- Des choke points identifiables.
- Des voies de contournement.
- Des zones à haute valeur mais haut risque.
- Une bonne lisibilité isométrique.

### Exploration

Le brouillard de guerre est indispensable. L'exploration peut être renforcée par :

- Des signaux radio interceptables.
- Des caches de survie.
- Des bunkers neutres.
- Des épaves activables.
- Des points de données à sécuriser.

## Technologie et progression

### Arbre technologique

L'arbre de recherche doit proposer des axes lisibles et spécialisés :

- Économie.
- Défense.
- Mobilité.
- Armement.
- Automatisation.
- Piratage.
- Biotech ou augmentation.

### Philosophie

L'arbre technologique doit forcer des choix. Il vaut mieux éviter un design où tout le monde finit par tout débloquer dans chaque partie. Quelques bons principes :

- Branches mutuellement exclusives ou coûteuses.
- Technologies de timing.
- Pics de puissance temporaires.
- Transitions de composition d'armée.

### Progression hors partie

En complément du gameplay pur, il est possible d'ajouter plus tard :

- Déblocages cosmétiques.
- Profils de commandants.
- Archives de campagne.
- Codex du monde.
- Succès.

## Solo et campagne

### Mode escarmouche

Le solo doit déjà fonctionner parfaitement en escarmouche contre IA. Cela permet de valider tous les systèmes de base avant d'écrire une campagne lourde.

### Campagne narrative

La campagne peut suivre un groupe de survivants tentant de reconnecter plusieurs enclaves humaines. Structure recommandée :

- 10 à 14 missions.
- Objectifs variés.
- Introductions progressives des mécaniques.
- Choix scénaristiques légers mais impactants.
- Missions de défense, infiltration, récupération, exode et siège.

### Valeur de la campagne

La campagne ne sert pas seulement à raconter une histoire. Elle sert aussi à :

- Tutoriser intelligemment.
- Donner du contexte aux factions.
- Introduire les machines comme menace structurante.
- Tester des scripts de mission réutilisables ailleurs.

## Multijoueur

### Modes recommandés

- 1v1 compétitif.
- 2v2 en équipe.
- Free-for-all.
- Coop survie contre vagues de machines.
- Éventuellement mode domination territoriale.

### Principes réseau

Le serveur doit être autoritaire. Cela signifie :

- Le client envoie des intentions.
- Le serveur valide les actions.
- Le serveur synchronise l'état de référence.
- Le client interpole et affiche.

### Pourquoi ce point est critique

Pour un RTS ambitieux, la triche, la désynchronisation et les incohérences de simulation deviennent vite destructrices. Mieux vaut assumer tôt une architecture sérieuse que bricoler un mode multi après coup.

## Intelligence artificielle

### IA ennemie solo

L'IA doit être construite comme un vrai système modulaire :

- Gestion de build order.
- Lecture contextuelle de la carte.
- Réaction aux raids.
- Arbitrage entre économie et armée.
- Choix de compositions selon l'ennemi.

### IA des machines

Elle peut suivre une logique différente, plus systémique que "civilisation" :

- Patrouille.
- Détection.
- Escalade.
- Punition.
- Reprise de territoire.

### IA et difficulté

Une bonne difficulté ne doit pas se résumer à des bonus de triche. Il vaut mieux mixer :

- Un comportement plus agressif.
- Une meilleure adaptation.
- Une plus grande vitesse de réaction sur les niveaux élevés.
- Des paramètres contrôlés plutôt qu'une inflation injuste des ressources.

## Interface et expérience utilisateur

### Principes UI

L'interface doit rappeler les grands RTS classiques tout en ayant une identité plus industrielle et tactique :

- Barre supérieure pour ressources et alertes.
- Mini-carte lisible et contrastée.
- Panneau latéral ou bas pour production et sélection.
- Feedback fort sur les alertes critiques.
- Icônes lisibles, peu de texte inutile en combat.

### UX à soigner très tôt

- Sélection d'unités fluide.
- Groupes de contrôle.
- Raccourcis clavier cohérents.
- Files de production visibles.
- Feedback de pathfinding compréhensible.
- Indication claire des zones de portée, d'alimentation ou de danger.

## Direction artistique

### Style visuel

Le style peut viser un rendu :

- 2D isométrique détaillée.
- Industriel, sale, lisible.
- Palette désaturée avec accents néon ou alerte.
- Interfaces rétro-futuristes militaires.
- Effets météo et lumière localisés.

### Cohérence visuelle

Il faut définir très tôt :

- Une palette par biome.
- Une palette par faction.
- Une grammaire visuelle des ressources.
- Une convention claire pour unités alliées, ennemies, neutres et machines.

### Assets à prévoir

- Tilesets terrain.
- Bâtiments par faction.
- Unités par faction.
- Effets d'explosion, fumée, feu, pluie, radiation.
- UI icons.
- Portraits de commandants.
- Écrans de briefing.

## Audio

### Ambiance sonore

L'audio doit soutenir la pression et le monde :

- Vents métalliques.
- Sirènes lointaines.
- Bourdonnements électriques.
- Impacts lourds.
- Radios brouillées.
- Machines en veille ou en chasse.

### Musique

Une bande-son hybride peut fonctionner :

- Pads sombres.
- Percussions industrielles.
- Synthés froids.
- Montée dynamique pendant attaques ou révélations.

## Architecture technique détaillée

### Frontend

- Phaser 4 pour rendu et boucle de jeu.
- TypeScript pour robustesse et scalabilité.
- Vite pour le dev rapide.
- Organisation ECS légère ou architecture modulaire orientée systèmes.

### Backend

- Node.js pour la logique serveur.
- Socket.io pour la synchronisation temps réel.
- Services séparés pour matchmaking, parties, profils et persistance.

### Persistance

- PostgreSQL pour comptes, progression, matchmaking, historique de parties.
- Redis possible plus tard pour files d'attente ou sessions temps réel.

### Organisation modulaire recommandée

- `core/` : boucle, scènes, événements.
- `world/` : cartes, tuiles, navigation, brouillard.
- `entities/` : unités, bâtiments, projectiles.
- `systems/` : économie, combat, production, vision, IA.
- `ui/` : HUD, panneaux, menus.
- `network/` : synchronisation client.
- `server/` : simulation autoritaire.
- `content/` : data de factions, unités, recherches, cartes.

## Phasage de développement

### Phase 1 — Prototype moteur

Objectif : valider la faisabilité du cœur du jeu.

À produire :

- Carte isométrique affichée.
- Caméra avec pan/zoom.
- Une unité sélectionnable et déplaçable.
- Obstacles simples.
- Début de pathfinding.
- UI minimale.

### Phase 2 — Vertical slice jouable

Objectif : obtenir une micro-version réellement fun.

À produire :

- Récolte d'au moins 2 ressources.
- Construction de quelques bâtiments.
- Production de 2 ou 3 unités.
- Ennemi simple.
- Boucle combat/défense.
- Première carte lisible.

### Phase 3 — Base solo solide

Objectif : transformer le slice en vrai RTS solo.

À produire :

- Faction complète n°1.
- IA ennemie compétente.
- Arbre technologique de base.
- Économie stable.
- HUD structuré.
- Sauvegarde locale ou de session.

### Phase 4 — Deuxième faction et asymétrie

Objectif : commencer l'identité profonde du jeu.

À produire :

- Faction n°2.
- Différences systémiques réelles.
- Équilibrage initial.
- Nouvelles cartes.

### Phase 5 — Multijoueur initial

Objectif : faire fonctionner des parties simples à plusieurs.

À produire :

- Lobby.
- Synchronisation d'ordres.
- Serveur autoritaire.
- 1v1 jouable.
- Gestion de reconnexion minimale.

### Phase 6 — Contenu, campagne, polish

Objectif : passer d'un jeu fonctionnel à un vrai jeu complet.

À produire :

- Campagne.
- Plus de factions.
- Plus d'unités.
- Plus de cartes.
- Sound design.
- Effets visuels.
- Onboarding.
- Équilibrage.

## Priorités absolues

Pour éviter de se perdre dans l'ambition, voici l'ordre des vraies priorités :

1. Mouvement et sélection agréables.
2. Lecture visuelle propre de la carte isométrique.
3. Boucle économie → production → combat.
4. IA suffisamment crédible.
5. Une faction très bien faite avant d'en faire quatre.
6. Réseau autoritaire dès qu'on entre dans le multijoueur.

## Risques principaux

### Risque 1 — Scope trop grand

Le plus grand danger est de vouloir trop de factions, trop d'unités, trop de systèmes et trop de contenu trop tôt.

### Risque 2 — Multijoueur trop précoce ou trop tardif

Le multi est difficile. Le repousser trop loin peut forcer une réécriture majeure. Le traiter trop tôt peut bloquer la validation du fun. Il faut une stratégie intermédiaire : architecture pensée pour le multi, mais validation d'abord sur un solo propre.

### Risque 3 — Illisibilité isométrique

Un RTS isométrique post-apo peut vite devenir brouillon si les silhouettes, les contrastes et les priorités visuelles ne sont pas maîtrisés.

### Risque 4 — IA faible

Si l'IA solo est mauvaise, tout l'intérêt du mode escarmouche s'effondre. Elle doit être un pilier du projet, pas un ajout tardif.

## Positionnement de production

### Ce qu'est le projet

- Un RTS web ambitieux.
- Un jeu post-apocalyptique lisible et systémique.
- Un produit à forte identité, solo + multi.
- Un projet "entièrement vibe codé" mais structuré sérieusement.

### Ce que le projet ne doit pas être

- Un clone paresseux d'Age of Empires avec un skin futuriste.
- Une démo technique de rendu iso sans profondeur stratégique.
- Un sandbox sans pression ni objectifs.
- Un projet qui s'effondre sous son propre scope.

## Cap cible du premier vrai milestone

Le premier vrai milestone pertinent n'est pas "avoir plein d'idées" mais obtenir ceci :

- Une carte isométrique jouable.
- Une faction jouable de bout en bout.
- Récolte, construction, production, combat.
- Une IA machine basique mais menaçante.
- Une partie solo courte déjà fun.

Quand ce milestone existe, le reste devient un travail d'expansion, d'équilibrage et de contenu.

## Prochaine étape logique

La prochaine étape de travail n'est pas encore le code de production final, mais la formalisation complète du **Game Design Document**. Ce document devra détailler précisément :

- Le core loop.
- Les factions.
- Les ressources.
- Les unités.
- Les bâtiments.
- Les tech trees.
- Les modes de jeu.
- Les règles réseau.
- La roadmap de production.

Ce plan constitue donc la base stratégique du projet. La suite logique consistera à transformer cette vision en un document de conception ultra détaillé, puis en roadmap technique exécutable.
