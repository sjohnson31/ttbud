import React, {
  CSSProperties,
  PointerEventHandler,
  ReactElement,
  TransitionEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/rootReducer";
import { assert } from "../util/invariants";
import Pos2d, { posAreEqual } from "../util/shape-math";
import UnreachableCaseError from "../util/UnreachableCaseError";
import {
  endDrag,
  moveDrag,
  portalDrag,
  releaseDrag,
  startDrag,
} from "./drag-slice";
import { DraggableDescriptor, DragStateType } from "./DragStateTypes";

export interface DragAttributes {
  ref: React.Ref<any>;
  style: CSSProperties;
  onPointerDown?: PointerEventHandler;
  onTransitionEnd?: TransitionEventHandler;
}

interface Props {
  descriptor: DraggableDescriptor;
  usePortal?: boolean;
  droppableId?: string;
  children: (
    isDragging: boolean,
    dragAttributes: DragAttributes
  ) => ReactElement | null;
}

const MODIFIER_KEYS = ["Alt", "Control", "Meta", "Shift"];

const modifierKeyPressed = (e: React.MouseEvent): boolean => {
  return MODIFIER_KEYS.some((key) => e.getModifierState(key));
};

interface NotDragging {
  type: DragStateType.NotDragging;
}

interface DraggingOrAnimating {
  type: DragStateType.Dragging | DragStateType.DragEndAnimating;
  offset: Pos2d;
}

type InternalDragState = NotDragging | DraggingOrAnimating;

const dragStatesAreEqual = (
  left: InternalDragState,
  right: InternalDragState
) => {
  if (
    left.type === DragStateType.NotDragging ||
    right.type === DragStateType.NotDragging
  ) {
    return left.type === right.type;
  }

  return left.type === right.type && posAreEqual(left.offset, right.offset);
};

const getStyle = (
  state: InternalDragState,
  usePortal: boolean
): CSSProperties => {
  const style: CSSProperties = {
    userSelect: "none",
    cursor: state.type === DragStateType.Dragging ? "grabbing" : "grab",
  };

  if (
    state.type === DragStateType.Dragging ||
    state.type === DragStateType.DragEndAnimating
  ) {
    style.transform = `translate(${state.offset.x}px, ${state.offset.y}px)`;
    style.zIndex = 10_000;
  }

  if (state.type === DragStateType.DragEndAnimating) {
    style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
  }

  const isDragging =
    state.type === DragStateType.Dragging ||
    state.type === DragStateType.DragEndAnimating;

  if (usePortal && isDragging) {
    style.position = "fixed";
  }
  return style;
};

const LEFT_MOUSE = 1;

const Draggable: React.FC<Props> = ({
  descriptor,
  usePortal = false,
  droppableId,
  children,
}) => {
  const ref = useRef<HTMLElement>(null);
  const dispatch = useDispatch();

  const dragState = useSelector((appState: RootState): InternalDragState => {
    const state = appState.drag;
    if (
      state.type === DragStateType.NotDragging ||
      // Only care if it's us that's dragging
      state.draggable.id !== descriptor.id
    ) {
      return { type: DragStateType.NotDragging };
    }

    switch (state.type) {
      case DragStateType.Dragging:
        return {
          type: DragStateType.Dragging,
          offset: {
            x: state.bounds.left - state.source.bounds.left,
            y: state.bounds.top - state.source.bounds.top,
          },
        };
      case DragStateType.DragEndAnimating:
        return {
          type: DragStateType.DragEndAnimating,
          offset: {
            x: state.destination.bounds.left - state.source.bounds.left,
            y: state.destination.bounds.top - state.source.bounds.top,
          },
        };
      /* istanbul ignore next */
      default:
        throw new UnreachableCaseError(state);
    }
  }, dragStatesAreEqual);

  useLayoutEffect(() => {
    // If we're using a portal, we need to re-measure ourselves as
    // soon as we re-render into a portal for dragging since we've
    // likely just jumped around the page
    if (dragState.type !== DragStateType.Dragging || !usePortal) {
      return;
    }
    assert(ref.current, `Draggable ${descriptor.id} ref not set`);

    const bounds = ref.current.getBoundingClientRect();
    dispatch(
      portalDrag({
        draggable: descriptor,
        bounds: {
          top: bounds.top,
          left: bounds.left,
          bottom: bounds.bottom,
          right: bounds.right,
        },
      })
    );
  }, [descriptor, dispatch, dragState.type, usePortal]);

  const onPointerDown: PointerEventHandler = useCallback(
    (e) => {
      if (e.buttons !== LEFT_MOUSE || modifierKeyPressed(e)) {
        return;
      }
      assert(ref.current, `Draggable ${descriptor} did not assign its ref`);

      const bounds = ref.current.getBoundingClientRect();
      const mousePos = { x: e.clientX, y: e.clientY };

      dispatch(
        // Have to copy bounds because ClientRect is not serializable
        startDrag(descriptor, droppableId, mousePos, {
          top: bounds.top,
          left: bounds.left,
          bottom: bounds.bottom,
          right: bounds.right,
        })
      );

      e.stopPropagation();
    },
    [descriptor, dispatch, droppableId]
  );

  useEffect(() => {
    const onPointerUp = ({ clientX: x, clientY: y }: PointerEvent) => {
      if (dragState.type !== DragStateType.Dragging) {
        return;
      }
      assert(ref.current, `Ref for draggable ${descriptor} not set`);

      dispatch(releaseDrag(descriptor, { x, y }));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragState.type !== DragStateType.Dragging) {
        return;
      }

      dispatch(moveDrag(descriptor, { x: e.clientX, y: e.clientY }));
      e.stopPropagation();
    };

    if (dragState.type === DragStateType.Dragging) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [descriptor, dragState, dispatch]);

  const onTransitionEnd = useCallback(() => {
    if (dragState.type !== DragStateType.DragEndAnimating) {
      return;
    }
    dispatch(endDrag(descriptor));
  }, [descriptor, dispatch, dragState.type]);

  const getHandlers = (state: InternalDragState) => {
    switch (state.type) {
      case DragStateType.NotDragging:
        return { onPointerDown };
      case DragStateType.DragEndAnimating:
        return { onTransitionEnd };
      case DragStateType.Dragging:
        return {};
      /* istanbul ignore next */
      default:
        throw new UnreachableCaseError(state);
    }
  };

  const isDragging =
    dragState.type === DragStateType.Dragging ||
    dragState.type === DragStateType.DragEndAnimating;

  const element = children(isDragging, {
    ref,
    style: getStyle(dragState, usePortal),
    ...getHandlers(dragState),
  });

  return usePortal && isDragging
    ? createPortal(element, document.body)
    : element;
};

export default Draggable;
