import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DragEndAction, dragEnded } from "../../drag/drag-slice";
import { DROPPABLE_IDS } from "../DroppableIds";
import { assert } from "../../util/invariants";
import { DraggableType, LocationType } from "../../drag/DragStateTypes";
import { v4 as uuid } from "uuid";
import getDragResult, { DragResult } from "../../drag/getDragResult";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import Pos2d from "../../util/shape-math";
import { EntityType, Token, TokenContents } from "../../types";
import {
  applyLocalAction,
  applyNetworkUpdate,
  collectUpdate,
  MergeState,
} from "./action-reconciliation";
import { Action } from "../../network/BoardStateApiClient";
import { AppThunk } from "../../store/createStore";
import pause from "../../util/pause";

const INITIAL_STATE: MergeState = {
  unqueuedActions: [],
  queuedUpdates: [],
  local: {
    entityById: {},
    charIdsByContentId: {},
    tokenIdsByPosStr: {},
  },
  network: {
    entityById: {},
    charIdsByContentId: {},
    tokenIdsByPosStr: {},
  },
};

interface NetworkUpdateAction {
  actions: Action[];
  updateId: string;
}

interface AddTokenAction {
  id: string;
  contents: TokenContents;
  pos: Pos2d;
}

interface AddPingAction {
  id: string;
  pos: Pos2d;
}

interface BatchUnqueuedAction {
  updateId: string;
}

export const FLOOR_HEIGHT = 0;
export const CHARACTER_HEIGHT = 1;

const boardSlice = createSlice({
  name: "board",
  initialState: INITIAL_STATE,
  reducers: {
    receiveInitialState(state, action: PayloadAction<Token[]>) {
      applyNetworkUpdate(
        state,
        action.payload.map((token) => ({ type: "upsert", token }))
      );
    },
    receiveNetworkUpdate(state, action: PayloadAction<NetworkUpdateAction>) {
      const { actions, updateId } = action.payload;
      applyNetworkUpdate(state, actions, updateId);
    },
    batchUnqueuedActions(state, action: PayloadAction<BatchUnqueuedAction>) {
      collectUpdate(state, action.payload.updateId);
    },
    clear(state) {
      for (const [id] of Object.entries(state.local.entityById)) {
        applyLocalAction(state, { type: "delete", entityId: id });
      }
    },
    addFloor: {
      reducer: (state, action: PayloadAction<AddTokenAction>) => {
        const { id, contents, pos } = action.payload;

        applyLocalAction(state, {
          type: "upsert",
          token: {
            id,
            contents,
            type: EntityType.Floor,
            pos: {
              ...pos,
              z: FLOOR_HEIGHT,
            },
          },
        });
      },
      prepare: (contents: TokenContents, pos: Pos2d) => ({
        payload: { id: uuid(), contents, pos },
      }),
    },
    pingAdded: (state, action: PayloadAction<AddPingAction>) => {
      const { id, pos } = action.payload;
      applyLocalAction(state, {
        type: "ping",
        ping: {
          type: EntityType.Ping,
          id,
          pos,
        },
      });
    },
    removeEntity(state, action: PayloadAction<string>) {
      const id = action.payload;
      applyLocalAction(state, {
        type: "delete",
        entityId: id,
      });
    },
  },
  extraReducers: {
    [dragEnded.type]: (state, action: PayloadAction<DragEndAction>) => {
      const { draggable, destination } = action.payload;

      const dragResult = getDragResult(DROPPABLE_IDS.BOARD, action.payload);

      switch (dragResult) {
        case DragResult.MovedInside:
          const loc = destination.logicalLocation;
          assert(
            draggable.type === DraggableType.Token,
            "Dragged from board but draggable type was not token"
          );
          assert(
            loc?.type === LocationType.Grid,
            "Dropped in board but drop type was not grid"
          );

          const token = state.local.entityById[draggable.tokenId];
          // The token was deleted before the drag completed
          if (!token) return;
          assert(
            token.type === "character",
            "Draggable had the id of a non-character token"
          );

          const newToken = {
            ...token,
            pos: { x: loc.x, y: loc.y, z: CHARACTER_HEIGHT },
          } as Token;

          applyLocalAction(state, {
            type: "upsert",
            token: newToken,
          });
          break;
        case DragResult.DraggedOutOf:
          // Dragging a token to a tray from the board should not remove the token from the board
          break;
        case DragResult.DraggedInto:
          assert(
            destination.logicalLocation?.type === LocationType.Grid,
            "Dropped in board but drop type was not grid"
          );

          const { x, y } = destination.logicalLocation;
          applyLocalAction(state, {
            type: "upsert",
            token: {
              type: EntityType.Character,
              id: uuid(),
              contents: draggable.contents,
              pos: { x, y, z: CHARACTER_HEIGHT },
            },
          });
          break;
        case DragResult.None:
          break;
        /* istanbul ignore next */
        default:
          throw new UnreachableCaseError(dragResult);
      }
    },
  },
});

function addPing(pos: Pos2d): AppThunk {
  return async (dispatch) => {
    const id = uuid();
    dispatch(pingAdded({ id, pos }));
    await pause(3000);
    dispatch(removeEntity(id));
  };
}

const {
  addFloor,
  removeEntity,
  clear,
  pingAdded,
  receiveInitialState,
  receiveNetworkUpdate,
  batchUnqueuedActions,
} = boardSlice.actions;

export {
  addFloor,
  addPing,
  removeEntity,
  clear,
  receiveInitialState,
  receiveNetworkUpdate,
  batchUnqueuedActions,
};
export default boardSlice.reducer;
