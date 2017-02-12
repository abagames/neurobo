import * as _ from 'lodash';
import * as SAT from 'sat';
import * as g from './game';
declare const require: any;
const Neuroevolution = require('Neuroevolution');
const RL = require('rl');

window.onload = init;

export let ne;
let game: g.Game;
let targetGame: g.Game;
let prevCodes: any[];
let addActorsCode: string;
let p: p5;
let gameCount = 4;
const sensorNum = 7;
let sensorDataCount = 1;
const sensorType = 3;
const actionNum = 7;
let ticks = 0;
const isUsingDqn = true;
const isShowingSensor = true;
const isShowingReward = true;
const isCloningMaxScoreDqn = false;

function init() {
  g.init(update);
  p = g.p;
  ne = new Neuroevolution({
    population: gameCount * 2,
    network: [sensorNum * sensorDataCount * sensorType, [actionNum], actionNum]
  });
  _.times(gameCount, i => {
    const game = new g.Game();
    game.p.mouseClicked = () => {
      if (game.p.mouseX > 0 && game.p.mouseX < 128 &&
        game.p.mouseY > 0 && game.p.mouseY < 128) {
        game.score++;
      }
    };
  });
  nextGen(true);
}

function update() {
  ticks++;
  if (ticks > 600) {
    _.forEach(g.games, g => {
      ne.networkScore(g.networkPlayer, g.score);
      ne.networkScore(g.networkEnemy, -g.score);
    });
    nextGen();
  }
}

function nextGen(isFirst = false) {
  let minScore = 99999, maxScore = -99999;
  let minGame: g.Game, maxGame: g.Game;
  const networks = ne.nextGeneration();
  _.times(gameCount, i => {
    const game = g.games[i];
    game.setNetwork(networks[i], networks[i + gameCount]);
    if (game.score < minScore) {
      minScore = game.score;
      minGame = game;
    }
    if (game.score > maxScore) {
      maxScore = game.score;
      maxGame = game;
    }
  });
  let nextPlayerDqns, nextEnemyDqns;
  if (!isFirst) {
    if (isCloningMaxScoreDqn) {
      const nextPlayerDqn = (<any>maxGame.actorPool.get('probo')[0]).agent.toJSON();
      const nextEnemyDqn = (<any>minGame.actorPool.get('erobo')[0]).agent.toJSON();
      nextPlayerDqns = _.times(gameCount, () => nextPlayerDqn);
      nextEnemyDqns = _.times(gameCount, () => nextEnemyDqn);
    } else {
      nextPlayerDqns = _.times(gameCount, i =>
        (<any>g.games[i].actorPool.get('probo')[0]).agent.toJSON());
      nextEnemyDqns = _.times(gameCount, i =>
        (<any>g.games[i].actorPool.get('erobo')[0]).agent.toJSON());
    }
  }
  g.beginGame();
  let gi = 0;
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
    const pr = new PRobo(g);
    const er = new ERobo(g);
    if (!isFirst) {
      pr.agent.fromJSON(nextPlayerDqns[gi]);
      er.agent.fromJSON(nextEnemyDqns[gi]);
    }
    gi++;
  });
  ticks = 0;
}

class PRobo extends g.Player {
  polygon: SAT.Polygon;
  network;
  agent;
  prevScore = 0;

  constructor(game: g.Game) {
    super(game);
    this.pos.set(p.random(32, 128 - 32), 128 - 16);
    this.angle = -p.HALF_PI / 2 - p.random(0, p.HALF_PI);
    this.type = 'probo';
    this.network = game.networkPlayer;
    initRobo(this);
  }

  update() {
    updateRobo(this, true);
    super.update();
  }

  destroy() {
    this.game.score -= 1;
  }
}

class ERobo extends g.Enemy {
  polygon: SAT.Polygon;
  network;
  agent;
  prevScore = 0;

  constructor(game: g.Game) {
    super(game);
    this.pos.set(p.random(32, 128 - 32), 16);
    this.angle = p.HALF_PI / 2 + p.random(0, p.HALF_PI);
    this.type = 'erobo';
    this.network = game.networkEnemy;
    initRobo(this);
  }

  update() {
    updateRobo(this, false);
    super.update();
  }

  destroy() {
    this.game.score += 1;
  }
}

function initRobo(robo) {
  new g.CollideToWall(robo, { velRatio: 0 });
  robo.collision.set(8, 8);
  robo.polygon = new SAT.Box(new SAT.Vector(), 8, 8).toPolygon();
  robo.agent = new RL.DQNAgent({
    getNumStates: () => sensorNum * sensorDataCount * sensorType,
    getMaxNumActions: () => actionNum
  }, {});
}

function updateRobo(robo, isPlayer) {
  robo.speed = 0;
  let act = 0;
  if (isUsingDqn) {
    act = robo.agent.act(sense(robo, isPlayer));
  } else {
    const acts = robo.network.compute(sense(robo, isPlayer));
    let maxAct = 0;
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      if (a > maxAct) {
        act = i;
        maxAct = a;
      }
    }
  }
  switch (act) {
    case 0:
      robo.angle += 0.05;
      break;
    case 1:
      robo.angle -= 0.05;
      break;
    case 2:
      robo.speed = 1;
      break;
    case 3:
      robo.speed = -1;
      break;
    case 4:
      robo.pos.x += Math.sin(robo.angle);
      robo.pos.y -= Math.cos(robo.angle);
      break;
    case 5:
      robo.pos.x -= Math.sin(robo.angle);
      robo.pos.y += Math.cos(robo.angle);
      break;
    case 6:
      const type = isPlayer ? 'shot' : 'bullet';
      if (robo.game.actorPool.get(type).length < 5) {
        if (isPlayer) {
          new Shot(robo);
        } else {
          new Bullet(robo);
        }
      }
      break;
  }
  robo.polygon.setOffset(new SAT.Vector(robo.pos.x - 4, robo.pos.y - 4));
  let reward = robo.game.score - robo.prevScore;
  if (!isPlayer) {
    reward *= -1;
  }
  if (isUsingDqn) {
    robo.agent.learn(reward);
  }
  if (isShowingReward && isPlayer && reward !== 0) {
    const t = new g.Text(robo.game, `${reward}`);
    t.pos.set(robo.pos);
  }
  robo.prevScore = robo.game.score;
}

function sense(robo: g.Actor, isPlayer) {
  let aw = p.PI / (sensorNum - 1);
  let sa = robo.angle - p.HALF_PI - aw;
  const range = 128;
  return _.flatten(_.times(sensorNum, i => {
    sa += aw;
    const sensor = new SAT.Polygon(new SAT.Vector(robo.pos.x, robo.pos.y),
      [new SAT.Vector(),
      new SAT.Vector(range, 0).rotate(sa - aw / 2),
      new SAT.Vector(range, 0).rotate(sa + aw / 2)]
    );
    let ti = 0;
    const types = isPlayer ? ['wall', 'erobo', 'bullet'] : ['wall', 'probo', 'shot'];
    return _.flatten(_.map(types, t => {
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
      if (isShowingSensor && isPlayer && nd < range) {
        const p = robo.game.p;
        p.stroke(['#88f', '#ff8', '#f88'][ti]);
        p.line(Math.cos(sa) * nd + robo.pos.x, Math.sin(sa) * nd + robo.pos.y,
          robo.pos.x, robo.pos.y);
        p.noStroke();
      }
      ti++;
      if (sensorDataCount === 2) {
        return na == null ? [0, 0] :
          [1 - nd / range, Math.abs(g.wrap(sa - na.angle, -p.PI, p.PI)) / p.PI];
      } else {
        return na == null ? [0] : [1 - nd / range];
      }
    }));
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
