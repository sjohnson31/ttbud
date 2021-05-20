import {
  Dialog,
  DialogContent,
  DialogTitle,
  makeStyles,
  TextField,
} from "@material-ui/core";
import React, { memo, useCallback, useMemo, useState } from "react";
import { Icon, ICONS_BY_ID } from "../icons";
import Draggable from "../../drag/Draggable";
import {
  DraggableDescriptor,
  DraggableType,
  DragStateType,
  TokenBlueprintDraggable,
} from "../../drag/DragStateTypes";
import { useSelector } from "react-redux";
import Character from "../token/Character";
import { assert } from "../../util/invariants";
import { RootState } from "../../store/rootReducer";
import { contentId, ContentType, TokenContents } from "../../types";

const useStyles = makeStyles((theme) => ({
  content: {
    width: "300px",
    height: "300px",
  },
  tokenList: {
    display: "flex",
    flexWrap: "wrap",
  },
  token: {
    margin: theme.spacing(1),
  },
  search: {},
  icon: {
    color: "white",
  },
}));

interface Props {
  open: boolean;
  icons: Icon[];
  onClose: () => void;
}

const SearchDialog: React.FC<Props> = memo(({ icons, open, onClose }) => {
  const classes = useStyles();
  const [search, setSearch] = useState("");
  const onChange = useCallback((e) => setSearch(e.target.value), [setSearch]);

  const items: TokenBlueprintDraggable[] = useMemo(
    () =>
      icons.map((icon) => ({
        type: DraggableType.TokenBlueprint,
        contents: { type: ContentType.Icon, iconId: icon.id },
        id: `search-dialog-${icon.id}`,
      })),
    [icons]
  );

  const activeDraggable = useSelector((state: RootState) => {
    if (!open || state.drag.type === DragStateType.NotDragging) {
      return;
    }

    return state.drag.draggable;
  });

  const visibleIconItems = useMemo(() => {
    return search
      ? items.filter(
          (item) =>
            item.contents.type === ContentType.Icon &&
            ICONS_BY_ID.get(item.contents.iconId)!.desc.indexOf(search) !== -1
        )
      : items;
  }, [search, items]);

  const textContents: TokenContents | undefined =
    search.length > 0 && search.length <= 2
      ? { type: ContentType.Text, text: search }
      : undefined;

  const textItem: DraggableDescriptor | undefined = !textContents
    ? undefined
    : {
        type: DraggableType.TokenBlueprint,
        contents: textContents,
        id: `search-dialog-${contentId(textContents)}`,
      };

  const renderDraggable = () => {
    assert(
      activeDraggable,
      "Cannot render draggable when there is no active draggable"
    );

    return (
      <Draggable
        key={`search-dialog-${contentId(activeDraggable.contents)}`}
        descriptor={activeDraggable}
        usePortal={true}
      >
        {(isDragging, attributes) => (
          <Character
            dragAttributes={attributes}
            className={classes.token}
            contents={activeDraggable.contents}
            isDragging={isDragging}
          />
        )}
      </Draggable>
    );
  };

  const renderDialog = () => (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        <TextField
          id="search"
          fullWidth
          autoFocus
          className={classes.search}
          variant="filled"
          margin="normal"
          label="search"
          onChange={onChange}
          onFocus={(e) => e.target.select()}
          value={search}
        />
      </DialogTitle>
      <DialogContent className={classes.content}>
        <div className={classes.tokenList}>
          {textItem && (
            <Draggable key={textItem.id} descriptor={textItem}>
              {(isDragging, attributes) => (
                <Character
                  dragAttributes={attributes}
                  className={classes.token}
                  contents={textItem.contents}
                  isDragging={isDragging}
                />
              )}
            </Draggable>
          )}

          {visibleIconItems.map((item) => (
            <Draggable key={item.id} descriptor={item}>
              {(isDragging, attributes) => (
                <Character
                  dragAttributes={attributes}
                  className={classes.token}
                  contents={item.contents}
                  isDragging={isDragging}
                />
              )}
            </Draggable>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  return activeDraggable ? renderDraggable() : renderDialog();
});

export default SearchDialog;
