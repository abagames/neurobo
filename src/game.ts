import * as _ from 'lodash';
import * as pag from 'pag';
import * as ppe from 'ppe';
import * as sss from 'sss';
import * as ir from 'ir';

import { Actor, rotationNum } from './ob/actor';
import Random from './ob/random';
import * as ui from './ob/ui';
import * as text from './ob/text';
import * as debug from './ob/debug';
import * as util from './ob/util';
export { Random, ui, text, debug };
export * from './ob/util';
export * from './ob/actor';
export * from './ob/modules';

declare const require: any;
export const p5 = require('p5');
export let p: p5;
export let games: Game[] = [];
export let isReplaying = false;
let seedRandom: Random;
let updateFunc: Function;

export function init(_updateFunc: Function) {
  updateFunc = _updateFunc;
  sss.init();
  pag.setDefaultOptions({
    isMirrorY: true,
    rotationNum,
    scale: 2
  });
  ir.setOptions({
    frameCount: -1,
    isRecordingEventsAsString: true
  });
  limitColors();
  ui.init();
  text.init();
  seedRandom = new Random();
  new p5((_p: p5) => {
    p = _p;
    p.draw = update;
  });
}

function limitColors() {
  pag.setDefaultOptions({
    isLimitingColors: true
  });
  ppe.setOptions({
    isLimitingColors: true
  });
}

export function beginGame() {
  clearGameStatus();
  const seed = seedRandom.getInt(9999999);
  _.forEach(games, g => {
    g.beginGame(seed);
  });
  //ir.startRecord();
  //this.initialStatus.r = seed;
}

export function beginReplay() {
  clearGameStatus();
  const status = ir.startReplay();
  if (status !== false) {
    _.forEach(games, g => {
      g.beginGame(status.r);
    });
  }
}

function clearGameStatus() {
  ppe.clear();
  ui.clearJustPressed();
}

export function update() {
  if (isReplaying) {
    const events = ir.getEvents();
    if (events !== false) {
      ui.updateInReplay(events);
    } else {
      //this.beginReplay();
    }
  } else {
    ui.update();
    //ir.recordEvents(ui.getReplayEvents());
  }
  _.forEach(games, g => {
    g.update();
  });
  updateFunc();
}

export class Game {
  p: p5;
  actorPool = new ActorPool();
  screen: Screen;
  score = 0;
  ticks = 0;
  random: Random;
  isDebugEnabled = false;
  modules = [];
  initialStatus = { r: 0 };
  networkPlayer;
  networkEnemy;

  constructor() {
    this.random = new Random();
    this.setup = this.setup.bind(this);
    new p5((_p: p5) => {
      this.p = _p;
      _p.setup = this.setup;
    });
    games.push(this);
  }

  setNetwork(networkPlayer, networkEnemy) {
    this.networkPlayer = networkPlayer;
    this.networkEnemy = networkEnemy;
  }

  enableDebug(_onSeedChangedFunc = null) {
    debug.initSeedUi(this.setSeeds);
    debug.enableShowingErrors();
    this.isDebugEnabled = true;
  }

  setSeeds(seed: number) {
    pag.setSeed(seed);
    ppe.setSeed(seed);
    ppe.reset();
    sss.reset();
    sss.setSeed(seed);
    //sss.playBgm();
  }

  endGame() {
    //this.ticks = 0;
    //sss.stopBgm();
    //ir.recordInitialStatus(this.initialStatus);
  }

  clearModules() {
    this.modules = [];
  }

  _addModule(module, insertIndexFromLast = 0) {
    this.modules.splice(this.modules.length - insertIndexFromLast, 0, module);
  }

  getDifficulty() {
    return util.getDifficulty(this);
  }

  setup() {
    const canvas = this.p.createCanvas(128, 128);
    //canvas.parent(this.parentId);
    //canvas.canvas.setAttribute('style', null);
    canvas.canvas.setAttribute('class', 'pixelated');
    this.screen = new Screen(canvas.canvas, this.p);
    this.p.noStroke();
    this.p.noSmooth();
  }

  beginGame(seed: number) {
    this.clearGameStatus();
    this.random.setSeed(seed);
  }

  clearGameStatus() {
    this.clearModules();
    this.actorPool.clear();
    this.ticks = 0;
    this.score = 0;
  }

  update() {
    this.screen.clear();
    sss.update();
    //updateFunc();
    _.forEach(this.modules, m => {
      if (m.isEnabled) {
        m.update();
      }
    });
    this.actorPool.updateLowerZero();
    ppe.update();
    this.actorPool.update();
    //postUpdateFunc();
    text.draw(this.screen.context, `${this.score}`, 1, 1, text.Align.left);
    this.ticks++;
  }
}

export class ActorPool {
  actors: Actor[] = [];

  add(actor) {
    this.actors.push(actor);
  }

  clear() {
    this.actors = [];
  }

  updateLowerZero() {
    _.sortBy(this.actors, 'priority');
    this.updateSorted(true);
  }

  update() {
    this.updateSorted();
  }

  updateSorted(isLowerZero = false) {
    for (let i = 0; i < this.actors.length;) {
      const a = this.actors[i];
      if (isLowerZero && a.priority >= 0) {
        return;
      }
      if (!isLowerZero && a.priority < 0) {
        i++;
        continue;
      }
      if (a.isAlive !== false) {
        a.update();
      }
      if (a.isAlive === false) {
        this.actors.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  get(type: string = null) {
    return type == null ? this.actors :
      _.filter<Actor>(this.actors, a => a.type === type);
  }

  getByModuleName(moduleName: string) {
    return _.filter<Actor>(this.actors, a => _.indexOf(a.moduleNames, moduleName) >= 0);
  }

  getByCollitionType(collitionType: string) {
    return _.filter<Actor>(this.actors, a => a.collisionType == collitionType);
  }

  getReplayStatus() {
    let status = [];
    _.forEach(this.actors, (a: Actor) => {
      let array = a.getReplayStatus();
      if (array != null) {
        status.push([a.type, array]);
      }
    });
    return status;
  }

  setReplayStatus(status: any[], actorGeneratorFunc) {
    _.forEach(status, s => {
      actorGeneratorFunc(s[0], s[1]);
    });
  }
}

export class Screen {
  context: CanvasRenderingContext2D;
  size: p5.Vector;

  constructor(public canvas: HTMLCanvasElement, public p: p5) {
    if (canvas != null) {
      this.context = canvas.getContext('2d');
    }
    this.size = p.createVector(128, 128);
  }

  clear() {
    this.p.background(0);
  }
}
