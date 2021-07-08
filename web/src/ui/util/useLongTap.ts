import React, { useEffect, useRef } from "react";
import { assert } from "../../util/invariants";
import Pos2d, { distance } from "../../util/shape-math";

// Maximum distance in pixels your finger can move to still be considered a long tap
const MAX_MOVE_LONG_TAP_PX = 0;
const LONG_TAP_MS = 250;

interface State {
  startPos?: Pos2d;
  timeoutId?: number;
}

export default function useLongTap<T extends HTMLElement>(
  onLongTap: (e: PointerEvent) => void
): React.RefObject<T> {
  const ref = useRef<T>(null);
  const state = useRef<State>({});
  // Store the callback in a ref because we want to use the callback at the time the long press timeout triggers, not
  // the one that was active at the time the long press started
  const callback = useRef<(e: PointerEvent) => void>();
  callback.current = onLongTap;

  useEffect(() => {
    const el = ref.current;
    assert(el, "useLongTap ref not assigned");

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || e.pointerType !== "touch") return;

      if (state.current.timeoutId) {
        window.clearTimeout(state.current.timeoutId);
      }

      state.current.startPos = { x: e.clientX, y: e.clientY };
      state.current.timeoutId = window.setTimeout(() => {
        if (callback.current) {
          callback.current(e);
        }
      }, LONG_TAP_MS);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!e.isPrimary || e.pointerType !== "touch") return;

      if (state.current.timeoutId) {
        window.clearTimeout(state.current.timeoutId);
      }
      state.current = {};
    };

    const onPointerMove = (e: PointerEvent) => {
      const startPos = state.current.startPos;
      if (!e.isPrimary || e.pointerType !== "touch" || !startPos) return;

      if (
        distance(startPos, { x: e.clientX, y: e.clientY }) >
        MAX_MOVE_LONG_TAP_PX
      ) {
        if (state.current.timeoutId) {
          window.clearTimeout(state.current.timeoutId);
        }
        state.current = {};
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointermove", onPointerMove);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return ref;
}
