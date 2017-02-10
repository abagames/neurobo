declare module 'sat' {
  class Vector {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    copy(ohter: Vector): Vector;
    clone(): Vector;
    perp(): Vector;
    rotate(angle: number): Vector;
    reverse(): Vector;
    normalize(): Vector;
    add(other: Vector): Vector;
    sub(other: Vector): Vector;
    scale(x: number, y?: number): Vector;
    project(other: Vector): Vector;
    projectN(other: Vector): Vector;
    reflect(axis: Vector): Vector;
    reflectN(axis: Vector): Vector;
    dot(other: Vector): number;
    len2(): number;
    len(): number;
  }
  class Circle {
    pos: Vector;
    constructor(pos?: Vector, radius?: number);
  }
  class Polygon {
    pos: Vector;
    points: Vector[];
    constructor(pos?: Vector, vectors?: Vector[]);
    setPoints(points: Vector[]);
    setAngle(angle: number);
    setOffset(offset: Vector);
    rotate(angle: number);
    translate(x: number, y: number);
  }
  class Box {
    constructor(pos?: Vector, width?: number, height?: number);
    toPolygon(): Polygon;
  }
  class Response {
    a;
    b;
    overlap: number;
    overlapN: Vector;
    overlapV: Vector;
    aInB: boolean;
    bInA: boolean;
  }
  function testCircleCircle(a: Circle, b: Circle, response?: Response);
  function testCirclePolygon(circle: Circle, polygon: Polygon, response?: Response);
  function testPolygonCircle(polygon: Polygon, circle: Circle, response?: Response);
  function testPolygonPolygon(a: Polygon, b: Polygon, response?: Response);
}
