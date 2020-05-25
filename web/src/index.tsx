import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import * as serviceWorker from "./serviceWorker";
import { DomDroppableMonitor } from "./drag/DroppableMonitor";
import { Provider } from "react-redux";
import DndContext from "./drag/DndContext";
import createStore from "./store/createStore";
import { BoardStateApiClient } from "./network/BoardStateApiClient";
import { v4 as uuid } from "uuid";
import { PersistGate } from "redux-persist/integration/react";
import { persistStore } from "redux-persist";
import { CssBaseline, createMuiTheme, ThemeProvider } from "@material-ui/core";

const monitor = new DomDroppableMonitor();
const apiClient = new BoardStateApiClient(
  `wss://${process.env.REACT_APP_DOMAIN}:${process.env.REACT_APP_API_WEBSOCKET_PORT}`
);
const store = createStore(monitor, apiClient);

const path = window.location.pathname.split("/room/")[1];
const roomId = path ? atob(path) : uuid();
window.history.replaceState({}, "Your special room", `/room/${btoa(roomId)}`);
apiClient.connect(roomId);

let persistor = persistStore(store);

const theme = createMuiTheme({
  palette: {
    background: {
      default: "#F5F5DC",
    },
  },
});

const render = () => {
  const App = require("./ui/app/App").default;

  ReactDOM.render(
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <DndContext.Provider value={monitor}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </DndContext.Provider>
      </PersistGate>
    </Provider>,
    document.getElementById("root")
  );
};

render();

if (process.env.NODE_ENV === "development" && module.hot) {
  module.hot.accept("./ui/app/App", render);
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
