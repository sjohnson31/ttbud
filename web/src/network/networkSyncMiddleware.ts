import { Dispatch, Middleware, MiddlewareAPI } from "@reduxjs/toolkit";
import {
  connected,
  connecting,
  ConnectionStateType,
  disconnected,
} from "../ui/connection-state/connection-state-slice";
import { RootState } from "../store/rootReducer";
import {
  receiveInitialState,
  receiveNetworkUpdate,
  batchUnqueuedActions,
} from "../ui/board/board-slice";
import BoardStateApiClient, {
  ConnectionError,
  EventType,
} from "./BoardStateApiClient";
import { v4 as uuid } from "uuid";
import throttle from "../util/throttle";
import { Update } from "../ui/board/action-reconciliation";

const UPDATE_RATE_MS = 250;

/**
 * Sync network state and ui state
 */
export function networkSyncMiddleware(
  apiClient: BoardStateApiClient
): Middleware {
  return (store: MiddlewareAPI<Dispatch, RootState>) => {
    let retryTimeoutId: number | undefined = undefined;

    const sendUpdates = throttle(() => {
      const state = store.getState();
      if (
        state.board.tokens.unqueuedActions.length === 0 ||
        state.connectionState.type !== ConnectionStateType.Connected
      ) {
        return;
      }

      const requestId = uuid();
      store.dispatch(batchUnqueuedActions({ updateId: requestId }));
      const update = store
        .getState()
        .board.tokens.queuedUpdates.find(
          (update: Update) => update.updateId === requestId
        );
      if (update) {
        apiClient.send(requestId, update.actions);
      }
    }, UPDATE_RATE_MS);

    apiClient.setEventHandler((event) => {
      switch (event.type) {
        case EventType.Connected:
          store.dispatch(connected());
          sendUpdates();
          break;
        case EventType.Disconnected:
          const state = store.getState().connectionState;
          const waitTimeSecs =
            state.type === ConnectionStateType.Connecting ||
            state.type === ConnectionStateType.Disconnected
              ? Math.pow(state.numRetries, 2)
              : 0;
          if (event.error === ConnectionError.UNKNOWN) {
            if (retryTimeoutId) {
              window.clearTimeout(retryTimeoutId);
            }
            retryTimeoutId = window.setTimeout(
              () => apiClient.reconnect(),
              waitTimeSecs * 1000
            );
          }

          store.dispatch(disconnected({ error: event.error }));
          break;
        case EventType.Connecting:
          store.dispatch(connecting());
          break;
        case EventType.InitialState:
          store.dispatch(receiveInitialState(event.tokens));
          break;
        case EventType.Update:
          store.dispatch(
            receiveNetworkUpdate({
              updateId: event.requestId,
              actions: event.actions,
            })
          );
          break;
        case EventType.Error:
          //TODO: Issue #538 Maybe disconnect/reconnect? This shouldn't happen if everything is working well.
          console.error(event.rawMessage);
          break;
      }
    });

    return (next) => (action) => {
      const result = next(action);
      if (action.type !== batchUnqueuedActions.type) {
        sendUpdates();
      }

      return result;
    };
  };
}
