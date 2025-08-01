class Game {
    constructor() {
        this.canvas = document.getElementById("board");
        this.ctx = this.canvas.getContext("2d");
        this.menu = new Menu(this);

        this.hp_container = document.getElementById('life-points');

        this.asteroidsMinSize = 30;
        this.reset();

        window.onresize = () => {
            this.resize();
        }

        this.inputBuffer = [];

        if (isMobileDevice()) {
            this.touchInputSetup();
        } else {
            this.mkInputSetup();
        }

        this.requestId = window.requestAnimationFrame(this.update.bind(this));
        this.running = true;

        PowerUp.loadImages();
    }

    mkInputSetup() {
        // input manager
        window.addEventListener('keydown', (event) => {
            if (this.inputBuffer.indexOf(event.key) == -1) {
                this.inputBuffer.push(event.key);
            }

            if (event.key == 'Escape') {
                if (this.player) {
                    if (this.running) {
                        this.stop();
                        this.menu.open('Resume');
                    } else {
                        this.menu.close();
                        this.start();
                    }
                } else {
                    if (this.menu.avoidReset) {
                        this.start();
                        this.menu.close();
                    }
                    // do nothing if game is not started (= player not present)
                }
            }
        });

        window.addEventListener('keyup', (event) => {
            if (this.inputBuffer.indexOf(event.key) != -1) {
                this.inputBuffer.splice(this.inputBuffer.indexOf(event.key), 1);
            }
        });
    }

    touchInputSetup() {
        this.touchInputs = [
            {
                elem: document.getElementById('touch-up'),
                value: 'w'
            },
            {
                elem: document.getElementById('touch-down'),
                value: 's'
            },
            {
                elem: document.getElementById('touch-left'),
                value: 'a'
            },
            {
                elem: document.getElementById('touch-right'),
                value: 'd'
            }
        ]

        window.addEventListener('touchstart', (event) => {
            const selectedInput = this.touchInputs.find(i => i.elem == event.target)
            if(!selectedInput) return;
            if (this.inputBuffer.indexOf(selectedInput.value) < 0){
                this.inputBuffer.push(selectedInput.value);
            }
        })

        window.addEventListener('touchend', (event) => {
            const selectedInput = this.touchInputs.find(i => i.elem == event.target)
            if(!selectedInput) return;
            if (this.inputBuffer.indexOf(selectedInput.value) > -1){
                this.inputBuffer.splice(this.inputBuffer.indexOf(selectedInput.value), 1);
            }
        })

        // always shooting 
        this.inputBuffer.push(' ')
    }

    endGame() {
        this.player = null;
        this.menu.open();
    }

    stop() {
        if (this.touchInputs) {
            this.touchInputs.forEach(t => t.elem.classList.add('hidden'));
        }
        if (!this.running && this.requestId == null) {
            console.log('Already stopped!')
            return;
        }
        window.cancelAnimationFrame(this.requestId);
        this.requestId = null;
        this.running = false;
        console.log('game stopped!');
    }

    start() {
        if (!this.running && this.requestId == null) {
            this.requestId = requestAnimationFrame(this.update.bind(this));
            this.running = true;
            console.log('game started!');
            return;
        }
        console.log('failed to start');
    }

    resize() {
        this.canvas.width = (document.documentElement.clientWidth || document.body.clientWidth);
        this.canvas.height = (document.documentElement.clientHeight || document.body.clientHeight) - 25;
    }

    addAsteroid() {
        let asteroid = new Asteroid(this);
        // controllo che l'asteroide non sia stato creato troppo vicino al giocatore
        while (this.asteroids.length < this.asteroidsNumber) {
            asteroid = new Asteroid(this);

            if (!this.player || Math.pow(asteroid.shapeObj.centerX - this.player.shapeObj.centerX, 2) + Math.pow(asteroid.shapeObj.centerY - this.player.shapeObj.centerY, 2) > Math.pow(this.safeRadius, 2)) {
                this.asteroids.push(asteroid);
            }
        }

    }

    updateLifePoints(points) {
        points = points != undefined ? points : this.player.hp;

        // add if needed
        while (points > this.hp_container.children.length) {
            let hp = document.createElement('div');
            hp.classList = 'hp';

            this.hp_container.appendChild(hp);
        }

        // remove if needed
        while (points < this.hp_container.children.length) {
            this.hp_container.lastChild.remove();
        }
    }

    reset(start) {
        this.score = 0;
        document.querySelector('#score > .value').textContent = this.score;
        document.querySelector('#wave-counter > .value').textContent = "1";
        this.safeRadius = 150;

        this.level = 0;
        this.asteroidsNumber = 4;
        this.asteroids = [];

        this.explosions = [];
        this.powerups = [];
        this.resize();

        if (start) {
            if (this.touchInputs) {
                this.touchInputs.forEach(t => t.elem.classList.remove('hidden'));
            }
            this.player = new Player(this);

            // draw hp
            this.updateLifePoints();
        } else {
            this.player = null;
            this.updateLifePoints(0);
        }

        this.asteroids = [];
        this.addAsteroid();

        this.oldT = performance.now();
        this.buffer = [];
        this.deltaT = 0;
        this.time = 0;
    }

    increaseScore(points) {
        this.score += points;
        document.querySelector('#score > .value').textContent = this.score;
    }

    increaseDifficulty() {
        this.level++;
        this.asteroidsNumber = 4 + this.level * 2;
        const waveCounter = document.querySelector('#wave-counter .value');
        if(waveCounter) waveCounter.textContent = this.level + 1;
        this.addAsteroid();
        this.spawnPowerUp();
    }

    spawnPowerUp(forceType = null) {
        this.powerups.push(new PowerUp(this, forceType));
    }

    slowDownAsteroids(time = 5){
        this.slowAsteroids = true;
        setTimeout(() => {
            this.slowAsteroids = false;
        }, time*1000);
    }

    update() {
        if (!this.running) {
            return;
        }


        this.deltaT++;
        if (this.deltaT >= 60) {
            this.deltaT = 0;
            this.time++;
        }

        if (this.player) {
            // powerups
            for (let i = this.powerups.length - 1; i >= 0; i--) {
                let powerup = this.powerups[i];
                powerup.update();

                // remove if expired
                if (powerup.TTL <= 0) {
                    this.powerups.splice(i, 1);
                }

                // collision with player
                // use size as circle to check intersection
                let distX = powerup.x - this.player.shapeObj.centerX;
                let distY = powerup.y - this.player.shapeObj.centerY;
                let distR = powerup.size / 2 + this.player.shapeObj.size / 2;
                if (distX * distX + distY * distY < distR * distR) {
                    this.player.powerUp(powerup.type);
                    this.powerups.splice(i, 1);
                }
            }

            //player update
            this.player.update();
        }

        // asteroids update
        const effects = [];
        if(this.slowAsteroids){
            effects.push({type: 'slowdown'});
        }
        if (this.asteroids.length > 0) {
            for (let i = this.asteroids.length - 1; i >= 0; i--) {
                if (this.asteroids[i])
                    this.asteroids[i].update(effects);

                if (!this.running) {
                    break;
                }
            }
        }

        // explosions update
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].update();
            if (this.explosions[i].end) {
                this.explosions.splice(i, 1);
            }
        }


        this.draw();
        this.requestId = requestAnimationFrame(this.update.bind(this));
    }

    draw() {
        //this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (let powerup of this.powerups) {
            powerup.draw(this.ctx);
        }

        if (this.player) {
            this.player.draw(this.ctx);
        }
        this.asteroids.forEach(a => a.draw(this.ctx));
        this.explosions.forEach(exp => exp.draw(this.ctx));
    }

}