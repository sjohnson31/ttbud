import React, { useDebugValue, useEffect, useRef, useState } from "react";
import { assert } from "../../util/invariants";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import pause from "../../util/pause";

const DOUBLE_TAP_TIMEOUT_MS = 250;

export enum DoubleTapState {
  None = "none",
  WaitingForSecondTap = "waiting for second tap",
  Active = "active",
}

type Response<T> = [el: React.RefObject<T>, state: DoubleTapState];

export default function useDoubleTap<T extends HTMLElement>(
  onDoubleTap: (e: PointerEvent) => void
): Response<T> {
  const ref = useRef<T>(null);
  const [state, setState] = useState(DoubleTapState.None);
  useDebugValue(state);

  useEffect(() => {
    const el = ref.current;
    assert(el, "useDoubleTap ref not assigned");

    const onPointerDown = async (e: PointerEvent) => {
      // Only consider the "primary" finger so that pinch zoom actions don't trigger a double tap
      if (!e.isPrimary || e.pointerType !== "touch") return;

      switch (state) {
        case DoubleTapState.None:
          // In chrome, changing touch-action in the pointerdown event listener will stop the page from scrolling, but
          // in safari it will not. Wait for the next run of the event loop so that both browsers behave the same way
          await pause(0);
          setState(DoubleTapState.WaitingForSecondTap);
          await pause(DOUBLE_TAP_TIMEOUT_MS);
          // Have to use the callback form to get the state at the time after the pause instead of the time of the first
          // tap
          setState((state) => {
            return state === DoubleTapState.WaitingForSecondTap
              ? DoubleTapState.None
              : state;
          });
          break;
        case DoubleTapState.WaitingForSecondTap:
          setState(DoubleTapState.Active);
          onDoubleTap(e);
          break;
        case DoubleTapState.Active:
          // We're already in the double tap gesture, we can just ignore it
          break;
        default:
          throw new UnreachableCaseError(state);
      }
    };

    const onPointerUp = () => {
      if (state === DoubleTapState.Active) {
        setState(DoubleTapState.None);
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [state, onDoubleTap]);

  return [ref, state];
}
