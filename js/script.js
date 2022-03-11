import MainScene from "./scene.js";

window.onload = () => {
    const config = { // game configuration
        type: Phaser.AUTO, 
        parent: document.getElementById("container"),
        width: window.innerWidth-30,
        height: window.innerHeight-30,
        scene: MainScene,
        pixelArt: true,
        backgroundColor: "#404351",
        physics: {
            default: "matter",
            matter: {
                gravity: { y: 0.9 },
                enableSleep: true//,
                //debug: true
            }
        },
        plugins: {
            scene: [
                {
                    plugin: PhaserMatterCollisionPlugin,
                    key: "matterCollision",
                    mapping: "matterCollision"
                }
            ]
        }
    };
    const game = new Phaser.Game(config); // launch the game
    window.focus()
}