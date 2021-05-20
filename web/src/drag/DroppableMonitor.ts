import { RefObject } from "react";
import { assert } from "../util/invariants";
import Pos2d, { Bounds } from "../util/shape-math";
import { DraggableDescriptor, LogicalLocation } from "./DragStateTypes";

export interface TargetLocation {
  bounds: Bounds;
  logicalLocation: LogicalLocation;
}

export type LocationCollector = (
  draggable: DraggableDescriptor,
  pos: Pos2d
) => TargetLocation | undefined;

// Split the api and the config passed in so that only what's
// required is returned from methods that return a droppable
export interface DroppableConfigApi {
  id: string;
  /**
   * Fetch the location a draggable should animate to if it is
   * dropped here. The position is the center of the proposed
   * drop location.
   */
  getLocation: LocationCollector;
  /**
   * Fetch the drag bounds for draggables inside this droppable. Draggables
   * within this droppable will not be allowed to be dragged out of the drag
   * bounds
   */
  getDragBounds?: () => Bounds | undefined;
}

export interface DroppableConfig extends DroppableConfigApi {
  ref: RefObject<HTMLElement>;
  /**
   * A callback to synchronously collect measurement information
   * before a drag starts.
   */
  onBeforeDragStart: (draggable: DraggableDescriptor, bounds: Bounds) => void;
}

export interface DroppableMonitor {
  onBeforeDragStart(draggable: DraggableDescriptor, bounds: Bounds): void;
  findDroppableAt(pos: Pos2d): DroppableConfigApi | undefined;
  getDroppable(id: string): DroppableConfigApi;
  addDroppable(config: DroppableConfig): void;
  removeDroppable(droppableId: string): void;
}

export class DomDroppableMonitor implements DroppableMonitor {
  private droppables = new Map<string, DroppableConfig>();

  /**
   * Notify droppables that a drag is about to start so
   * they can collect required measurement information
   */
  public onBeforeDragStart(draggable: DraggableDescriptor, bounds: Bounds) {
    for (const droppable of this.droppables.values()) {
      droppable.onBeforeDragStart(draggable, bounds);
    }
  }

  /**
   * Return the topmost droppable under the given point
   */
  public findDroppableAt(pos: Pos2d): DroppableConfig | undefined {
    const targets = document.elementsFromPoint(pos.x, pos.y);
    // elementsFromPoint returns elements starting at the topmost element,
    // so the first one we find is guaranteed to be the topmost droppable
    for (const target of targets) {
      for (const droppable of this.droppables.values()) {
        if (target === droppable.ref.current) {
          return droppable;
        }
      }
    }
  }

  public getDroppable(id: string): DroppableConfigApi {
    const droppable = this.droppables.get(id);
    assert(droppable, `No droppable found with id ${id}`);
    return droppable;
  }

  public addDroppable(config: DroppableConfig) {
    assert(
      !this.droppables.get(config.id),
      `Multiple droppables with id ${config.id}`
    );

    this.droppables.set(config.id, config);
  }

  public removeDroppable(droppableId: string) {
    const deleted = this.droppables.delete(droppableId);
    assert(
      deleted,
      `Tried to remove droppable ${droppableId} which does not exist`
    );
  }
}
