import decode from "../util/decode";
import UnreachableCaseError from "../util/UnreachableCaseError";
import noop from "../util/noop";
import {
  ApiAction,
  ApiToken,
  ApiTokenContents,
  isTextContents,
  MessageDecoder,
} from "./api-types";
import { ContentType, EntityType, Token, TokenContents } from "../types";
import { assert } from "../util/invariants";
import {
  Action,
  ApiEventHandler,
  ConnectionError,
  EventType,
} from "./BoardStateApiClient";

function toApiAction(action: Action): ApiAction {
  switch (action.type) {
    case "upsert":
      const { id, type, contents, pos, color } = action.token;
      const apiContents =
        contents.type === ContentType.Text
          ? { text: contents.text }
          : { icon_id: contents.iconId };

      return {
        action: "upsert",
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
    case "delete":
      return {
        action: "delete",
        data: action.entityId,
      };
    case "ping":
      const ping = action.ping;
      return {
        action: "ping",
        data: {
          type: "ping",
          id: ping.id,
          ...ping.pos,
        },
      };
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(action);
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

function toType(type: "character" | "floor") {
  switch (type) {
    case "character":
      return EntityType.Character;
    case "floor":
      return EntityType.Floor;
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(type);
  }
}

function toAction(apiAction: ApiAction): Action {
  switch (apiAction.action) {
    case "delete":
      return {
        type: "delete",
        entityId: apiAction.data,
      };
    case "ping":
      const ping = apiAction.data;
      return {
        type: "ping",
        ping: {
          id: ping.id,
          type: EntityType.Ping,
          pos: {
            x: ping.x,
            y: ping.y,
          },
        },
      };
    case "upsert":
      const token = apiAction.data;
      return {
        type: "upsert",
        token: {
          id: token.id,
          type: toType(token.type),
          contents: toContents(token.contents),
          pos: {
            x: token.start_x,
            y: token.start_y,
            z: token.start_z,
          },
          color: token.color_rgb,
        },
      };
  }
}

function toToken(apiToken: ApiToken): Token {
  const token: Token = {
    id: apiToken.id,
    type: apiToken.type as EntityType.Character | EntityType.Floor,
    contents: toContents(apiToken.contents),
    pos: {
      x: apiToken.start_x,
      y: apiToken.start_y,
      z: apiToken.start_z,
    },
  };
  if (apiToken.type === "character") {
    token.color = apiToken.color_rgb;
  }
  return token;
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

  public send(requestId: string, actions: Action[]) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          request_id: requestId,
          actions: actions.map(toApiAction),
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
      case "update":
        this.eventHandler({
          type: EventType.Update,
          requestId: message.request_id,
          actions: message.actions.map(toAction),
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
          tokens: message.data.map(toToken),
        });
        break;
      /* istanbul ignore next */
      default:
        throw new UnreachableCaseError(message);
    }
  }
}
