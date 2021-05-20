import Board, { PureBoard } from "./Board";
import { render } from "@testing-library/react";
import { ContentType, Entity, EntityType } from "../../types";
import { WALL_ICON } from "../icons";
import noop from "../../util/noop";
import { ComponentProps } from "react";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import dragReducer from "../../drag/drag-slice";
import { Provider } from "react-redux";
import { FakeDroppableMonitor } from "../../drag/__test_util__/FakeDroppableMonitor";
import { DomDroppableMonitor } from "../../drag/DroppableMonitor";
import DndContext from "../../drag/DndContext";
import { fireEvent } from "@testing-library/dom";
import { BoardState, upsertEntity } from "./board-state";
import { GRID_SIZE_PX } from "../../config";
import { drag, RIGHT_MOUSE } from "../__test_util__/pointer";

const CHARACTER: Entity = {
  id: "character-id",
  type: EntityType.Character,
  pos: { x: 0, y: 0, z: 0 },
  contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
};

const FLOOR: Entity = {
  id: "floor-id",
  type: EntityType.Floor,
  pos: { x: 0, y: 0, z: 0 },
  contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
};

const DEFAULT_PROPS: Omit<ComponentProps<typeof PureBoard>, "boardState"> = {
  activeFloor: { type: ContentType.Icon, iconId: WALL_ICON.id },
  isDragging: false,
  onFloorCreated: noop,
  onPingCreated: noop,
  onTokenDeleted: noop,
};

interface RenderBoardProps {
  entities?: Entity[];
  props?: Partial<Omit<ComponentProps<typeof PureBoard>, "boardState">>;
}

function renderBoard({ entities = [], props = {} }: RenderBoardProps = {}) {
  const monitor = new FakeDroppableMonitor();
  const store = configureStore({
    reducer: { drag: dragReducer },
    middleware: getDefaultMiddleware({
      thunk: { extraArgument: { monitor } },
    }),
  });

  const boardState: BoardState = {
    entityById: {},
    tokenIdsByPosStr: {},
    charIdsByContentId: {},
  };

  for (const entity of entities) {
    upsertEntity(boardState, entity, true);
  }

  return render(
    <Provider store={store}>
      <DndContext.Provider value={monitor as unknown as DomDroppableMonitor}>
        <PureBoard boardState={boardState} {...DEFAULT_PROPS} {...props} />
      </DndContext.Provider>
    </Provider>
  );
}

describe("Board", () => {
  it("renders pings", () => {
    const { getByLabelText } = renderBoard({
      entities: [{ id: "ping-id", type: EntityType.Ping, pos: { x: 0, y: 0 } }],
    });

    expect(getByLabelText("ping")).toBeVisible();
  });

  it("renders floors", () => {
    const { getByLabelText } = renderBoard({ entities: [FLOOR] });

    expect(getByLabelText("Floor: stone wall")).toBeVisible();
  });

  it("renders characters", () => {
    const { getByLabelText } = renderBoard({ entities: [CHARACTER] });

    expect(getByLabelText("Character: stone wall")).toBeVisible();
  });

  it("deletes floors with right click", () => {
    const onTokenDeleted = jest.fn();

    // Create a board with a floor in the top left
    const { getByLabelText } = renderBoard({
      entities: [
        {
          id: "floor-id-one",
          type: EntityType.Floor,
          pos: { x: 0, y: 0, z: 0 },
          contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
        },
        {
          id: "floor-id-two",
          type: EntityType.Floor,
          pos: { x: 1, y: 1, z: 0 },
          contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
        },
      ],
      props: { onTokenDeleted },
    });

    // Draw from top left and then diagonally down and to the right one square
    drag(
      getByLabelText("Board"),
      [
        { x: 0, y: 0 },
        { x: GRID_SIZE_PX + 1, y: GRID_SIZE_PX + 1 },
      ],
      { buttons: RIGHT_MOUSE }
    );

    expect(onTokenDeleted).toHaveBeenCalledTimes(2);
    expect(onTokenDeleted).toHaveBeenCalledWith("floor-id-one");
    expect(onTokenDeleted).toHaveBeenCalledWith("floor-id-two");
  });

  it("deletes the character covering the floor when right-clicked", () => {
    const onTokenDeleted = jest.fn();

    // Create a board with a floor and a character in the top left
    const { getByLabelText } = renderBoard({
      entities: [
        FLOOR,
        {
          id: "character-id",
          type: EntityType.Character,
          pos: { x: 0, y: 0, z: 1 },
          contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
        },
      ],
      props: { onTokenDeleted },
    });

    // Right click in the top left
    fireEvent.pointerDown(getByLabelText("Board"), {
      buttons: RIGHT_MOUSE,
      clientX: 0,
      clientY: 0,
    });

    expect(onTokenDeleted).toBeCalledWith("character-id");
  });

  it("does not call onTokenDeleted if there is no token there", () => {
    const onTokenDeleted = jest.fn();

    // Create a board with a floor in the top left
    const { getByLabelText } = renderBoard({
      entities: [FLOOR],
      props: { onTokenDeleted },
    });

    // Right click far off towards the bottom right
    fireEvent.pointerDown(getByLabelText("Board"), {
      buttons: RIGHT_MOUSE,
      clientX: 1000,
      clientY: 1000,
    });

    expect(onTokenDeleted).not.toHaveBeenCalled();
  });

  it("creates pings with shift left-click", () => {
    const onPingCreated = jest.fn();
    const { getByLabelText } = renderBoard({ props: { onPingCreated } });
    const board = getByLabelText("Board");

    drag(
      board,
      [
        { x: 0, y: 0 },
        { x: GRID_SIZE_PX + 1, y: GRID_SIZE_PX + 1 },
      ],
      { shiftKey: true }
    );

    expect(onPingCreated).toHaveBeenCalledTimes(2);
    expect(onPingCreated).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(onPingCreated).toHaveBeenCalledWith({ x: 1, y: 1 });
  });

  it("creates floors with left click", () => {
    const onFloorCreated = jest.fn();
    const { getByLabelText } = renderBoard({ props: { onFloorCreated } });

    drag(getByLabelText("Board"), [
      { x: 0, y: 0 },
      { x: GRID_SIZE_PX + 1, y: GRID_SIZE_PX + 1 },
    ]);

    expect(onFloorCreated).toHaveBeenCalledTimes(2);
    expect(onFloorCreated).toBeCalledWith(DEFAULT_PROPS.activeFloor, {
      x: 0,
      y: 0,
    });
    expect(onFloorCreated).toBeCalledWith(DEFAULT_PROPS.activeFloor, {
      x: 1,
      y: 1,
    });
  });

  it("ignores clicks and moves while dragging", () => {
    const onFloorCreated = jest.fn();

    const { getByLabelText } = renderBoard({
      props: { onFloorCreated, isDragging: true },
    });
    const board = getByLabelText("Board");

    drag(board, [
      { x: 0, y: 0 },
      { x: GRID_SIZE_PX + 1, y: GRID_SIZE_PX + 1 },
    ]);
    expect(onFloorCreated).not.toHaveBeenCalled();
  });
});
