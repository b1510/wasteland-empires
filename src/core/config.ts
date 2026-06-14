import Phaser from "phaser";
import { GameScene } from "@/core/scenes/GameScene";

/**
 * Configuration globale du jeu (Phaser 4).
 * Le rendu WebGL active le nouveau moteur RenderNode / Sprite GPU Layer.
 */
export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: "game",
  backgroundColor: "#0a0a0a",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: "100%",
    height: "100%",
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: [GameScene],
};
