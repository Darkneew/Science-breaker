import Player from "./player.js";
import Map from "./map.js"

export default class MainScene extends Phaser.Scene {
    
    preload() { // loading function
        
        /* background and ground*/
        this.load.image("bg", "../assets/backgrounds/background1.png");
        this.load.image("tileset","../assets/backgrounds/tileset.png");

        /* spritesheets */
        this.load.spritesheet(
            "player",
            "./assets/spritesheets/player.png",
            {
                frameWidth: 32,
                frameHeight: 32,
                margin: 1,
                spacing: 2
            }
        );
        this.load.image("plateform","../assets/spritesheets/plateform.png");
        this.load.image("laser","../assets/spritesheets/laser.png");
        this.load.image("gadget","../assets/spritesheets/gadget.png");

        /* tilemaps */
        this.load.json('db', "../assets/tilemaps/blocks.json");
    }

    create() { // intialization function
        /* creating the map */
        this.db = this.cache.json.get('db');
        this.map = new Map(this);
        this.add.tileSprite(0, this.map.currentBlock.block.height * 16 - 256, this.map.currentBlock.block.width * 16, 256, "bg").setOrigin(0, 0);
        const tilemap = this.make.tilemap({
            tileWidth: 16,
            tileHeight: 16,
            width: this.map.currentBlock.block.width,
            height: this.map.currentBlock.block.height
        });
        const tileset = tilemap.addTilesetImage("tileset", null, 16, 16, 0, 0);
        this.background = tilemap.createBlankDynamicLayer("background", tileset);
        this.ground = tilemap.createBlankDynamicLayer("ground", tileset).setDepth(7);
        this.foreground = tilemap.createBlankDynamicLayer("foreground", tileset).setDepth(9);

        /* setting up player */
        this.player = new Player(this, 350, 400);

        /* drawing the map */
        this.map.drawBlock();
        this.ground.setCollisionByExclusion([35]);
        this.matter.world.convertTilemapLayer(this.ground);
        this.matter.world.setBounds(0, 0, this.map.currentBlock.block.width * 16, this.map.currentBlock.block.height * 16);

        /* setting up camera */
        this.cameras.main.setBounds(0, 0, this.map.currentBlock.block.width * 16, this.map.currentBlock.block.height * 16);
        this.cameras.main.setZoom(2);
        this.cameras.main.startFollow(this.player.sprite, false, 0.1, 0.1);

        /* making the buttons */
        this.sleeping = false;
        const pauseScene = () => {
            if (this.sleeping) {
                this.sleeping = false;
                document.getElementById("pause").style.backgroundImage = "url('./assets/HUD/pause.png')";
                this.scene.wake();
            } else {
                this.sleeping = true;
                document.getElementById("pause").style.backgroundImage = "url('./assets/HUD/unpause.png')";
                this.scene.sleep()
            }
        };
        document.getElementById("pause").onclick = () => {pauseScene()};

        /* end loading */
        document.getElementById("loading").style.animation ="fadeOut ease 4s";
        setTimeout(()=>{document.getElementById("loading").style.display ="none"}, 1900 );
    }
}
