import { contentId, Entity, EntityType, Token } from "../../types";
import { Action } from "../../network/BoardStateApiClient";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import Pos2d, { Pos3d, posAreEqual } from "../../util/shape-math";

interface Color {
  red: number;
  green: number;
  blue: number;
}

const COLORS = Object.freeze([
  { red: 255, green: 0, blue: 0 }, // Red
  { red: 0, green: 228, blue: 10 }, // Green
  { red: 0, green: 0, blue: 255 }, // Blue
  { red: 253, green: 216, blue: 53 }, // Yellow
  { red: 2, green: 213, blue: 247 }, // Cyan
  { red: 255, green: 0, blue: 255 }, // Pink
  { red: 94, green: 53, blue: 177 }, // Purple
  { red: 0, green: 0, blue: 0 }, // Black
]);

function colorsEqual(left: Color, right: Color) {
  return (
    left.red === right.red &&
    left.green === right.green &&
    left.blue === right.blue
  );
}

export interface BoardState {
  entityById: { [id: string]: Entity };
  tokenIdsByPosStr: { [pos: string]: string };
  charIdsByContentId: { [contentId: string]: string[] };
}

export interface ActionParams {
  boardState: BoardState;
  action: Action;
  isConfirmed: boolean;
}

export function toPosStr(pos: Pos3d) {
  return `${pos.x},${pos.y},${pos.z}`;
}

export function applyAction({ boardState, action, isConfirmed }: ActionParams) {
  switch (action.type) {
    case "upsert":
      upsertEntity(boardState, action.token, isConfirmed);
      break;
    case "delete":
      deleteEntity(boardState, action.entityId);
      break;
    case "ping":
      upsertEntity(boardState, action.ping, isConfirmed);
      break;
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(action);
  }
}

export function deleteEntity(boardState: BoardState, entityId: string) {
  const entity = boardState.entityById[entityId];
  if (!entity) return;

  delete boardState.entityById[entityId];

  if (entity.type !== "ping") {
    delete boardState.tokenIdsByPosStr[toPosStr(entity.pos)];
  }

  if (entity.type === "character") {
    let id = contentId(entity.contents);
    const idx = boardState.charIdsByContentId[id].indexOf(entityId);
    if (idx !== -1) {
      boardState.charIdsByContentId[id].splice(idx, 1);
    }
  }
}

export function upsertEntity(
  boardState: BoardState,
  entity: Entity,
  isConfirmed: boolean
) {
  // If it's not a ping, check for collision
  if (entity.type !== "ping") {
    const existingId = boardState.tokenIdsByPosStr[toPosStr(entity.pos)];
    // Can't upsert, something's already there
    if (existingId && existingId !== entity.id) return;
  }

  if (boardState.entityById[entity.id]) {
    deleteEntity(boardState, entity.id);
  }
  boardState.entityById[entity.id] = entity;

  // Pings don't store the collision bookkeeping info
  if (entity.type !== "ping") {
    boardState.tokenIdsByPosStr[toPosStr(entity.pos)] = entity.id;
  }

  if (entity.type === "character") {
    const id = contentId(entity.contents);
    const charIds = boardState.charIdsByContentId[id] ?? [];
    charIds.push(entity.id);
    boardState.charIdsByContentId[id] = charIds;

    if (charIds.length > 1 && isConfirmed) {
      const unusedColors = [...COLORS];

      for (const charId of charIds) {
        const entity = boardState.entityById[charId] as Token;
        const entityColor = entity.color;
        if (entityColor) {
          const idx = unusedColors.findIndex((color) =>
            colorsEqual(entityColor, color)
          );
          unusedColors.splice(idx, 1);
        }
      }

      for (const charId of charIds) {
        const entity = boardState.entityById[charId] as Token;
        if (!entity.color) {
          entity.color = unusedColors.shift();
        }
      }
    }
  }
}

export function tokenIdAt(
  boardState: BoardState,
  pos: Pos3d
): string | undefined {
  return boardState.tokenIdsByPosStr[toPosStr(pos)];
}

export function pingAt(boardState: BoardState, pos: Pos2d): string | undefined {
  return Object.values(boardState.entityById).find(
    (entity) => entity.type === EntityType.Ping && posAreEqual(entity.pos, pos)
  )?.id;
}
