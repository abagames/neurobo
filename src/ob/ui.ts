import * as sss from 'sss';
import * as g from '../game';

export let isPressed = false;
export let isJustPressed = false;
export let _isPressedInReplay = false;
let isCursorDown = false;

export function init() {
  document.onmousedown = (e) => {
    isCursorDown = true;
  };
  document.ontouchstart = (e) => {
    e.preventDefault();
    isCursorDown = true;
    sss.playEmpty();
  };
  document.ontouchmove = (e) => {
    e.preventDefault();
  };
  document.onmouseup = (e) => {
    isCursorDown = false;
  };
  document.ontouchend = (e) => {
    e.preventDefault();
    isCursorDown = false;
  };
}

export function update() {
  const pp = isPressed;
  isPressed = g.p.keyIsPressed || isCursorDown;
  isJustPressed = (!pp && isPressed);
}

export function updateInReplay(events) {
  const pp = isPressed;
  _isPressedInReplay = g.p.keyIsPressed || isCursorDown;
  isPressed = events === '1';
  isJustPressed = (!pp && isPressed);
}

export function clearJustPressed() {
  isJustPressed = false;
  isPressed = true;
}

export function getReplayEvents() {
  return isPressed ? '1' : '0';
}
