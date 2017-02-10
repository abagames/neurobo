import * as _ from 'lodash';
import * as g from './game';

window.onload = init;

let game: g.Game;
let targetGame: g.Game;
let prevCodes: any[];
let addActorsCode: string;

function init() {
  g.init();
  game = new g.Game('game');
  g.beginGame();
  const p = new g.Player(game);
  p.pos.set(64, 64);
}
