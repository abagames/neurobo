import * as _ from 'lodash';
import * as SAT from 'sat';
import * as g from './game';
declare const require: any;
//const Neuroevolution = require('Neuroevolution');
const RL = require('rl');

window.onload = init;

//export let ne;
let p: p5;
let gameCount = 4;
let pRoboSpec: RoboSpec;
let eRoboSpec: RoboSpec;
let sensorDataCount = 1;
const sensorType = 3;
const actionNum = 7;
let ticks = 0;
const isUsingDqn = true;
const isShowingSensor = true;
const isShowingReward = true;
const isCloningMaxScoreDqn = false;
let iterationCount = 0;
const statesStackCount = 4;
let gameState: g.GameState;

function init() {
  g.init(update);
  p = g.p;
  /*ne = new Neuroevolution({
    population: gameCount * 2,
    network: [sensorNum * sensorDataCount * sensorType * statesStackCount,
    [actionNum], actionNum]
  });*/
  pRoboSpec = new RoboSpec();
  eRoboSpec = new RoboSpec();
  initUi();
  _.times(gameCount, () => {
    new g.Game();
  });
  beginSetting();
}

function initUi() {
  document.getElementById('start-button').addEventListener('click', () => {
    changeState();
  });
  _.forOwn(pRoboSpec, (v, k) => {
    document.getElementById(`${k}-probo`).addEventListener('input', e => {
      pRoboSpec[k] = (<any>e.srcElement).valueAsNumber;
      beginSetting();
    });
    document.getElementById(`${k}-erobo`).addEventListener('input', e => {
      eRoboSpec[k] = (<any>e.srcElement).valueAsNumber;
      beginSetting();
    });
  });
}

function changeState() {
  if (gameState === g.GameState.setting) {
    nextGen(true);
    setStartedUi();
  } else if (gameState === g.GameState.started) {
    pauseGame();
    document.getElementById('start-button').textContent = 'Restart';
    _.forOwn(pRoboSpec, (v, k) => {
      document.getElementById(`${k}-probo`).removeAttribute('disabled');
      document.getElementById(`${k}-erobo`).removeAttribute('disabled');
    });
  } else if (gameState === g.GameState.paused) {
    restartGame();
    setStartedUi();
  }
}

function setStartedUi() {
  document.getElementById('start-button').textContent = 'Pause';
  _.forOwn(pRoboSpec, (v, k) => {
    document.getElementById(`${k}-probo`).setAttribute('disabled', '');
    document.getElementById(`${k}-erobo`).setAttribute('disabled', '');
  });
}

function pauseGame() {
  gameState = g.GameState.paused;
  g.pauseGame();
}

function restartGame() {
  gameState = g.GameState.started;
  g.restartGame();
}

function update() {
  if (gameState !== g.GameState.started) {
    return;
  }
  ticks++;
  if (ticks > 600) {
    _/*.forEach(g.games, g => {
      ne.networkScore(g.networkPlayer, g.score);
      ne.networkScore(g.networkEnemy, -g.score);
    });*/
    nextGen();
  }
}

function beginSetting() {
  if (gameState === g.GameState.setting) {
    return;
  }
  gameState = g.GameState.setting;
  document.getElementById('start-button').textContent = 'Start';
  g.beginSetting();
  const lg = g.games[0];
  new PRobo(lg, pRoboSpec, null, true);
  const rg = g.games[gameCount - 1];
  new ERobo(rg, eRoboSpec, null, true);
}

function nextGen(isFirst = false) {
  gameState = g.GameState.started;
  let minScore = 99999, maxScore = -99999;
  let minGame: g.Game, maxGame: g.Game;
  //const networks = ne.nextGeneration();
  _.times(gameCount, i => {
    const game = g.games[i];
    //game.setNetwork(networks[i], networks[i + gameCount]);
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
      const nextPlayerDqn = (<any>maxGame.actorPool.get('probo')[0]).agent;
      const nextEnemyDqn = (<any>minGame.actorPool.get('erobo')[0]).agent;
      nextPlayerDqns = _.times(gameCount, () => _.cloneDeep(nextPlayerDqn));
      nextEnemyDqns = _.times(gameCount, () => _.cloneDeep(nextEnemyDqn));
    } else {
      nextPlayerDqns = _.times(gameCount, i =>
        (<any>g.games[i].actorPool.get('probo')[0]).agent);
      nextEnemyDqns = _.times(gameCount, i =>
        (<any>g.games[i].actorPool.get('erobo')[0]).agent);
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
    if (isFirst) {
      iterationCount = 0;
      new PRobo(g, pRoboSpec);
      new ERobo(g, eRoboSpec);
    } else {
      new PRobo(g, pRoboSpec, nextPlayerDqns[gi]);
      new ERobo(g, eRoboSpec, nextEnemyDqns[gi]);
    }
    gi++;
  });
  ticks = 0;
  iterationCount++;
  let iteText = `Iteration: ${iterationCount}`;
  if (iterationCount % 10 === 1) {
    g.setUpdateCount(1);
  } else {
    g.setUpdateCount(32);
    iteText += ' skipping';
  }
  document.getElementById('ite_text').textContent = iteText;
}

class RoboSpec {
  rewardAttack = 1;
  rewardDamage = 1;
  sensorAngle = 3;
  sensorCount = 7;
  sensorRange = 96;
}

class PRobo extends g.Player {
  polygon: SAT.Polygon;
  network;
  agent;
  prevScore = 0;
  statesStack: number[][] = [];
  statesStackIndex = 0;
  prevAct = 0;

  constructor(game: g.Game, public spec: RoboSpec, agent = null, public isSetting = false) {
    super(game);
    if (isSetting) {
      this.pos.set(64, 128 - 16);
      this.angle = -p.HALF_PI;
    } else {
      this.pos.set(p.random(32, 128 - 32), 128 - 16);
      this.angle = -p.HALF_PI / 2 - p.random(0, p.HALF_PI);
    }
    this.type = 'probo';
    //this.network = game.networkPlayer;
    initRobo(this, agent);
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
  statesStack: number[][] = [];
  statesStackIndex = 0;
  prevAct = 0;

  constructor(game: g.Game, public spec: RoboSpec, agent = null, public isSetting = false) {
    super(game);
    if (isSetting) {
      this.pos.set(64, 128 - 16);
      this.angle = -p.HALF_PI;
    } else {
      this.pos.set(p.random(32, 128 - 32), 16);
      this.angle = p.HALF_PI / 2 + p.random(0, p.HALF_PI);
    }
    this.type = 'erobo';
    //this.network = game.networkEnemy;
    initRobo(this, agent);
  }

  update() {
    updateRobo(this, false);
    super.update();
  }

  destroy() {
    this.game.score += 1;
  }
}

function initRobo(robo: PRobo | ERobo, agent) {
  if (robo.isSetting) {
    return;
  }
  new g.CollideToWall(robo, { velRatio: 0 });
  robo.collision.set(8, 8);
  robo.polygon = new SAT.Box(new SAT.Vector(), 8, 8).toPolygon();
  if (agent != null) {
    robo.agent = agent;
  } else {
    robo.agent = new RL.DQNAgent({
      getNumStates: () => robo.spec.sensorCount * sensorDataCount * sensorType * statesStackCount,
      getMaxNumActions: () => actionNum
    }, {
        update: 'qlearn',
        gamma: 0.9,
        epsilon: 0.2,
        alpha: 0.01,
        experience_add_every: 10,
        experience_size: 10000,
        learning_steps_per_iteration: 10,
        tderror_clamp: 1.0,
        num_hidden_units: 100
      });
  }
}

function updateRobo(robo: PRobo | ERobo, isPlayer) {
  if (robo.isSetting) {
    sense(robo, isPlayer);
    return;
  }
  robo.speed = 0;
  robo.statesStack.unshift(sense(robo, isPlayer));
  if (robo.ticks % statesStackCount === statesStackCount - 1) {
    let act = 0;
    if (isUsingDqn) {
      act = robo.agent.act(_.flatten(robo.statesStack));
    } else {
      const acts = robo.network.compute(_.flatten(robo.statesStack));
      let maxAct = 0;
      for (let i = 0; i < acts.length; i++) {
        const a = acts[i];
        if (a > maxAct) {
          act = i;
          maxAct = a;
        }
      }
    }
    robo.statesStack = [];
    if (act === 6) {
      const type = isPlayer ? 'shot' : 'bullet';
      if (robo.game.actorPool.get(type).length < 5) {
        if (isPlayer) {
          new Shot(robo);
        } else {
          new Bullet(robo);
        }
      }
    } else {
      robo.prevAct = act;
    }
  }
  switch (robo.prevAct) {
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
  }
  robo.polygon.setOffset(new SAT.Vector(robo.pos.x - 4, robo.pos.y - 4));
  if (robo.ticks % statesStackCount === statesStackCount - 1) {
    let reward = robo.game.score - robo.prevScore;
    if (!isPlayer) {
      reward *= -1;
    }
    robo.prevScore = robo.game.score;
    reward = p.constrain(reward, -1, 1);
    if (reward > 0) {
      reward *= robo.spec.rewardAttack;
    } else {
      reward *= robo.spec.rewardDamage;
    }
    if (isUsingDqn) {
      robo.agent.learn(reward);
    }
    if (isShowingReward && reward !== 0) {
      const t = new g.Text(robo.game, `${reward}`);
      t.pos.set(robo.pos);
    }
  }
}

function sense(robo: PRobo | ERobo, isPlayer) {
  let aw = robo.spec.sensorAngle / (robo.spec.sensorCount - 1);
  let sa = robo.angle - robo.spec.sensorAngle / 2 - aw;
  const range = robo.spec.sensorRange;
  return _.flatten(_.times(robo.spec.sensorCount, i => {
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
      if (robo.isSetting || (g.hasScreen && isShowingSensor && nd < range)) {
        const p = robo.game.p;
        p.stroke(['#88f', '#ff8', '#f88'][ti]);
        p.line(Math.cos(sa) * nd + robo.pos.x, Math.sin(sa) * nd + robo.pos.y,
          robo.pos.x, robo.pos.y);
        p.noStroke();
        if (robo.isSetting) {
          g.text.draw(robo.game.screen.context,
            'REWARD', 5, 10, g.text.Align.left);
          g.text.draw(robo.game.screen.context,
            `ATK ${robo.spec.rewardAttack}`, 10, 15, g.text.Align.left);
          g.text.draw(robo.game.screen.context,
            `DMG -${robo.spec.rewardDamage}`, 10, 20, g.text.Align.left);
        }
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

  constructor(actor) {
    super(actor);
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

  constructor(actor) {
    super(actor);
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
