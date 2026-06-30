/**
 * Réglages data-driven de l'IA ennemie (Phase 2).
 *
 * Modèle simple mais crédible (priorité #4 du plan : « IA suffisamment crédible ») :
 *  - un budget de ferraille s'accumule (revenu passif, montant avec les vagues) ;
 *  - le QG ennemi achète des unités dans `composition` tant qu'il peut payer ;
 *  - périodiquement, toutes les unités en réserve partent en VAGUE vers le QG joueur ;
 *  - la taille des vagues et le revenu croissent à chaque vague (pression montante).
 *
 * Le but n'est pas une IA optimale mais un adversaire qui met une pression lisible et
 * progressive, suffisante pour rendre le vertical slice tendu et fun.
 */

/** Réglages de la posture défensive de l'IA (garnison + tourelles). */
export interface EnemyDefenseConfig {
  /**
   * Fraction de la réserve gardée au campement quand une vague part (0 = tout
   * envoyer, 0.4 = 40 % restent défendre). Ces unités défendent passivement le QG
   * (aggro auto) au lieu de laisser la base sans garde après chaque assaut.
   */
  garrisonRatio: number;
  /** Effectif minimal toujours laissé en garnison une fois ce nombre d'unités atteint. */
  minGarrison: number;
  /** Nombre maximal de tourelles que l'IA construira autour de son QG. */
  maxTurrets: number;
  /** Revenu dédié à la défense (ferraille/seconde), séparé du budget d'unités. */
  fundPerSec: number;
  /** Rayon (en cases) autour du QG dans lequel l'IA cherche un emplacement de tourelle. */
  turretRadius: number;
}

export interface EnemyAIConfig {
  /** Délai avant que l'IA ne commence à produire/attaquer (ms). */
  startDelay: number;
  /** Revenu de ferraille de base (par seconde). */
  budgetPerSec: number;
  /** Revenu supplémentaire par vague déjà lancée (par seconde). */
  budgetGrowthPerWave: number;
  /** Effectif de la première vague. */
  firstWaveSize: number;
  /** Unités ajoutées à l'effectif cible à chaque vague suivante. */
  waveSizeGrowth: number;
  /** Plafond d'effectif d'une vague (évite l'emballement). */
  maxWaveSize: number;
  /** Intervalle entre deux vagues (ms). */
  waveInterval: number;
  /**
   * Composition achetée, par ordre de préférence. À chaque cycle d'achat, l'IA tente
   * d'acheter la première unité de cette liste qu'elle peut payer (les plus chères
   * d'abord = meilleur usage du budget).
   */
  composition: string[];
  /** Posture défensive (garnison + tourelles autour du QG). */
  defense: EnemyDefenseConfig;
}

export const ENEMY_AI: EnemyAIConfig = {
  startDelay: 70000,
  budgetPerSec: 4,
  budgetGrowthPerWave: 1.2,
  firstWaveSize: 2,
  waveSizeGrowth: 1,
  maxWaveSize: 12,
  waveInterval: 55000,
  composition: ["heavy", "rifle", "scout"],
  defense: {
    garrisonRatio: 0.35,
    minGarrison: 2,
    maxTurrets: 3,
    fundPerSec: 3,
    turretRadius: 4,
  },
};
