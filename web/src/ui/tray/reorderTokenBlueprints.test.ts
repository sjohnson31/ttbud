import { reorderTokenBlueprints } from "./reorderTokenBlueprints";
import { ContentType, IconContents, TextContents } from "../../types";
import { DraggableType, LocationType } from "../../drag/DragStateTypes";
import { DragResult } from "../../drag/getDragResult";
import { WALL_ICON } from "../icons";

const ORIGIN = {
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
};

const TEXT_CONTENTS: TextContents = { type: ContentType.Text, text: "SR" };
const ICON_CONTENTS: IconContents = {
  type: ContentType.Icon,
  iconId: WALL_ICON.id,
};

describe("reorderTokenBlueprints", () => {
  it("does nothing if the token was dragged out", () => {
    const blueprints = [TEXT_CONTENTS, ICON_CONTENTS];
    reorderTokenBlueprints({
      blueprints,
      source: {
        id: "tray",
        bounds: ORIGIN,
        logicalLocation: { type: LocationType.List, idx: 1 },
      },
      destination: {
        id: "board",
        bounds: ORIGIN,
        logicalLocation: { type: LocationType.Grid, x: 1, y: 1 },
      },
      draggable: {
        id: "draggable-id",
        type: DraggableType.TokenBlueprint,
        contents: TEXT_CONTENTS,
      },
      dragResult: DragResult.DraggedOutOf,
    });

    expect(blueprints).toEqual([TEXT_CONTENTS, ICON_CONTENTS]);
  });

  it("adds the blueprint if the token was dragged in", () => {
    const blueprints = [TEXT_CONTENTS];
    reorderTokenBlueprints({
      blueprints,
      source: {
        id: "board",
        bounds: ORIGIN,
        logicalLocation: { type: LocationType.Grid, x: 1, y: 1 },
      },
      destination: {
        id: "tray",
        bounds: ORIGIN,
        // Insert as the first item in the list
        logicalLocation: { type: LocationType.List, idx: 0 },
      },
      draggable: {
        id: "draggable-id",
        type: DraggableType.Token,
        tokenId: "token-id",
        contents: ICON_CONTENTS,
      },
      dragResult: DragResult.DraggedInto,
    });

    expect(blueprints).toEqual([ICON_CONTENTS, TEXT_CONTENTS]);
  });

  it("does nothing if the token dragged in already exists in the list", () => {
    const blueprints = [TEXT_CONTENTS, ICON_CONTENTS];
    reorderTokenBlueprints({
      blueprints,
      source: {
        id: "board",
        bounds: ORIGIN,
        logicalLocation: { type: LocationType.Grid, x: 1, y: 1 },
      },
      destination: {
        id: "tray",
        bounds: ORIGIN,
        logicalLocation: { type: LocationType.List, idx: 0 },
      },
      draggable: {
        id: "draggable-id",
        type: DraggableType.Token,
        tokenId: "token-id",
        contents: ICON_CONTENTS,
      },
      dragResult: DragResult.DraggedInto,
    });

    expect(blueprints).toEqual([TEXT_CONTENTS, ICON_CONTENTS]);
  });

  it("reorders blueprints if they were moved inside of the tray", () => {
    const blueprints = [TEXT_CONTENTS, ICON_CONTENTS];
    reorderTokenBlueprints({
      blueprints,
      source: {
        id: "tray",
        bounds: ORIGIN,
        logicalLocation: { type: LocationType.List, idx: 0 },
      },
      destination: {
        id: "tray",
        bounds: ORIGIN,
        logicalLocation: { type: LocationType.List, idx: 1 },
      },
      draggable: {
        id: "draggable-id",
        type: DraggableType.TokenBlueprint,
        contents: TEXT_CONTENTS,
      },
      dragResult: DragResult.MovedInside,
    });

    expect(blueprints).toEqual([ICON_CONTENTS, TEXT_CONTENTS]);
  });

  it("does nothing if the drag didn't involve the tray", () => {
    const blueprints = [TEXT_CONTENTS, ICON_CONTENTS];
    reorderTokenBlueprints({
      blueprints,
      source: {
        id: "board",
        bounds: ORIGIN,
        logicalLocation: { type: LocationType.Grid, x: 1, y: 1 },
      },
      destination: {
        id: "board",
        bounds: ORIGIN,
        logicalLocation: { type: LocationType.Grid, x: 2, y: 2 },
      },
      draggable: {
        id: "draggable-id",
        type: DraggableType.Token,
        contents: ICON_CONTENTS,
        tokenId: "token-id",
      },
      dragResult: DragResult.None,
    });

    expect(blueprints).toEqual([TEXT_CONTENTS, ICON_CONTENTS]);
  });
});
