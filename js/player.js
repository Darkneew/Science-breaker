 class Key {
  constructor(scene, keys) {
    if (!Array.isArray(keys)) keys = [keys];
    this.keys = keys.map(key => scene.input.keyboard.addKey(key));
  }

  // Are any of the keys down?
  isDown() {
    return this.keys.some(key => key.isDown);
  }

  // Are all of the keys up?
  isUp() {
    return this.keys.every(key => key.isUp);
  }
}

export default class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        // Setting animations
        const anims = scene.anims;
        anims.create({
            key: "player-idle",
            frames: anims.generateFrameNumbers("player", { start: 0, end: 3 }),
            frameRate: 3,
            repeat: -1
        });
        anims.create({
            key: "player-run",
            frames: anims.generateFrameNumbers("player", { start: 8, end: 15 }),
            frameRate: 12,
            repeat: -1
        });
        anims.create({
            key: "player-idle-slow",
            frames: anims.generateFrameNumbers("player", { start: 0, end: 3 }),
            frameRate: 1,
            repeat: -1
        });
        anims.create({
            key: "player-run-slow",
            frames: anims.generateFrameNumbers("player", { start: 8, end: 15 }),
            frameRate: 4,
            repeat: -1
        });

        // Creating the player
        this.sprite = scene.matter.add.sprite(0, 0, "player", 0);
        const { Body, Bodies } = Phaser.Physics.Matter.Matter; 
        const { width: w, height: h } = this.sprite;
        const mainBody = Bodies.rectangle(0, 0, w * 0.6, h, { chamfer: { radius: 5 } });
        this.sensors = {
            bottom: Bodies.rectangle(0, h * 0.5, w * 0.25, 2, { isSensor: true }),
            left: Bodies.rectangle(-w * 0.35, 0, 2, h * 0.5, { isSensor: true }),
            right: Bodies.rectangle(w * 0.35, 0, 2, h * 0.5, { isSensor: true })
        };
        const compoundBody = Body.create({
            parts: [mainBody, this.sensors.bottom, this.sensors.left, this.sensors.right],
            mass:2,
            frictionStatic: 0,
            frictionAir: 0.002,
            friction: 0.004
        });
        this.sprite
        .setExistingBody(compoundBody)
        .setScale(0.5)
        .setFixedRotation()
        .setPosition(x, y)
        .setDepth(8);
        
        // Creating sensors
        this.isTouching = { left: false, right: false, ground: false };
        this.canJump = true;
        this.turnedRight = true;
        this.jumpCooldownTimer = null;
        scene.matter.world.on("beforeupdate", this.resetTouching, this);
        scene.matterCollision.addOnCollideStart({
            objectA: [this.sensors.bottom, this.sensors.left, this.sensors.right],
            callback: this.onSensorCollide,
            context: this
        });
        scene.matterCollision.addOnCollideActive({
            objectA: [this.sensors.bottom, this.sensors.left, this.sensors.right],
            callback: this.onSensorCollide,
            context: this
        });

        /* handling keys */
        const { LEFT, RIGHT, UP, A, D, W, Z, Q, G, H, T, M } = Phaser.Input.Keyboard.KeyCodes;
        
        /* Handling events */
        this.destroyed = false;
        this.scene.events.on("update", this.update, this);
        this.scene.events.once("shutdown", this.destroy, this);
        this.scene.events.once("destroy", this.destroy, this);
        this.leftInput = new Key(scene, [LEFT, A, Q]);
        this.rightInput = new Key(scene, [RIGHT, D]);
        this.jumpInput = new Key(scene, [UP, W, Z]);
        this.gravityInput = new Key(scene, [G]);
        this.weakInput = new Key(scene, [H]);
        this.timeInput = new Key(scene, [T]);
        this.magnetismInput = new Key(scene, [M]);

        this.hasGadgets = {
            gravity: true,
            time: true,
            magnetism: true,
            weak: true
        };
        this.isGraviting = false;
        this.hasWeakened = false;
        this.slowedTime = false;
        this.magneting = false;
    }

    onSensorCollide({ bodyA, bodyB, pair }) {
        if (bodyB.isSensor) return;
        if (bodyA === this.sensors.left) {
            this.isTouching.left = true;
            if (pair.separation > 0.5) this.sprite.x += pair.separation - 0.8;
        } else if (bodyA === this.sensors.right) {
            this.isTouching.right = true;
            if (pair.separation > 0.5) this.sprite.x -= pair.separation - 0.8;
        } else if (bodyA === this.sensors.bottom) {
            this.isTouching.ground = true;
        }
    }

    resetTouching() {
        this.isTouching.left = false;
        this.isTouching.right = false;
        this.isTouching.ground = false;
    }

    freeze() {
        this.sprite.setStatic(true);
    }

    unfreeze() {
        this.sprite.setStatic(false);
    }

    update(time, delta) {
        if (Number.isNaN(this.sprite.x) || Number.isNaN(this.sprite.y)) {
            this.sprite.setX(this.scene.map.currentBlock.block.respawn[0] *16 + 8);
            this.sprite.setX(this.scene.map.currentBlock.block.respawn[1] *16 + 8);
        }
        /* redeclaring local variables */
        const sprite = this.sprite;
        const velocity = sprite.body.velocity;
        const isRightKeyDown = this.rightInput.isDown();
        const isLeftKeyDown = this.leftInput.isDown();
        const isJumpKeyDown = this.jumpInput.isDown();
        const isOnGround = this.isTouching.ground;
        const isInAir = !isOnGround;
        const timefactor = this.slowedTime ? 0.3 : 1;
        /* gravity gadget */
        if (this.gravityInput.isDown() && this.hasGadgets.gravity && !this.isGraviting)  {
            sprite.setIgnoreGravity(true)
            this.isGraviting = true;
        } else if (!this.gravityInput.isDown() && this.isGraviting) {
            sprite.setIgnoreGravity(false);
            this.isGraviting = false;
        }

        /* weak force gadget */
        if (this.weakInput.isDown() && this.hasGadgets.weak && !this.hasWeakened) {
            this.hasWeakened = true;
            this.scene.map.currentBlock.barrils.forEach(barril => {
                this.scene.ground.getTileAt(barril.x, barril.y).physics.matterBody.destroy();
                this.scene.ground.putTileAt(35, barril.x, barril.y);                
            });
        };

        /* time gadget */
        if (this.timeInput.isDown() && this.hasGadgets.time && !this.slowedTime)  {
            this.slowedTime = true;
            this.scene.matter.world.engine.timing.timeScale = 0.3;
            this.scene.anims.globalTimeScale = 100;
        } else if (!this.timeInput.isDown()  && this.slowedTime) {
            this.slowedTime = false;
            this.scene.matter.world.engine.timing.timeScale = 1;
            this.scene.anims.globalTimeScale = 1;
        }

        /* magnetism gadget */ 
        if (this.magnetismInput.isDown() && this.hasGadgets.magnetism)  {
            this.scene.map.currentBlock.plateforms.forEach(plateform => {
                let xdiff = (sprite.x - plateform.x);
                let ydiff = (sprite.y - plateform.y);
                let dist = Math.sqrt(xdiff**2 + ydiff**2);
                if (dist < 32) return;
                xdiff /= dist**2;
                ydiff /= dist**2;
                if (this.slowedTime)  {
                    xdiff *= 3;
                    ydiff *= 3;
                };
                plateform.applyForce({x:xdiff, y:ydiff});
            })
        }

        /* horizontal movement */
        let moveForce = isOnGround ? 0.0021 : 0.002;
        if (this.slowedTime) moveForce *= 3;
        if (isLeftKeyDown && !this.isGraviting) {
            sprite.setFlipX(true);
            this.turnedRight = false;
            if (!(isInAir && this.isTouching.left)) sprite.applyForce({ x: -moveForce, y: 0 })
        } else if (isRightKeyDown && !this.isGraviting) {
            sprite.setFlipX(false);
            this.turnedRight = true;
            if (!(isInAir && this.isTouching.right)) sprite.applyForce({ x: moveForce, y: 0 })
        }
        if (isOnGround && this.turnedRight && velocity.x < 0) sprite.setVelocityX(0);
        if (isOnGround && !this.turnedRight && velocity.x > 0) sprite.setVelocityX(0);
        if (velocity.x > 0.9 * timefactor) sprite.setVelocityX(0.9 * timefactor);
        else if (velocity.x < -0.9 * timefactor) sprite.setVelocityX(-0.9 * timefactor);
        if (velocity.y > 5.6 * timefactor) sprite.setVelocityY(5.6 * timefactor);
        else if (velocity.y < -5.6 * timefactor) sprite.setVelocityY(-5.6 * timefactor);

        /* vertical movement */
        if (isJumpKeyDown && this.canJump && isOnGround && !this.isGraviting) {
            sprite.setVelocityY(-5.6 * timefactor);
            this.canJump = false;
            this.jumpCooldownTimer = this.scene.time.addEvent({
                delay: 250,
                callback: () => (this.canJump = true)
            });
        }

        if (isOnGround) {
            let slowed = this.slowedTime ? "-slow" : ""
            if (sprite.body.force.x !== 0) sprite.anims.play("player-run" + slowed, true);
            else sprite.anims.play("player-idle" + slowed, true);
        } else {
            sprite.anims.stop();
            sprite.setTexture("player", 10);
        }

        /* changing block */ 
        if (sprite.x < 7 && this.scene.map.currentBlock.block.left) {
            let pos = sprite.y - this.scene.map.currentBlock.block.left * 16;
            this.scene.map.changeBlock("left");
            this.hasWeakened = false;
            sprite.setX(this.scene.map.currentBlock.block.width * 16 - 10);
            sprite.setY(this.scene.map.currentBlock.block.right * 16 + pos);
        }
        else if (sprite.x > this.scene.map.currentBlock.block.width * 16 - 7 && this.scene.map.currentBlock.block.right) {
            let pos = sprite.y - this.scene.map.currentBlock.block.right * 16;
            this.scene.map.changeBlock("right");
            this.hasWeakened = false;
            sprite.setX(10);
            sprite.setY(this.scene.map.currentBlock.block.left * 16 + pos);
        }
        else if (sprite.y < 9 && this.scene.map.currentBlock.block.top) {
            let pos = sprite.x - this.scene.map.currentBlock.block.top * 16;
            this.scene.map.changeBlock("top");
            this.hasWeakened = false;
            sprite.setY(this.scene.map.currentBlock.block.height * 16 - 12);
            sprite.setX(this.scene.map.currentBlock.block.bottom * 16 + pos);
        }
        else if (sprite.y > this.scene.map.currentBlock.block.height * 16 - 9 && this.scene.map.currentBlock.block.bottom) {
            let pos = sprite.x - this.scene.map.currentBlock.block.bottom * 16;
            this.scene.map.changeBlock("bottom");
            this.hasWeakened = false;
            sprite.setY(12);
            sprite.setX(this.scene.map.currentBlock.block.top * 16 + pos);
        }
    }

    destroy() {
        // Clean up any listeners that might trigger events after the player is officially destroyed
        this.scene.events.off("update", this.update, this);
        this.scene.events.off("shutdown", this.destroy, this);
        this.scene.events.off("destroy", this.destroy, this);
        if (this.scene.matter.world) {
        this.scene.matter.world.off("beforeupdate", this.resetTouching, this);
        }
        const sensors = [this.sensors.bottom, this.sensors.left, this.sensors.right];
        this.scene.matterCollision.removeOnCollideStart({ objectA: sensors });
        this.scene.matterCollision.removeOnCollideActive({ objectA: sensors });
        if (this.jumpCooldownTimer) this.jumpCooldownTimer.destroy();

        this.destroyed = true;
        this.sprite.destroy();
    }
} 