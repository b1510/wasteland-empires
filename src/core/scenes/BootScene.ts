import Phaser from "phaser";

/**
 * Scène de démarrage minimale — valide que la stack Phaser 4 tourne.
 * À remplacer par le chargement d'assets puis la scène de jeu en Phase 1.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2, "WASTELAND EMPIRES", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#c9a227",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 48, "Phaser 4 — stack opérationnelle", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#5a5a5a",
      })
      .setOrigin(0.5);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }

  private handleResize(): void {
    this.scene.restart();
  }
}
