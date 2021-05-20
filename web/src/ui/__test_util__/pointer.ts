import Pos2d from "../../util/shape-math";
import { fireEvent } from "@testing-library/dom";

type NonEmptyArray<T> = { 0: T } & Array<T>;

export const LEFT_MOUSE = 1;
export const RIGHT_MOUSE = 2;

interface DragOpts {
  buttons?: number;
  shiftKey?: boolean;
}

export function drag(
  el: HTMLElement,
  [first, ...rest]: NonEmptyArray<Pos2d>,
  { buttons = LEFT_MOUSE, shiftKey = false }: DragOpts = {}
) {
  fireEvent.pointerDown(el, {
    buttons,
    shiftKey,
    clientX: first.x,
    clientY: first.y,
  });

  for (const point of rest) {
    fireEvent.pointerMove(el, {
      buttons,
      shiftKey,
      clientX: point.x,
      clientY: point.y,
    });
  }

  fireEvent.pointerUp(el);
}
