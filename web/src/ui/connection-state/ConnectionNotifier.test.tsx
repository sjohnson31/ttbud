import { render } from "@testing-library/react";
import { ConnectionStateType } from "./connection-state-slice";
import React from "react";
import { PureConnectionNotifier } from "./ConnectionNotifier";
import "@testing-library/jest-dom";
import noop from "../../util/noop";
import { ConnectionError } from "../../network/BoardStateApiClient";

describe("ConnectionNotifier", () => {
  it("says connecting when state is connecting", () => {
    const { getByText } = render(
      <PureConnectionNotifier
        connectionState={{
          type: ConnectionStateType.Connecting,
          numRetries: 0,
        }}
        onReconnectClick={noop}
      />
    );

    expect(getByText(/Connecting/)).toBeVisible();
  });

  it("triggers the reconnect listener when the reconnect button is clicked", async () => {
    const onReconnectClick = jest.fn();
    const { findByLabelText } = render(
      <PureConnectionNotifier
        connectionState={{
          type: ConnectionStateType.Disconnected,
          error: ConnectionError.UNKNOWN,
          numRetries: 0,
        }}
        onReconnectClick={onReconnectClick}
      />
    );

    (await findByLabelText("reconnect")).click();
    expect(onReconnectClick).toHaveBeenCalled();
  });

  it.each`
    error_code                                | message
    ${ConnectionError.INVALID_ROOM_ID}        | ${"Room link is invalid"}
    ${ConnectionError.ROOM_FULL}              | ${"This room is full"}
    ${ConnectionError.TOO_MANY_CONNECTIONS}   | ${"You have too many rooms open"}
    ${ConnectionError.TOO_MANY_ROOMS_CREATED} | ${"You've made too many rooms"}
    ${ConnectionError.UNKNOWN}                | ${"An unknown error has occurred"}
  `(
    'Says "$message" when $error_code is returned',
    ({ error_code, message }) => {
      const { getByText } = render(
        <PureConnectionNotifier
          connectionState={{
            type: ConnectionStateType.Disconnected,
            error: error_code,
            numRetries: 0,
          }}
          onReconnectClick={noop}
        />
      );

      expect(getByText(new RegExp(message))).toBeVisible();
    }
  );

  it("doesn't render when connected", () => {
    const { container } = render(
      <PureConnectionNotifier
        connectionState={{ type: ConnectionStateType.Connected }}
        onReconnectClick={noop}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
