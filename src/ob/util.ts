import * as _ from 'lodash';
import * as pag from 'pag';
import * as ppe from 'ppe';
import * as g from '../game';

export function isIn(v: number, low: number, high: number) {
  return v >= low && v <= high;
}

export function wrap(v: number, low: number, high: number) {
  const w = high - low;
  const o = v - low;
  if (o >= 0) {
    return o % w + low;
  } else {
    return w + o % w + low;
  }
}

export function getDifficulty(game: g.Game) {
  //return game.scene === g.Scene.title ? 1 : game.ticks * 0.001 + 1;
  return game.ticks * 0.001 + 1;
}

export function fillStar(game: g.Game, c = 64,
  minSpeedY = 0.5, maxSpeedY = 1.5, minSpeedX = 0, maxSpeedX = 0) {
  _.times(c, () => new g.Star(game, minSpeedY, maxSpeedY, minSpeedX, maxSpeedX));
}

export function fillPanel(game: g.Game) {
  _.times(10, x => {
    _.times(10, y => {
      new g.Panel(game, x * 16 - 8, y * 16 - 8);
    });
  });
}

export function getClassName(obj) {
  return ('' + obj.constructor).replace(/^\s*function\s*([^\(]*)[\S\s]+$/im, '$1');
}

export class Vector {
  static getAngle(v: p5.Vector, to: p5.Vector = null) {
    return to == null ? Math.atan2(v.y, v.x) : Math.atan2(to.y - v.y, to.x - v.x);
  }

  static addAngle(v: p5.Vector, angle: number, value: number) {
    v.x += Math.cos(angle) * value;
    v.y += Math.sin(angle) * value;
  }

  static constrain
    (v: p5.Vector, lowX: number, highX: number, lowY: number, highY: number) {
    v.x = g.p.constrain(v.x, lowX, highX);
    v.y = g.p.constrain(v.y, lowY, highY);
  }

  static swapXy(v: p5.Vector) {
    const t = v.x;
    v.x = v.y;
    v.y = t;
  }
}
