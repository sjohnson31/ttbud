import { GRID_SIZE_PX } from "../config";

export interface Bounds {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export default interface Pos2d {
  x: number;
  y: number;
}

export interface Pos3d {
  x: number;
  y: number;
  z: number;
}

export function distance(first: Pos2d, second: Pos2d): number {
  return Math.sqrt(
    Math.pow(first.x - second.x, 2) + Math.pow(first.y - second.y, 2)
  );
}

export function snapToGrid(pos: Pos2d): Pos2d {
  return {
    x: snapDimensionToGrid(pos.x),
    y: snapDimensionToGrid(pos.y),
  };
}

export function posAreEqual(left: Pos2d, right: Pos2d): boolean {
  return left.x === right.x && left.y === right.y;
}

export function boundsAreEqual(left: Bounds, right: Bounds): boolean {
  return (
    left.top === right.top &&
    left.left === right.left &&
    left.bottom === right.bottom &&
    left.right === right.right
  );
}

export function contains(bounds: Bounds, pos: Pos2d) {
  return (
    bounds.left <= pos.x &&
    bounds.right >= pos.x &&
    bounds.top <= pos.y &&
    bounds.bottom >= pos.y
  );
}

export function centerOf(bounds: Bounds): Pos2d {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  return { x: bounds.left + width / 2, y: bounds.top + height / 2 };
}

export function constrainBoxTo(box: Bounds, bounds: Bounds): Bounds {
  let top, bottom;
  if (box.bottom > bounds.bottom) {
    bottom = bounds.bottom;
    top = bottom - height(box);
  } else if (box.top < bounds.top) {
    top = bounds.top;
    bottom = top + height(box);
  } else {
    top = box.top;
    bottom = box.bottom;
  }

  let left, right;
  if (box.right > bounds.right) {
    right = bounds.right;
    left = right - width(box);
  } else if (box.left < bounds.left) {
    left = bounds.left;
    right = left + width(box);
  } else {
    left = box.left;
    right = box.right;
  }

  return { top, left, bottom, right };
}

export function width(bounds: Bounds) {
  return bounds.right - bounds.left;
}

export function height(bounds: Bounds) {
  return bounds.bottom - bounds.top;
}

function snapDimensionToGrid(dimension: number): number {
  return Math.floor(dimension / GRID_SIZE_PX) * GRID_SIZE_PX;
}
