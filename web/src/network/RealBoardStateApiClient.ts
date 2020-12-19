import decode from "../util/decode";
import { Update, UpdateType } from "./board-state-diff";
import UnreachableCaseError from "../util/UnreachableCaseError";
import noop from "../util/noop";
import {
  ApiEntity,
  ApiTokenContents,
  ApiUpdate,
  isTextContents,
  MessageDecoder,
} from "./api-types";
import { ContentType, Entity, EntityType, TokenContents } from "../types";
import { assert } from "../util/invariants";
import {
  ApiEventHandler,
  ConnectionError,
  EventType,
} from "./BoardStateApiClient";

function toApiUpdate(update: Update): ApiUpdate {
  switch (update.type) {
    case UpdateType.CREATE:
    case UpdateType.MOVE:
      if (update.token.type === EntityType.Ping) {
        const { id, type, pos } = update.token;
        return {
          action: "ping",
          data: { id, type, x: pos.x, y: pos.y },
        };
      } else {
        const { id, type, contents, pos, color } = update.token;
        const apiContents =
          contents.type === ContentType.Text
            ? { text: contents.text }
            : { icon_id: contents.iconId };

        return {
          action: "update",
          data: {
            id,
            type,
            contents: apiContents,
            start_x: pos.x,
            start_y: pos.y,
            start_z: pos.z,
            end_x: pos.x + 1,
            end_y: pos.y + 1,
            end_z: pos.z + 1,
            color_rgb: color,
          },
        };
      }
    case UpdateType.DELETE:
      return {
        action: "delete",
        data: update.tokenId,
      };
    default:
      throw new UnreachableCaseError(update);
  }
}

function toContents(contents: ApiTokenContents): TokenContents {
  if (isTextContents(contents)) {
    return {
      type: ContentType.Text,
      text: contents.text,
    };
  } else {
    return {
      type: ContentType.Icon,
      iconId: contents.icon_id,
    };
  }
}

function toEntity(apiEntity: ApiEntity): Entity {
  switch (apiEntity.type) {
    case "ping":
      return {
        type: EntityType.Ping,
        id: apiEntity.id,
        pos: {
          x: apiEntity.x,
          y: apiEntity.y,
        },
      };
    case "character":
      return {
        id: apiEntity.id,
        type: apiEntity.type as EntityType.Character,
        contents: toContents(apiEntity.contents),
        pos: {
          x: apiEntity.start_x,
          y: apiEntity.start_y,
          z: apiEntity.start_z,
        },
        color: apiEntity.color_rgb,
      };
    case "floor":
      return {
        id: apiEntity.id,
        type: apiEntity.type as EntityType.Floor,
        contents: toContents(apiEntity.contents),
        pos: {
          x: apiEntity.start_x,
          y: apiEntity.start_y,
          z: apiEntity.start_z,
        },
      };
    default:
      throw new UnreachableCaseError(apiEntity);
  }
}

enum DisconnectErrorCode {
  InvalidUuid = 4001,
  RoomFull = 4002,
  TooManyConnections = 4003,
  TooManyRoomsCreated = 4004,
}

function disconnectReason(disconnectCode: number): ConnectionError {
  switch (disconnectCode) {
    case DisconnectErrorCode.InvalidUuid:
      return ConnectionError.INVALID_ROOM_ID;
    case DisconnectErrorCode.RoomFull:
      return ConnectionError.ROOM_FULL;
    case DisconnectErrorCode.TooManyConnections:
      return ConnectionError.TOO_MANY_CONNECTIONS;
    case DisconnectErrorCode.TooManyRoomsCreated:
      return ConnectionError.TOO_MANY_ROOMS_CREATED;
    default:
      return ConnectionError.UNKNOWN;
  }
}

// See https://tools.ietf.org/html/rfc6455#section-7.4.1
const WS_CODE_CLOSE_NORMAL = 1000;
const CONNECTION_TIMEOUT_MS = 5000;

export class RealBoardStateApiClient {
  private eventHandler: ApiEventHandler = noop;
  private socket: WebSocket | undefined;
  private connectionTimeoutListenerId: number | null = null;

  public constructor(private readonly hostBaseUrl: string) {}

  public setEventHandler(handler: ApiEventHandler) {
    this.eventHandler = handler;
  }

  public connect(roomId: string) {
    const encodedRoomId = encodeURIComponent(roomId);
    this.connectToUrl(`${this.hostBaseUrl}/${encodedRoomId}`);
  }

  public reconnect() {
    assert(this.socket, "Cannot reconnect when no connection has been made");
    this.connectToUrl(this.socket.url);
  }

  public connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public close() {
    this.socket?.close();
  }

  public send(requestId: string, updates: Update[]) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          request_id: requestId,
          updates: updates.map(toApiUpdate),
        })
      );
    } else {
      throw new Error("Cannot send message to disconnected host");
    }
  }

  private connectToUrl(url: string) {
    if (this.socket) {
      this.socket.close(WS_CODE_CLOSE_NORMAL, "Connecting to another room");
    }

    this.socket = new WebSocket(url);
    this.eventHandler({ type: EventType.Connecting });

    this.connectionTimeoutListenerId = window.setTimeout(
      () => this.close(),
      CONNECTION_TIMEOUT_MS
    );
    this.socket.addEventListener("open", this.onConnect.bind(this));
    this.socket.addEventListener("message", this.onMessage.bind(this));
    //TODO: Handle errors
    this.socket.addEventListener("error", console.log.bind(console));
    this.socket.addEventListener("close", this.onClose.bind(this));
  }

  private onConnect() {
    console.log("connected");
    if (this.connectionTimeoutListenerId) {
      window.clearTimeout(this.connectionTimeoutListenerId);
    }
    this.eventHandler({ type: EventType.Connected });
  }

  private onClose(e: CloseEvent) {
    console.log("disconnected", e);
    this.eventHandler({
      type: EventType.Disconnected,
      error: disconnectReason(e.code),
    });
  }

  private onMessage(event: MessageEvent) {
    let message;
    try {
      const json = JSON.parse(event.data);
      message = decode(MessageDecoder, json);
    } catch (e) {
      this.eventHandler({
        type: EventType.Error,
        error: e,
        rawMessage: event.data,
      });
      return;
    }

    switch (message.type) {
      case "state":
        this.eventHandler({
          type: EventType.TokenUpdate,
          requestId: message.request_id,
          tokens: message.data.map(toEntity),
        });
        break;
      case "error":
        this.eventHandler({
          type: EventType.Error,
          requestId: message.request_id,
          rawMessage: event.data,
          error: new Error(message.data),
        });
        break;
      case "connected":
        this.eventHandler({
          type: EventType.InitialState,
          tokens: message.data.map(toEntity),
        });
        break;
      default:
        throw new UnreachableCaseError(message);
    }
  }
}
