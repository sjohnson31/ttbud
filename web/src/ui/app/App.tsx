import { makeStyles } from "@material-ui/core";
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clear } from "../board/board-slice";
import Board from "../board/Board";
import { ICONS } from "../icons";
import SearchDialog from "../search/SearchDialog";
import Settings from "../settings/Settings";
import CharacterTray from "../tray/CharacterTray";
import FloorTray from "../tray/FloorTray";
import { RootState } from "../../store/rootReducer";
import isMac from "../../util/isMac";
import { startSearching, stopSearching } from "./app-slice";
import ConnectionNotifier from "../connection-state/ConnectionNotifier";
import { v4 as uuid } from "uuid";
import BoardStateApiClient from "../../network/BoardStateApiClient";
import Tour from "../tour/Tour";
import MobileWarningDialog from "../mobile-warning/MobileWarningDialog";

const useStyles = makeStyles((theme) => ({
  app: {
    width: 4000,
    height: 2000,
    // Otherwise safari will try to select the connection notifier text even when you're long pressing no where near it
    userSelect: "none",
  },
  characterTray: {
    position: "fixed",
    zIndex: 3,
    bottom: theme.spacing(3),
    left: theme.spacing(1),
  },
  floorTray: {
    display: "inline-flex",
    position: "fixed",
    zIndex: 2,
    bottom: theme.spacing(3),
    left: "50%",
    transform: "translateX(-50%)",
  },
  connectionNotifier: {
    position: "fixed",
    top: theme.spacing(1),
    left: "50%",
    transform: "translateX(-50%)",
  },
  settings: {
    position: "fixed",
    bottom: theme.spacing(3),
    right: theme.spacing(3),
  },
}));

const searchModifier = isMac() ? "Meta" : "Control";

interface Props {
  apiClient: BoardStateApiClient;
}

const App: React.FC<Props> = ({ apiClient }) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const { searching } = useSelector((state: RootState) => ({
    searching: state.app.searching,
  }));
  const [touring, setTouring] = useState(false);

  useEffect(() => {
    const path = window.location.pathname.split("/room/")[1];
    const roomId = path ? atob(path) : uuid();
    window.history.replaceState(
      {},
      "Your special room",
      `/room/${btoa(roomId)}`
    );

    apiClient.connect(roomId);
  }, [apiClient]);

  useEffect(() => {
    // Start in the center of the board
    window.scrollTo(
      document.body.scrollWidth / 2 - window.screen.width / 2,
      document.body.scrollHeight / 2 - window.screen.height / 2
    );
  }, []);

  useEffect(() => {
    const onKeyPressed = (e: KeyboardEvent) => {
      if (e.getModifierState(searchModifier) && e.key === "f") {
        dispatch(startSearching());
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyPressed);
    return () => document.removeEventListener("keydown", onKeyPressed);
  }, [dispatch]);

  const onSearchDialogClose = useCallback(
    () => dispatch(stopSearching()),
    [dispatch]
  );

  const onClearMap = () => dispatch(clear());

  const reconnect = () => apiClient.reconnect();

  return (
    <>
      <MobileWarningDialog />
      <Tour isOpen={touring} onCloseClicked={() => setTouring(false)} />
      <div className={classes.app}>
        <Board />
        <SearchDialog
          open={searching}
          icons={ICONS}
          onClose={onSearchDialogClose}
        />
        <div className={classes.characterTray}>
          <CharacterTray />
        </div>
        <div className={classes.floorTray}>
          <FloorTray />
        </div>
        <Settings
          className={classes.settings}
          onClearMap={onClearMap}
          onTourClicked={() => setTouring(true)}
        />
        <div className={classes.connectionNotifier}>
          <ConnectionNotifier onReconnectClick={reconnect} />
        </div>
      </div>
    </>
  );
};

export default App;
