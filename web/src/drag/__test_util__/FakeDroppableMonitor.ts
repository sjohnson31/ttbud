import {
  DroppableConfig,
  DroppableConfigApi,
  DroppableMonitor,
} from "../DroppableMonitor";
import Pos2d, { Bounds, contains } from "../../util/shape-math";
import { assert } from "../../util/invariants";

export interface FakeDroppable extends DroppableConfigApi {
  bounds: Bounds;
  zIndex: number;
  onBeforeDragStart?: () => void;
}

/**
 * Fake droppable that avoids interacting with layout since jsdom does not support it
 *
 * Droppables can be set up with bounds directly via setDroppables, but droppables
 * that add themselves dynamically with be zero-area elements at the origin
 */
export class FakeDroppableMonitor implements DroppableMonitor {
  private droppables: FakeDroppable[] = [];

  setDroppables(droppables: FakeDroppable[]) {
    this.droppables = droppables;
  }

  findDroppableAt(pos: Pos2d): DroppableConfigApi | undefined {
    return this.droppables
      .filter((droppable) => contains(droppable.bounds, pos))
      .sort((left, right) => right.zIndex - left.zIndex)[0];
  }

  getDroppable(id: string): DroppableConfigApi {
    const droppable = this.droppables.find((droppable) => droppable.id === id);
    assert(droppable, `Droppable ${id} does not exist`);
    return droppable;
  }

  public addDroppable(config: DroppableConfig) {
    this.droppables.push({
      ...config,
      bounds: { top: 0, left: 0, bottom: 0, right: 0 },
      zIndex: 0,
      onBeforeDragStart: () => {},
    });
  }

  public removeDroppable(droppableId: string) {
    const idx = this.droppables.findIndex(
      (droppable) => (droppable.id = droppableId)
    );
    if (idx !== -1) {
      this.droppables.splice(idx);
    }
  }

  onBeforeDragStart(): void {
    for (const droppable of this.droppables) {
      if (droppable.onBeforeDragStart) {
        droppable.onBeforeDragStart();
      }
    }
  }
}
