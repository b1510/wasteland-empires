/**
 * Catalogue data-driven des ressources récoltables (Phase 2).
 *
 * Chaque gisement (ResourceNode dans la scène) référence un de ces types pour son
 * sprite, son échelle d'affichage et son compteur HUD. `flat` = tuile posée à plat
 * (mare) : origine centrée, pas d'objet « debout » avec une base.
 */

export type ResourceType = "scrap" | "fuel" | "water";

export interface ResourceDef {
  type: ResourceType;
  label: string;
  icon: string;
  /** Couleur du compteur dans le HUD. */
  color: string;
  /** Texture chargée dans la scène. */
  assetKey: string;
  /** Échelle d'affichage de base (pleine quantité). */
  scale: number;
  ox: number;
  oy: number;
  flat?: boolean;
}

export const RESOURCES: Record<ResourceType, ResourceDef> = {
  scrap: {
    type: "scrap",
    label: "Ferraille",
    icon: "⛏",
    color: "#e8c46a",
    assetKey: "scrap",
    scale: 0.45,
    ox: 0.499,
    oy: 0.576,
  },
  fuel: {
    type: "fuel",
    label: "Carburant",
    icon: "⛽",
    color: "#ffd24d",
    assetKey: "fuel",
    scale: 0.6,
    ox: 0.5,
    oy: 0.78,
  },
  water: {
    type: "water",
    label: "Eau",
    icon: "💧",
    color: "#6ad0ff",
    assetKey: "water",
    scale: 0.26,
    ox: 0.5,
    oy: 0.52,
    flat: true,
  },
};

export const RESOURCE_TYPES = Object.keys(RESOURCES) as ResourceType[];
