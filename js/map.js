function pseudorandom (w, n = 1, x = 1103515245, y = 12345, z = 32768, t = 65536) {
    if (n==1) return (Math.floor(((w+1)*x + y)/t)) % z
    else return pseudorandom(Math.floor(((w+1)*x + y)/t) % z, n-1, x, y, z,t);
};

class Block {
    constructor (map, id, directionFrom, prevBlock, block = false) {
        this.left = null;
        this.right = null;
        this.top = null;
        this.bottom = null;
        this.map = map;
        this[directionFrom] = prevBlock;
        this.id = id;
        this.type = this.getBlockTypeFromPhase(this.map, pseudorandom(id, 1, (this.map.seed % 37) *57, 37, 100));
        let poss = map.scene.db.blocks[this.type].filter(block => block[directionFrom]);
        this.block = block? block : poss[pseudorandom(this.map.seed * 337 + id *101)%poss.length];
    }

    getBlockTypeFromPhase (map, nb) {
        // take the phase and a number from 0 to 99 and return the blocktype 
        let weights = [60, 30, 3, 3, 3, 3] //, 1]
        //if (map.gadgetsLeft.length == 0) {
        //    weights[6] += 30;
        //    weights[1] -= 30;
        //}
        if (!("magnetism" in map.gadgetsLeft)) {weights[2] += 20; weights[0] += 10;}
        if (!("gravity" in map.gadgetsLeft)) {weights[4] += 20; weights[0] += 10;}
        if (!("weak" in map.gadgetsLeft)) {weights[3] += 20; weights[0] += 10;}
        if (!("time" in map.gadgetsLeft)) {weights[5] += 20; weights[0] += 10;}
        let total = weights.reduce((a, b) => a + b);
        let semitot = -0.1;
        let i = -1
        while (semitot < nb) {
            i++;
            semitot += weights[i] / total;
        }
        return i;
    }
}

export default class Map {
    constructor (scene) {
        //this.gadgetsLeft = ["magnetism", "time", "weak", "gravity"];
        this.gadgetsLeft = [];
        this.id = 1;
        this.canDie = true;
        this.scene = scene;
        this.seed = Math.floor(Math.random()*256);
        this.currentBlock = new Block(this, 1, "right", null, this.scene.db.tutorial);
    }

    oppositeDirection (direction) {
        switch (direction) {
            case "left": return "right";
            case "right": return "left";
            case "top": return "bottom";
            case "bottom": return "top";
        }
    }

    changeBlock (directionTo) {
        this.scene.ground.forEachTile(tile => {
            if (tile.physics.matterBody != undefined) tile.physics.matterBody.destroy();
        });
        this.currentBlock.plateforms.forEach(plateform => {
            plateform.destroy();
        });
        this.currentBlock.gadgets.forEach(gadget => {
            if (!gadget) return;
            gadget[0].destroy();
            this.scene.matter.world.remove(gadget[1]);
        });
        this.currentBlock.texts.forEach(text => {
            text.destroy();
        });
        this.currentBlock.lasers.forEach(laser => {
            laser[0].destroy();
            this.scene.matter.world.remove(laser[1]);
        });
        if (this.currentBlock[directionTo] == null) {
            this.currentBlock[directionTo] = new Block (this, ++this.id, this.oppositeDirection(directionTo), this.currentBlock);
        }
        this.currentBlock = this.currentBlock[directionTo];
        this.drawBlock();
        this.scene.ground.setCollisionByExclusion([35]);
        this.scene.matter.world.convertTilemapLayer(this.scene.ground);
        this.scene.matter.world.setBounds(0, 0, this.currentBlock.block.width * 16, this.currentBlock.block.height * 16);
    }

    drawBlock() {
        this.currentBlock.barrils = [];
        this.currentBlock.plateforms = [];
        this.currentBlock.lasers = [];
        this.currentBlock.texts = [];
        this.currentBlock.gadgets = [];
        for (let i = 0; i < this.currentBlock.block.height; i++) {
            for (let j = 0; j < this.currentBlock.block.width; j++) {
                let groundTile = this.currentBlock.block.ground[i][j] == 0? 35 : this.currentBlock.block.ground[i][j] - 1;
                let foregroundTile = this.currentBlock.block.foreground[i][j] == 0? 35 : this.currentBlock.block.foreground[i][j] - 1;
                let backgroundTile = this.currentBlock.block.background[i][j] == 0? 35 : this.currentBlock.block.background[i][j] - 1;
                this.scene.foreground.putTileAt(foregroundTile, j, i);
                this.scene.background.putTileAt(backgroundTile, j, i);
                if ((groundTile > 2 && groundTile < 9) || (groundTile > 11 && groundTile < 18)) {
                    this.scene.ground.putTileAt(groundTile, j, i);
                    this.currentBlock.barrils.push({
                        x: j,
                        y: i
                    });
                } else this.scene.ground.putTileAt(groundTile, j, i);
            }
        }
        this.currentBlock.block.objects.forEach(object => {
            switch (object.name) {
                case "gadget":
                    let gadget = this.scene.add.image(object.x, object.y, "gadget");
                    let gadgetCol = this.scene.matter.add.rectangle(
                        object.x,
                        object.y,
                        20,
                        20,
                        {isSensor: true, isStatic: true}
                    );
                    this.scene.matterCollision.addOnCollideStart({
                        objectA: gadgetCol,
                        objectB: this.scene.player.sprite,
                        callback: ({gameObjectB}) => {
                            if (!gameObjectB) return;
                            this.currentBlock.gadgets = false;
                            gadget.destroy();
                            this.scene.matter.world.remove(gadgetCol);
                        }
                    });
                    this.currentBlock.gadgets.push([gadget, gadgetCol]);
                    break;
                case "plateform":
                    let sprite = this.scene.matter.add.sprite(object.x + 24, object.y - 5, "plateform");
                    sprite.setBody({type:"rectangle"},{ shape: "rectangle", frictionAir: 0.05, mass:100});
                    sprite.setIgnoreGravity(true).setFixedRotation();
                    this.currentBlock.plateforms.push(sprite);
                    break;
                case "text": 
                    let text = this.scene.add.text(object.x, object.y, object.text, {
                        color:'#FFFFFF',
                        fontFamily:"monospace",
                        fontSize:"12px",
                        padding: { x: 8, y: 4 },
                        backgroundColor: "#000000"
                    }).setDepth(0);
                    this.currentBlock.texts.push(text);
                    break;
                case "laser":
                    let w = object.width;
                    let h = object.height;
                    let x = object.x + object.width / 2;
                    let y = object.y + object.height / 2;
                    let laser;
                    if (w > h) {
                        w = Math.floor(w / 16 + 0.2) * 16;
                        h = 10;
                        laser = this.scene.add.tileSprite(x, y, w, h, "laser");
                    } else {
                        h = Math.floor(h / 16 + 0.2) * 16;
                        w = 10;
                        laser = this.scene.add.tileSprite(x, y, h, w, "laser");
                        laser.setRotation(Math.PI / 2);
                    }
                    let laserCol = this.scene.matter.add.rectangle(
                        object.x + object.width / 2,
                        object.y + object.height / 2,
                        object.width,
                        object.height,
                        {isSensor: true, isStatic: true}
                    );
                    this.scene.matterCollision.addOnCollideStart({
                        objectA: laserCol,
                        objectB: this.scene.player.sprite,
                        callback: ({gameObjectB}) => {
                            if (!gameObjectB) return;
                            if (!this.canDie) return;
                            this.canDie = false;
                            this.scene.cameras.main.fadeOut(1500, 0, 0, 0);
                            this.scene.player.freeze();
                            setTimeout(() => {this.canDie = true}, 2000);
                            this.scene.cameras.main.once("camerafadeoutcomplete", () => {
                                this.scene.player.sprite.setX(this.currentBlock.block.respawn[0] * 16 + 8);
                                this.scene.player.sprite.setY(this.currentBlock.block.respawn[1] *16 + 8);
                                this.scene.cameras.main.fadeIn(500, 0, 0, 0);this.scene.player.unfreeze();
                            });
                        }
                    });
                    this.currentBlock.lasers.push([laser, laserCol]);
                    break;
            }
        });
    }
}