import {
  ConnectionState,
  ConnectionStateType,
  Disconnected,
} from "./connection-state-slice";
import React from "react";
import Alert from "@material-ui/lab/Alert";
import RefreshIcon from "@material-ui/icons/Cached";
import { connect } from "react-redux";
import { RootState } from "../../store/rootReducer";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { IconButton, makeStyles } from "@material-ui/core";
import { ConnectionError } from "../../network/BoardStateApiClient";

interface Props {
  connectionState: ConnectionState;
  onReconnectClick: () => void;
}

const useStyle = makeStyles(() => ({
  alert: {
    maxWidth: 500,
  },
}));

function disconnectMessage(state: Disconnected) {
  switch (state.error) {
    case ConnectionError.INVALID_ROOM_ID:
      return "Room link is invalid, try creating a new room";
    case ConnectionError.ROOM_FULL:
      return "This room is full";
    case ConnectionError.TOO_MANY_CONNECTIONS:
      return "You have too many rooms open, try closing some of your ttbud tabs";
    case ConnectionError.TOO_MANY_ROOMS_CREATED:
      return "You've made too many rooms recently, please wait a few minutes before trying again";
    case ConnectionError.UNKNOWN:
      return "An unknown error has occurred";
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(state.error);
  }
}

const PureConnectionNotifier: React.FC<Props> = ({
  connectionState,
  onReconnectClick,
}) => {
  const classes = useStyle();

  switch (connectionState.type) {
    case ConnectionStateType.Connected:
      return null;
    case ConnectionStateType.Connecting:
      return (
        <Alert className={classes.alert} variant="filled" severity="warning">
          Connecting
        </Alert>
      );
    case ConnectionStateType.Disconnected:
      return (
        <Alert
          className={classes.alert}
          variant="filled"
          severity="error"
          action={
            <IconButton
              onClick={onReconnectClick}
              color={"inherit"}
              aria-label={"reconnect"}
              size={"small"}
            >
              <RefreshIcon />
            </IconButton>
          }
        >
          Disconnected: {disconnectMessage(connectionState)}
        </Alert>
      );
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(connectionState);
  }
};

const mapStateToProps = (state: RootState) => ({
  connectionState: state.connectionState,
});

const ConnectionNotifier = connect(mapStateToProps)(PureConnectionNotifier);
export default ConnectionNotifier;
export { PureConnectionNotifier };
