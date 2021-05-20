import React, {
  CSSProperties,
  PropsWithChildren,
  ReactElement,
  useCallback,
  useRef,
} from "react";
import Droppable, { DroppableAttributes } from "../../drag/Droppable";
import Draggable, { DragAttributes } from "../../drag/Draggable";
import Pos2d, { centerOf, Bounds, contains } from "../../util/shape-math";
import { shallowEqual, useSelector } from "react-redux";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { LocationCollector } from "../../drag/DroppableMonitor";
import { assert } from "../../util/invariants";
import {
  DraggableDescriptor,
  DragStateType,
  DroppableLocation,
  LocationType,
} from "../../drag/DragStateTypes";
import { RootState } from "../../store/rootReducer";

export interface DraggableItem {
  descriptor: DraggableDescriptor;
}

export interface Target {
  dropBounds: Bounds;
  destination: Bounds;
}

export interface Targets {
  innerDrag: Target[];
  outerDrag: Target[];
}

interface Props<T> {
  id: string;
  items: T[];
  getTargets: (draggable: DraggableDescriptor, bounds: Bounds) => Targets;
  style?: CSSProperties;
  /**
   * If true, draggables inside the list will not be allowed to be dragged
   * outside of the parent container
   */
  constrainDragsToContainer?: boolean;
  children: (
    item: T,
    isDragging: boolean,
    attributes: DragAttributes
  ) => ReactElement;
}

const SHUFFLE_TRANSITION = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
const SPACER_TRANSITION =
  "height 0.2s cubic-bezier(0.2, 0, 0, 1), width 0.2s cubic-bezier(0.2, 0, 0, 1)";

interface SortState {
  draggableId?: string;
  dragStartIdx?: number;
  hoverIdx?: number;
  isHovering: boolean;
  isDragging: boolean;
}

const NOT_SORTING: SortState = {
  isDragging: false,
  isHovering: false,
};

interface HoverState {
  pos: Pos2d;
  dragStartedHere: boolean;
  isHovering: boolean;
}

function getListIdx(
  droppableId: string,
  location: DroppableLocation
): number | undefined {
  if (location.id === droppableId) {
    assert(
      location.logicalLocation?.type === LocationType.List,
      "Location is sortable list but logical location is not of type list"
    );

    return location.logicalLocation.idx;
  }

  return;
}

// Have to define as a function here so we can have generics
export default function SortableList<T extends DraggableItem>({
  id,
  items,
  getTargets,
  constrainDragsToContainer = false,
  children: renderChild,
  style = {},
}: PropsWithChildren<Props<T>>): ReactElement {
  const targets = useRef<Targets>();
  const container = useRef<HTMLElement>();

  const getHoverIdx = ({
    pos,
    dragStartedHere,
    isHovering,
  }: HoverState): number | undefined => {
    if (!isHovering) {
      return;
    }
    assert(targets.current, "onBeforeDragStart not called before drag started");

    const bounds = dragStartedHere
      ? targets.current.innerDrag
      : targets.current.outerDrag;
    for (const [idx, target] of bounds.entries()) {
      if (contains(target.dropBounds, pos)) {
        return idx;
      }
    }
  };

  const { isHovering, isDragging, hoverIdx, dragStartIdx, draggableId } =
    useSelector((state: RootState): SortState => {
      const dragState = state.drag;

      switch (dragState.type) {
        case DragStateType.NotDragging:
          return NOT_SORTING;
        case DragStateType.Dragging:
          if (dragState.source.id === id) {
            assert(
              dragState.source.logicalLocation?.type === LocationType.List,
              "Drag started from sortable list but source location isn't of type list"
            );
          }

          return {
            isHovering: dragState.hoveredDroppableId === id,
            isDragging: true,
            hoverIdx: getHoverIdx({
              pos: centerOf(dragState.bounds),
              dragStartedHere: dragState.source.id === id,
              isHovering: dragState.hoveredDroppableId === id,
            }),
            dragStartIdx: getListIdx(id, dragState.source),
            draggableId: dragState.draggable?.id,
          };
        case DragStateType.DragEndAnimating:
          return {
            isHovering: dragState.destination.id === id,
            isDragging: true,
            hoverIdx: getListIdx(id, dragState.destination),
            draggableId: dragState.draggable?.id,
            dragStartIdx: getListIdx(id, dragState.source),
          };
        /* istanbul ignore next */
        default:
          throw new UnreachableCaseError(dragState);
      }
    }, shallowEqual);

  const onBeforeDragStart = useCallback(
    (draggable: DraggableDescriptor, bounds: Bounds) =>
      (targets.current = getTargets(draggable, bounds)),
    [getTargets]
  );

  const getLocation: LocationCollector = useCallback(
    (draggable, pos) => {
      const dragStartedHere = items.some(
        (item) => item.descriptor.id === draggable.id
      );
      assert(
        targets.current,
        "onBeforeDragStart not called before drag started"
      );
      const childBounds = dragStartedHere
        ? targets.current.innerDrag
        : targets.current.outerDrag;

      for (const [idx, target] of childBounds.entries()) {
        if (contains(target.dropBounds, pos)) {
          return {
            logicalLocation: {
              type: LocationType.List,
              idx,
            },
            bounds: {
              top: target.destination.top,
              left: target.destination.left,
              bottom: target.destination.bottom,
              right: target.destination.right,
            },
          };
        }
      }
    },
    [items]
  );

  const getDragBounds = useCallback(() => {
    assert(
      container.current,
      "SortableList container ref not set up correctly"
    );

    if (constrainDragsToContainer) {
      const containerBounds = container.current.getBoundingClientRect();
      return {
        top: containerBounds.top,
        left: containerBounds.left,
        bottom: containerBounds.bottom,
        right: containerBounds.right,
      };
    } else {
      return undefined;
    }
  }, [constrainDragsToContainer]);

  const getChildStyle = useCallback(
    (idx: number, childDraggableId: string): CSSProperties => {
      if (draggableId === childDraggableId || !isDragging) {
        return {};
      }

      if (hoverIdx === undefined) {
        return {
          transition: SHUFFLE_TRANSITION,
        };
      }

      const eDragStartIdx = dragStartIdx === undefined ? 0 : dragStartIdx;
      const eIdx = dragStartIdx === undefined ? idx + 1 : idx;

      assert(
        targets.current,
        "onBeforeDragStart not called before drag started"
      );
      const bounds =
        dragStartIdx === undefined
          ? targets.current.outerDrag
          : targets.current.innerDrag;

      if (
        hoverIdx < eDragStartIdx &&
        eDragStartIdx > eIdx &&
        hoverIdx <= eIdx
      ) {
        const oldBounds = bounds[eIdx].destination;
        const newBounds = bounds[eIdx + 1].destination;
        const offsetX = newBounds.left - oldBounds.left;
        const offsetY = newBounds.top - oldBounds.top;

        return {
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          transition: SHUFFLE_TRANSITION,
        };
      } else if (
        hoverIdx > eDragStartIdx &&
        eDragStartIdx < eIdx &&
        hoverIdx >= eIdx
      ) {
        const oldBounds = bounds[eIdx].destination;
        const newBounds = bounds[eIdx - 1].destination;
        const offsetX = newBounds.left - oldBounds.left;
        const offsetY = newBounds.top - oldBounds.top;

        return {
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          transition: SHUFFLE_TRANSITION,
        };
      } else {
        return {
          transition: SHUFFLE_TRANSITION,
        };
      }
    },
    [dragStartIdx, draggableId, hoverIdx, isDragging]
  );

  const renderSpacer = useCallback(() => {
    if (!isDragging || dragStartIdx !== undefined) {
      return;
    }

    assert(
      targets.current,
      "onBeforeDragStart not called before starting a drag"
    );

    const firstDestination = targets.current.outerDrag[0].destination;
    let style: CSSProperties;
    if (isHovering) {
      style = {
        height: firstDestination.bottom - firstDestination.top,
        width: firstDestination.right - firstDestination.left,
        transition: SPACER_TRANSITION,
      };
    } else {
      style = { height: 0, width: 0, transition: SPACER_TRANSITION, margin: 0 };
    }

    return <div style={style} />;
  }, [dragStartIdx, isDragging, isHovering]);

  const renderChildren = useCallback(
    (attributes: DroppableAttributes) => {
      return (
        <div
          ref={(el) => {
            container.current = el ?? undefined;
            attributes.ref.current = el;
          }}
          style={style}
        >
          {renderSpacer()}
          {items.map((item, idx) => (
            <Draggable
              key={item.descriptor.id}
              descriptor={item.descriptor}
              droppableId={id}
            >
              {(isDragging, attributes) =>
                renderChild(item, isDragging, {
                  ...attributes,
                  style: {
                    ...attributes.style,
                    ...getChildStyle(idx, item.descriptor.id),
                  },
                })
              }
            </Draggable>
          ))}
        </div>
      );
    },
    [getChildStyle, id, items, renderChild, renderSpacer, style]
  );

  return (
    <>
      <Droppable
        id={id}
        getLocation={getLocation}
        onBeforeDragStart={onBeforeDragStart}
        getDragBounds={getDragBounds}
      >
        {renderChildren}
      </Droppable>
    </>
  );
}
