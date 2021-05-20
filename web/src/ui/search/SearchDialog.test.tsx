import {
  getByLabelText,
  queryByLabelText,
  render,
} from "@testing-library/react";
import SearchDialog from "./SearchDialog";
import noop from "../../util/noop";
import { DEFAULT_FLOOR_ICONS, WALL_ICON } from "../icons";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import dragReducer from "../../drag/drag-slice";
import {
  DraggableType,
  DragState,
  DragStateType,
} from "../../drag/DragStateTypes";
import { ContentType } from "../../types";
import { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";

const DEFAULT_PROPS = {
  icons: DEFAULT_FLOOR_ICONS,
  onClose: noop,
  open: true,
};

interface RenderProps {
  state?: DragState;
  props?: Partial<ComponentProps<typeof SearchDialog>>;
}

function renderSearchDialog({
  state = { type: DragStateType.NotDragging },
  props = {},
}: RenderProps = {}) {
  const store = configureStore({
    reducer: { drag: dragReducer },
    preloadedState: { drag: state },
  });

  return render(
    <Provider store={store}>
      <SearchDialog {...DEFAULT_PROPS} {...props} />
    </Provider>
  );
}

describe("SearchDialog", () => {
  it("shows all icons by default", () => {
    const { getByLabelText } = renderSearchDialog();

    for (const icon of DEFAULT_PROPS.icons) {
      expect(getByLabelText(`Character: ${icon.desc}`)).toBeVisible();
    }
  });

  it("shows capitalized text icons for two letter searches", () => {
    const { getByText, getByLabelText } = renderSearchDialog();

    const searchBar = getByLabelText("search");
    userEvent.type(searchBar, "ab");
    expect(getByText("AB")).toBeVisible();
  });

  it("only shows icons that match the search", () => {
    const { queryByLabelText, getByLabelText } = renderSearchDialog();
    const searchBar = getByLabelText("search");
    userEvent.type(searchBar, "stone");
    expect(getByLabelText("Character: stone wall")).toBeVisible();
    expect(queryByLabelText("Character: bed")).not.toBeInTheDocument();
  });

  it("hides the dialog when a drag starts", () => {
    const origin = { top: 0, left: 0, bottom: 0, right: 0 };
    const { queryByLabelText, getByLabelText } = renderSearchDialog({
      state: {
        type: DragStateType.Dragging,
        bounds: origin,
        dragBounds: origin,
        hoveredDroppableId: undefined,
        mouseOffset: { x: 0, y: 0 },
        source: { bounds: origin },
        draggable: {
          id: "draggable-id",
          type: DraggableType.TokenBlueprint,
          contents: { type: ContentType.Icon, iconId: WALL_ICON.id },
        },
      },
    });
    expect(queryByLabelText("search")).not.toBeInTheDocument();
    expect(getByLabelText("Character: stone wall")).toBeVisible();
  });

  it("hides the dialog when open is false", () => {
    const { queryByLabelText } = renderSearchDialog({ props: { open: false } });

    expect(queryByLabelText("search")).not.toBeInTheDocument();
  });
});
