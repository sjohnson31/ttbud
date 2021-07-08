import React, {
  MouseEventHandler,
  PointerEventHandler,
  useCallback,
  useRef,
} from "react";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../config";
import Floor from "../token/Floor";
import Character from "../token/Character";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import Ping from "../token/Ping";
import Draggable from "../../drag/Draggable";
import Droppable from "../../drag/Droppable";
import Pos2d, { posAreEqual, snapToGrid } from "../../util/shape-math";
import { assert } from "../../util/invariants";
import { LocationCollector, TargetLocation } from "../../drag/DroppableMonitor";
import {
  DraggableType,
  DragStateType,
  LocationType,
} from "../../drag/DragStateTypes";
import { DROPPABLE_IDS } from "../DroppableIds";
import { TransitionGroup } from "react-transition-group";
import Fade from "../transition/Fade";
import NoopTransition from "../transition/NoopTransition";
import { RootState } from "../../store/rootReducer";
import {
  addFloor,
  addPing,
  CHARACTER_HEIGHT,
  FLOOR_HEIGHT,
  InteractionType,
  removeEntity,
} from "./board-slice";
import { connect } from "react-redux";
import { EntityType, TokenContents } from "../../types";
import { BoardState, pingAt, tokenIdAt } from "./board-state";
import { Buttons } from "../util/Buttons";
import useDoubleTap, { DoubleTapState } from "../util/useDoubleTap";
import useLongTap from "../util/useLongTap";
import mergeRefs from "../../util/mergeRefs";

let GRID_COLOR = "#947C65";

const useStyles = makeStyles((theme) => ({
  container: {
    width: "100%",
    height: "100%",
  },
  board: {
    // Otherwise safari will try to "select" the empty text next to each floor icon
    userSelect: "none",
    backgroundColor: theme.palette.background.default,
    backgroundImage: `repeating-linear-gradient(
      0deg,
      transparent,
      transparent ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX}px
    ),
    repeating-linear-gradient(
      -90deg,
      transparent,
      transparent ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX - 1}px,
      ${GRID_COLOR} ${GRID_SIZE_PX}px
    )`,
    borderBottom: `1px solid ${GRID_COLOR}`,
    borderRight: `1px solid ${GRID_COLOR}`,
    backgroundSize: `${GRID_SIZE_PX}px ${GRID_SIZE_PX}px`,
    height: "100%",
    width: "100%",
    zIndex: 0,
  },
}));

type PointerAction = "delete" | "ping" | "draw" | "ignore";

const scrolledPos = (pixelPos: Pos2d) => {
  return {
    x: pixelPos.x + document.documentElement.scrollLeft,
    y: pixelPos.y + document.documentElement.scrollTop,
  };
};

const toGridPos = (pixelPos: Pos2d) => {
  const snappedPixelPos = snapToGrid(scrolledPos(pixelPos));
  return {
    x: snappedPixelPos.x / GRID_SIZE_PX,
    y: snappedPixelPos.y / GRID_SIZE_PX,
  };
};

const preventDefault: MouseEventHandler = (e) => e.preventDefault();

interface Props {
  isDragging: boolean;
  interactionState: InteractionType;
  boardState: BoardState;
  activeFloor: TokenContents;
  onPingCreated: (pos: Pos2d) => void;
  onFloorCreated: (contents: TokenContents, pos: Pos2d) => void;
  onTokenDeleted: (id: string) => void;
}

const mapStateToProps = (state: RootState) => ({
  isDragging: state.drag.type === DragStateType.Dragging,
  interactionState: state.board.interaction,
  boardState: state.board.tokens.local,
  activeFloor: state.floorTray.activeFloor,
});

const dispatchProps = {
  onPingCreated: addPing,
  onFloorCreated: addFloor,
  onTokenDeleted: removeEntity,
};

const PureBoard: React.FC<Props> = ({
  isDragging,
  interactionState,
  boardState,
  activeFloor,
  onPingCreated,
  onFloorCreated,
  onTokenDeleted,
}) => {
  const classes = useStyles();

  const handlePointerAction = useCallback(
    (action: PointerAction, gridPos: Pos2d, allowDuplicatePings: boolean) => {
      switch (action) {
        case "ping":
          if (allowDuplicatePings || !pingAt(boardState, gridPos)) {
            onPingCreated(gridPos);
          }
          break;
        case "draw":
          if (!tokenIdAt(boardState, { ...gridPos, z: FLOOR_HEIGHT })) {
            onFloorCreated(activeFloor, gridPos);
          }
          break;
        case "delete":
          let toDeleteId = tokenIdAt(boardState, {
            ...gridPos,
            z: CHARACTER_HEIGHT,
          });
          if (!toDeleteId) {
            toDeleteId = tokenIdAt(boardState, {
              ...gridPos,
              z: FLOOR_HEIGHT,
            });
          }
          if (toDeleteId) {
            onTokenDeleted(toDeleteId);
          }
          break;
        case "ignore":
          break;
        default:
          throw new UnreachableCaseError(action);
      }
    },
    [activeFloor, boardState, onFloorCreated, onPingCreated, onTokenDeleted]
  );

  const onDoubleTap = useCallback(
    (e: PointerEvent) => {
      if (isDragging) return;

      const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
      handlePointerAction(interactionState, gridPos, true);
    },
    [isDragging, interactionState, handlePointerAction]
  );

  const [doubleTapRef, doubleTapState] =
    useDoubleTap<HTMLDivElement>(onDoubleTap);

  const onLongTap = useCallback(
    (e: PointerEvent) => {
      if (isDragging || doubleTapState === DoubleTapState.Active) return;

      const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
      handlePointerAction("ping", gridPos, true);
    },
    [isDragging, handlePointerAction, doubleTapState]
  );

  const container = useRef<HTMLDivElement>(null);
  const longTapRef = useLongTap<HTMLDivElement>(onLongTap);

  const getLocation: LocationCollector = useCallback(
    (draggable, pos): TargetLocation | undefined => {
      assert(container.current, "Board ref not assigned properly");
      const gridPos = toGridPos(pos);

      const existingTokenId = tokenIdAt(boardState, {
        ...gridPos,
        z: CHARACTER_HEIGHT,
      });
      const draggedTokenId =
        draggable.type === DraggableType.Token ? draggable.tokenId : undefined;
      if (existingTokenId && existingTokenId !== draggedTokenId) {
        return;
      }

      const containerRect = container.current.getBoundingClientRect();
      const snappedPixelPos = snapToGrid(scrolledPos(pos));
      return {
        logicalLocation: {
          type: LocationType.Grid,
          ...gridPos,
        },
        bounds: {
          top: snappedPixelPos.y + containerRect.y,
          left: snappedPixelPos.x + containerRect.x,
          bottom: snappedPixelPos.y + containerRect.y + GRID_SIZE_PX,
          right: snappedPixelPos.x + containerRect.x + GRID_SIZE_PX,
        },
      };
    },
    [boardState, container]
  );

  const tokenIcons = Object.values(boardState.entityById).map((token) => {
    const pixelPos = {
      x: token.pos.x * GRID_SIZE_PX,
      y: token.pos.y * GRID_SIZE_PX,
    };

    switch (token.type) {
      case EntityType.Floor:
        return (
          <Fade lengthMs={50} key={token.id}>
            <Floor key={token.id} contents={token.contents} pos={pixelPos} />
          </Fade>
        );
      case EntityType.Character:
        return (
          // Need to have some sort of transition otherwise the element will
          // never be removed from the dom :(
          <NoopTransition key={token.id}>
            <Draggable
              droppableId={DROPPABLE_IDS.BOARD}
              dragEnabled={interactionState === InteractionType.Draw}
              descriptor={{
                id: `${DROPPABLE_IDS.BOARD}-${token.id}`,
                type: DraggableType.Token,
                contents: token.contents,
                tokenId: token.id,
              }}
            >
              {(isDragging, attributes) => (
                <Character
                  dragAttributes={attributes}
                  contents={token.contents}
                  isDragging={isDragging}
                  color={token.color}
                  pos={{
                    x: pixelPos.x,
                    y: pixelPos.y,
                    z: token.pos.z,
                  }}
                />
              )}
            </Draggable>
          </NoopTransition>
        );
      case EntityType.Ping:
        return (
          <Fade key={token.id} lengthMs={1000}>
            <Ping x={pixelPos.x} y={pixelPos.y} />
          </Fade>
        );
      /* istanbul ignore next */
      default:
        throw new UnreachableCaseError(token);
    }
  });

  const getTouchAction = (): PointerAction => {
    if (doubleTapState !== DoubleTapState.Active) {
      return "ignore";
    }

    switch (interactionState) {
      case InteractionType.Draw:
        return "draw";
      case InteractionType.Delete:
        return "delete";
      case InteractionType.Ping:
        return "ping";
      default:
        throw new UnreachableCaseError(interactionState);
    }
  };

  const getMouseAction = (e: React.PointerEvent): PointerAction => {
    if (e.shiftKey && e.buttons === Buttons.LEFT_MOUSE) {
      return "ping";
    } else if (e.buttons === Buttons.LEFT_MOUSE) {
      if (interactionState === InteractionType.Delete) {
        return "delete";
      } else if (interactionState === InteractionType.Ping) {
        return "ping";
      } else {
        return "draw";
      }
    } else if (e.buttons === Buttons.RIGHT_MOUSE) {
      return "delete";
    } else {
      return "ignore";
    }
  };

  const getPointerAction = (e: React.PointerEvent): PointerAction => {
    if (isDragging) return "ignore";

    switch (e.pointerType) {
      case "pen":
        return "draw";
      case "touch":
        return getTouchAction();
      default:
        return getMouseAction(e);
    }
  };

  const onPointerDown: PointerEventHandler = (e) => {
    const action = getPointerAction(e);

    // Stop pen users from scrolling with their pen
    if (e.pointerType === "pen") e.preventDefault();

    const gridPos = toGridPos({ x: e.clientX, y: e.clientY });
    handlePointerAction(action, gridPos, true);
  };

  const onPointerMove: PointerEventHandler = (e) => {
    // Stop pen users from scrolling with their pen
    if (e.pointerType === "pen") e.preventDefault();

    // Pointer events are only triggered once per frame, but if the mouse is
    // moving quickly it can actually move over an entire grid square in less
    // than a frame's time, so we'll miss drawing walls in certain places. In
    // browsers that support it, we can request all of the mouse move events
    // since the last frame, and then batch process those
    let events: PointerEvent[];
    if (e.nativeEvent.getCoalescedEvents) {
      events = e.nativeEvent.getCoalescedEvents();
    } else {
      events = [e.nativeEvent];
    }

    const processedPositions: Pos2d[] = [];
    for (const event of events) {
      const action = getPointerAction(e);
      const { clientX: x, clientY: y } = event;
      const gridPos = toGridPos({ x, y });
      // Skip mouse events that result in the same grid position
      if (processedPositions.some((pos) => posAreEqual(pos, gridPos))) {
        continue;
      }
      handlePointerAction(action, gridPos, false);
      processedPositions.push(gridPos);
    }
  };

  // If we're going to touch draw, disable touch scrolling
  // We disable touch scrolling before even getting to the second tap because for some browsers once the gesture has
  // started we can no longer interrupt the panning.
  const touchAction =
    doubleTapState === DoubleTapState.Active ||
    doubleTapState === DoubleTapState.WaitingForSecondTap
      ? "none"
      : "auto";

  return (
    <div
      ref={mergeRefs(container, doubleTapRef, longTapRef)}
      className={classes.container}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onContextMenu={preventDefault}
      aria-label={"Board"}
      style={{ touchAction }}
    >
      <Droppable id={DROPPABLE_IDS.BOARD} getLocation={getLocation}>
        {(attributes) => (
          <div {...attributes} className={classes.board}>
            <TransitionGroup>{tokenIcons}</TransitionGroup>
          </div>
        )}
      </Droppable>
    </div>
  );
};

const Board = connect(mapStateToProps, dispatchProps)(PureBoard);

export { PureBoard };
export default Board;
