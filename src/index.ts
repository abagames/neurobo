import * as _ from 'lodash';
import * as SAT from 'sat';
import * as g from './game';
declare const require: any;
const Neuroevolution = require('Neuroevolution');

window.onload = init;

export let ne;
let game: g.Game;
let targetGame: g.Game;
let prevCodes: any[];
let addActorsCode: string;
let p: p5;
const sensorNum = 7;
let population = 8;
let ticks = 0;

function init() {
  g.init(update);
  p = g.p;
  ne = new Neuroevolution({
    population,
    network: [sensorNum * 3, [sensorNum], 7]
  });
  _.times(population, i => {
    new g.Game();
  });
  nextGen();
}

function update() {
  ticks++;
  if (ticks > 300) {
    _.forEach(g.games, g => {
      ne.networkScore(g.networkPlayer, g.score);
    });
    nextGen();
  }
}

function nextGen() {
  const networks = ne.nextGeneration();
  _.times(networks.length, i => {
    g.games[i].setNetwork(networks[i], networks[Math.floor(p.random(0, networks.length))]);
  });
  g.beginGame();
  _.forEach(g.games, g => {
    _.times(16, i => {
      const v = i * 8 + 4;
      new Wall(g, p.createVector(v, 4));
      new Wall(g, p.createVector(v, 128 - 4));
      if (i > 0 && i < 15) {
        new Wall(g, p.createVector(4, v));
        new Wall(g, p.createVector(128 - 4, v));
      }
    });
    new PRobo(g);
    new ERobo(g);
  });
  ticks = 0;
}

class PRobo extends g.Player {
  polygon;
  network;

  constructor(game: g.Game) {
    super(game);
    this.pos.set(p.random(32, 128 - 32), 128 - 16);
    this.angle = -p.HALF_PI / 2 - p.random(0, p.HALF_PI);
    this.network = game.networkPlayer;
    this.collision.set(8, 8);
    new g.CollideToWall(this, { velRatio: 0 });
    this.polygon = new SAT.Box(new SAT.Vector(), 8, 8).toPolygon();
    this.type = 'probo';
  }

  update() {
    updateRobo(this, true);
    this.polygon.setOffset(new SAT.Vector(this.pos.x - 4, this.pos.y - 4));
    super.update();
  }

  destroy() {
    this.game.score -= 1;
  }
}

class ERobo extends g.Enemy {
  polygon: SAT.Polygon;
  network;

  constructor(game: g.Game) {
    super(game);
    this.pos.set(p.random(32, 128 - 32), 16);
    this.angle = p.HALF_PI / 2 + p.random(0, p.HALF_PI);
    this.network = game.networkEnemy;
    this.collision.set(8, 8);
    new g.CollideToWall(this, { velRatio: 0 });
    this.polygon = new SAT.Box(new SAT.Vector(), 8, 8).toPolygon();
    this.type = 'erobo';
  }

  update() {
    updateRobo(this, false);
    this.polygon.setOffset(new SAT.Vector(this.pos.x - 4, this.pos.y - 4));
    super.update();
  }

  destroy() {
    this.game.score += 1;
  }
}

function updateRobo(robo, isPlayer) {
  const acts = robo.network.compute(sense(robo, isPlayer));
  robo.speed = 0;
  if (acts[0] > 0.5) {
    robo.angle += 0.05;
  }
  if (acts[1] > 0.5) {
    robo.angle -= 0.05;
  }
  if (acts[2] > 0.5) {
    robo.speed = 1;
  }
  if (acts[3] > 0.5) {
    robo.speed = -1;
  }
  if (acts[4] > 0.5) {
    robo.pos.x += Math.sin(robo.angle);
    robo.pos.y -= Math.cos(robo.angle);
  }
  if (acts[5] > 0.5) {
    robo.pos.x -= Math.sin(robo.angle);
    robo.pos.y += Math.cos(robo.angle);
  }
  const type = isPlayer ? 'shot' : 'bullet';
  if (acts[6] > 0.5 && robo.game.actorPool.get(type).length < 3) {
    if (isPlayer) {
      new Shot(robo);
    } else {
      new Bullet(robo);
    }
  }
}

function sense(robo, isPlayer) {
  let sa = robo.angle - p.HALF_PI;
  let aw = p.PI / (sensorNum - 1);
  const range = 128;
  return _.flatten(_.times(sensorNum, i => {
    const sensor = new SAT.Polygon(new SAT.Vector(robo.pos.x, robo.pos.y),
      [new SAT.Vector(),
      new SAT.Vector(range, 0).rotate(sa - aw / 2),
      new SAT.Vector(range, 0).rotate(sa + aw / 2)]
    );
    const types = isPlayer ? ['wall', 'erobo', 'bullet'] : ['wall', 'probo', 'shot'];
    const result = _.map(types, t => {
      let nd = range;
      let na;
      _.forEach(robo.game.actorPool.actors, (a: any) => {
        if (a === this || !a.hasOwnProperty('polygon') || a.type !== t) {
          return;
        }
        if (SAT.testPolygonPolygon(sensor, a.polygon)) {
          const d = robo.pos.dist(a.pos);
          if (d < nd) {
            nd = d;
            na = a;
          }
        }
      });
      return na == null ? 1 : nd / 256;
    });
    sa += aw;
    return result;
  }));
}

class Shot extends g.Shot {
  polygon: SAT.Polygon;

  constructor(g: g.Game) {
    super(g);
    this.polygon = new SAT.Box(new SAT.Vector(), 8, 8).toPolygon();
    this.collision.set(4, 4);
  }

  update() {
    this.polygon.setOffset(new SAT.Vector(this.pos.x - 4, this.pos.y - 4));
    super.update();
  }
}

class Bullet extends g.Bullet {
  polygon: SAT.Polygon;

  constructor(g: g.Game) {
    super(g);
    this.polygon = new SAT.Box(new SAT.Vector(), 8, 8).toPolygon();
    this.collision.set(4, 4);
  }

  update() {
    this.polygon.setOffset(new SAT.Vector(this.pos.x - 4, this.pos.y - 4));
    super.update();
  }
}

class Wall extends g.Wall {
  polygon: SAT.Polygon;

  constructor(game: g.Game, pos: p5.Vector) {
    super(game, pos);
    this.polygon = new SAT.Box(new SAT.Vector(pos.x - 4, pos.y - 4), 8, 8).toPolygon();
  }
}
