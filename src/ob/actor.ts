import * as _ from 'lodash';
import * as pag from 'pag';
import * as ppe from 'ppe';
import * as sss from 'sss';
import * as ir from 'ir';
import * as g from '../game';

let p5;
export const rotationNum = 16;

export class Actor {
  pos = g.p.createVector();
  vel = g.p.createVector();
  prevPos = g.p.createVector();
  angle = 0;
  speed = 0;
  isAlive = true;
  priority = 1;
  ticks = 0;
  pixels: pag.Pixel[][][];
  type: string;
  collisionType: string;
  collision = g.p.createVector(8, 8);
  context: CanvasRenderingContext2D;
  replayPropertyNames: string[];
  modules: any[] = [];
  moduleNames: string[] = [];

  constructor(public game: g.Game) {
    game.actorPool.add(this);
    this.context = game.screen.context;
    this.type = g.getClassName(this);
    new g.RemoveWhenInAndOut(this);
    this.init();
  }

  init() { }

  update() {
    this.prevPos.set(this.pos);
    this.pos.add(this.vel);
    this.pos.x += Math.cos(this.angle) * this.speed;
    this.pos.y += Math.sin(this.angle) * this.speed;
    if (this.pixels != null) {
      this.drawPixels();
    }
    _.forEach(this.modules, m => {
      if (m.isEnabled) {
        m.update();
      }
    });
    this.ticks++;
  }

  remove() {
    this.isAlive = false;
  }

  destroy() {
    this.remove();
  }

  clearModules() {
    this.modules = [];
    this.moduleNames = [];
  }

  testCollision(type: string) {
    return _.filter<Actor>(this.game.actorPool.getByCollitionType(type), a =>
      Math.abs(this.pos.x - a.pos.x) < (this.collision.x + a.collision.x) / 2 &&
      Math.abs(this.pos.y - a.pos.y) < (this.collision.y + a.collision.y) / 2
    );
  }

  emitParticles(patternName: string, options: ppe.EmitOptions = {}) {
    (<any>ppe.emit)(patternName, this.pos.x, this.pos.y, this.angle, options);
  }

  drawPixels(x: number = null, y: number = null) {
    if (x == null) {
      x = this.pos.x;
    }
    if (y == null) {
      y = this.pos.y;
    }
    if (this.pixels.length <= 1) {
      pag.draw(this.context, this.pixels, x, y);
    } else {
      let a = this.angle;
      if (a < 0) {
        a = Math.PI * 2 - Math.abs(a % (Math.PI * 2));
      }
      const ri = Math.round(a / (Math.PI * 2 / rotationNum)) % rotationNum;
      pag.draw(this.context, this.pixels, x, y, ri);
    }
  }

  getModule(moduleName: string) {
    return this.modules[_.indexOf(this.moduleNames, moduleName)];
  }

  _addModule(module, insertIndexFromLast = 0) {
    const i = this.modules.length - insertIndexFromLast;
    this.modules.splice(i, 0, module);
    this.moduleNames.splice(i, 0, g.getClassName(module));
  }

  getReplayStatus() {
    if (this.replayPropertyNames == null) {
      return null;
    }
    return ir.objectToArray(this, this.replayPropertyNames);
  }

  setReplayStatus(status) {
    ir.arrayToObject(status, this.replayPropertyNames, this);
  }
}

export class Player extends Actor {
  constructor(game: g.Game) {
    super(game);
    this.pixels = pag.generate(['x x', ' xxx'], { hue: 0.2 });
    this.type = this.collisionType = 'player';
    this.collision.set(5, 5);
  }

  update() {
    this.emitParticles(`t_${this.type}`);
    super.update();
    if (this.testCollision('enemy').length > 0 ||
      this.testCollision('bullet').length > 0) {
      this.destroy();
    }
  }

  destroy() {
    sss.play(`u_${this.type}_d`);
    this.emitParticles(`e_${this.type}_d`, { sizeScale: 2 });
    super.destroy();
    this.game.endGame();
  }
}

export class Enemy extends Actor {
  constructor(game: g.Game) {
    super(game);
    this.pixels = pag.generate([' xx', 'xxxx'], { hue: 0 });
    this.type = this.collisionType = 'enemy';
  }

  update() {
    this.emitParticles(`t_${this.type}`);
    super.update();
    const cs = this.testCollision('shot');
    if (cs.length > 0) {
      this.destroy();
      _.forEach(cs, (s: Shot) => {
        s.destroy();
      });
    }
  }

  destroy() {
    sss.play(`e_${this.type}_d`);
    this.emitParticles(`e_${this.type}_d`);
    super.destroy();
  }
}

export class Shot extends Actor {
  constructor(actor, speed = 2, angle = null) {
    super(actor.game);
    this.pixels = pag.generate(['xxx'], { hue: 0.4 });
    this.type = this.collisionType = 'shot';
    this.pos.set(actor.pos);
    this.angle = angle == null ? actor.angle : angle;
    this.speed = speed;
    this.priority = 0.3;
  }

  update() {
    if (this.ticks === 0) {
      this.emitParticles(`m_${this.type}`);
      sss.play(`l_${this.type}`);
    }
    this.emitParticles(`t_${this.type}`);
    super.update();
  }
}

export class Bullet extends Actor {
  constructor(actor, speed = 2, angle = null) {
    super(actor.game);
    this.pixels = pag.generate(['xxxx'], { hue: 0.1 });
    this.type = this.collisionType = 'bullet';
    this.pos.set(actor.pos);
    this.angle = angle == null ? actor.angle : angle;
    this.speed = speed;
  }

  update() {
    if (this.ticks === 0) {
      this.emitParticles(`m_${this.type}`);
      sss.play(`l_${this.type}`);
    }
    this.emitParticles(`t_${this.type}`);
    super.update();
  }
}

export class Item extends Actor {
  constructor(game: g.Game, pos: p5.Vector, vel: p5.Vector = null, public gravity: p5.Vector = null) {
    super(game);
    this.pixels = pag.generate([' o', 'ox'], { isMirrorX: true, hue: 0.25 });
    this.type = this.collisionType = 'item';
    this.pos.set(pos);
    if (vel != null) {
      this.vel = vel;
    }
    this.priority = 0.6;
    this.collision.set(10, 10);
  }

  update() {
    this.vel.add(this.gravity);
    this.vel.mult(0.99);
    this.emitParticles(`t_${this.type}`);
    super.update();
    if (this.testCollision('player').length > 0) {
      this.emitParticles(`s_${this.type}`);
      sss.play(`s_${this.type}`);
      this.destroy();
    }
    super.update();
  }

  destroy() {
    super.destroy();
  }
}

export class Wall extends Actor {
  constructor(game: g.Game, pos: p5.Vector, width = 8, height = 8, hue = 0.7, seed: number = null) {
    super(game);
    const pw = Math.round(width / 4);
    const ph = Math.round(height / 4);
    const pt = [_.times(pw, () => 'o').join('')].concat(
      _.times(ph - 1, () => ['o'].concat(_.times(pw - 1, () => 'x')).join(''))
    );
    this.pixels = pag.generate(pt, { isMirrorX: true, hue, seed });
    this.type = this.collisionType = 'wall';
    this.pos.set(pos);
    this.priority = 0.2;
    this.collision.set(width, height);
  }

  getCollisionInfo(actor) {
    let angle: number;
    const wa = Math.atan2(this.collision.y, this.collision.x);
    const a = g.Vector.getAngle(this.pos, actor.prevPos);
    if (a > Math.PI - wa || a <= -Math.PI + wa) {
      angle = 2;
    } else if (a > wa) {
      angle = 1;
    } else if (a > -wa) {
      angle = 0;
    } else {
      angle = 3;
    }
    return { wall: this, angle, dist: this.pos.dist(actor.prevPos) };
  }

  adjustPos(actor, angle: number) {
    switch (angle) {
      case 0:
        actor.pos.x = this.pos.x + (this.collision.x + actor.collision.x) / 2;
        break;
      case 1:
        actor.pos.y = this.pos.y + (this.collision.y + actor.collision.y) / 2;
        break;
      case 2:
        actor.pos.x = this.pos.x - (this.collision.x + actor.collision.x) / 2;
        break;
      case 3:
        actor.pos.y = this.pos.y - (this.collision.y + actor.collision.y) / 2;
        break;
    }
    return angle;
  }

  destroy() { }
}

export class Star extends Actor {
  color;

  constructor(game: g.Game, minSpeedY = 0.5, maxSpeedY = 1.5, minSpeedX = 0, maxSpeedX = 0) {
    super(game);
    this.pos.set(game.p.random(game.screen.size.x), game.p.random(game.screen.size.y));
    this.vel.set(game.p.random(minSpeedX, maxSpeedX), game.p.random(minSpeedY, maxSpeedY));
    this.clearModules();
    new g.WrapPos(this);
    const colorStrs = ['00', '7f', 'ff'];
    this.color = '#' + _.times(3, () => colorStrs[Math.floor(game.p.random(3))]).join('');
    this.priority = -1;
  }

  update() {
    super.update();
    this.game.p.fill(this.color);
    this.game.p.rect(Math.floor(this.pos.x), Math.floor(this.pos.y), 1, 1);
  }
}

export class Panel extends Actor {
  constructor(game: g.Game, x, y) {
    super(game);
    const pagOptions: any = { isMirrorX: true, value: 0.5, rotationNum: 1 };
    pagOptions.colorLighting = 0;
    this.pixels = pag.generate(['ooo', 'oxx', 'oxx'], pagOptions);
    this.pos.set(x, y);
    new g.WrapPos(this);
    this.priority = -1;
  }
}
