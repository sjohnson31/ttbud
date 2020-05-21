import { BoardStateApiClient } from "./BoardStateApiClient";
import { Update, getNetworkUpdates, getLocalState } from "./board-state-diff";
import { MiddlewareAPI } from "@reduxjs/toolkit";
import { v4 as uuid } from "uuid";
import { replaceTokens } from "../ui/board/board-slice";
import throttle from "../util/throttle";
import { RootState } from "../store/rootReducer";
import { Entity } from "../types";

const UPDATE_RATE_MS = 60;

export default class BoardSyncer {
  private readonly unackedUpdates = new Map<string, Update[]>();
  private networkTokens: Entity[] = [];
  private lastUiTokens: Entity[] | undefined = [];
  private sendNetworkUpdatesThrottled: () => void;

  constructor(
    private readonly apiClient: BoardStateApiClient,
    private readonly store: MiddlewareAPI
  ) {
    this.sendNetworkUpdatesThrottled = throttle(
      this.sendNetworkUpdates.bind(this),
      UPDATE_RATE_MS
    );
  }

  onNetworkTokenUpdate(tokens: Entity[], requestId?: string) {
    const state: RootState = this.store.getState();
    this.sendNetworkUpdates();
    this.lastUiTokens = state.board.tokens;
    if (requestId) {
      this.unackedUpdates.delete(requestId);
    }
    this.networkTokens = tokens;

    const localState = getLocalState(
      tokens,
      Array.from(this.unackedUpdates.values()).flat()
    );

    this.store.dispatch(replaceTokens(localState));
  }

  onNetworkUpdateRejected(requestId: string) {
    this.unackedUpdates.delete(requestId);
  }

  onUiTokenUpdate(tokens: Entity[]) {
    if (tokens !== this.lastUiTokens) {
      this.sendNetworkUpdatesThrottled();
    }
  }

  private sendNetworkUpdates() {
    const updates = getNetworkUpdates({
      networkTokens: this.networkTokens,
      uiTokens: this.store.getState().board.tokens,
      unackedUpdates: Array.from(this.unackedUpdates.values()).flat(),
    });

    if (updates.length === 0) {
      return;
    }

    const requestId = uuid();
    this.apiClient.send(requestId, updates);
    this.unackedUpdates.set(requestId, updates);
  }
}
