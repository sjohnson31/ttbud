import React, { useCallback, useEffect } from "react";
import Board from "../board/Board";
import CharacterTray from "../tray/CharacterTray";
import { makeStyles } from "@material-ui/core";
import SearchDialog from "../search/SearchDialog";
import { Icon, ICONS } from "../icons";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { startSearching, stopSearching } from "../../state/app-slice";
import FloorTray from "../tray/FloorTray";
import { DragStateType } from "../../drag/DragStateTypes";
import { addFloor, addPing, removeToken } from "../../state/board-slice";
import {
  setActiveFloor,
  removeIcon as removeFloorIcon
} from "../../state/floor-tray-slice";
import { RootState } from "../../state/rootReducer";
import Pos2d from "../../util/shape-math";
import { removeIcon as removeCharacterIcon } from "../../state/character-tray-slice";

const useStyles = makeStyles(theme => ({
  app: {
    width: 4000,
    height: 2000
  },
  characterTray: {
    position: "fixed",
    zIndex: 2,
    // Same location whether the scrollbar is visible or not
    // (Scrollbar width = 100vh - 100%)
    bottom: `calc(${theme.spacing(3)}px - (100vh - 100%))`,
    left: theme.spacing(1)
  },
  floorTray: {
    display: "inline-flex",
    position: "fixed",
    zIndex: 2,
    // Same location whether the scrollbar is visible or not
    // (Scrollbar width = 100vh - 100%)
    bottom: `calc(${theme.spacing(3)}px - (100vh - 100%))`,
    left: "calc(50% + (100vw - 100%)/2)",
    transform: "translateX(-50%)"
  },
  aboutLink: {
    position: "fixed",
    color: "black",
    fontWeight: "bold",
    bottom: `calc(${theme.spacing(3)}px - (100vh - 100%))`,
    right: `calc(${theme.spacing(3)}px - (100vw - 100%))`
  }
}));

const App = () => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const {
    isDragging,
    tokens,
    activeFloor,
    searching,
    floorTrayIcons,
    characterTrayIcons
  } = useSelector(
    (state: RootState) => ({
      isDragging: state.drag.type === DragStateType.Dragging,
      tokens: state.board.tokens,
      activeFloor: state.floorTray.activeFloor,
      searching: state.app.searching,
      floorTrayIcons: state.floorTray.icons,
      characterTrayIcons: state.characterTray.icons
    }),
    shallowEqual
  );

  useEffect(() => {
    const onKeyPressed = (e: KeyboardEvent) => {
      if (e.getModifierState("Control") && e.key === "f") {
        dispatch(startSearching());
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyPressed);
    return () => document.removeEventListener("keydown", onKeyPressed);
  }, [dispatch]);

  const onFloorSelected = useCallback(
    (icon: Icon) => dispatch(setActiveFloor(icon)),
    [dispatch]
  );

  const onFloorRemoved = useCallback(
    (icon: Icon) => dispatch(removeFloorIcon(icon)),
    [dispatch]
  );

  const onSearchDialogClose = useCallback(() => dispatch(stopSearching()), [
    dispatch
  ]);

  const onFloorCreated = (iconId: string, pos: Pos2d) =>
    dispatch(addFloor(iconId, pos));

  const onPingCreated = (pos: Pos2d) => dispatch(addPing(pos));
  const onTokenDeleted = (id: string) => dispatch(removeToken(id));

  const onTrayIconRemoved = useCallback(
    (icon: Icon) => dispatch(removeCharacterIcon(icon)),
    [dispatch]
  );

  return (
    <div className={classes.app}>
      <Board
        activeFloor={activeFloor}
        isDragging={isDragging}
        tokens={tokens}
        onFloorCreated={onFloorCreated}
        onPingCreated={onPingCreated}
        onTokenDeleted={onTokenDeleted}
      />
      <SearchDialog
        open={searching}
        icons={ICONS}
        onClose={onSearchDialogClose}
      />
      <div className={classes.characterTray}>
        <CharacterTray
          icons={characterTrayIcons}
          onIconRemoved={onTrayIconRemoved}
        />
      </div>
      <div className={classes.floorTray}>
        <FloorTray
          icons={floorTrayIcons}
          activeFloor={activeFloor}
          onFloorSelected={onFloorSelected}
          onFloorRemoved={onFloorRemoved}
        />
      </div>
      <a
        className={classes.aboutLink}
        href={"https://github.com/sjohnson31/ttbud"}
      >
        ?
      </a>
    </div>
  );
};

export default App;
