import { render } from "@testing-library/react";
import TourPopup from "./TourPopup";
import React from "react";
import noop from "../../util/noop";
import userEvent from "@testing-library/user-event";

const DEFAULT_PROPS = {
  current: 0,
  totalSteps: 5,
  gotoStep: noop,
  close: noop,
  content: "Test Content",
};

describe("TourPopup", () => {
  it("only shows next button for the first step", () => {
    const { queryByText, getByText } = render(
      <TourPopup {...DEFAULT_PROPS} current={0} />
    );

    expect(queryByText("Previous")).toBeNull();
    expect(getByText("Next")).toBeVisible();
  });

  it("shows next and previous buttons for the middle steps", () => {
    const { getByText } = render(
      <TourPopup {...DEFAULT_PROPS} current={2} totalSteps={5} />
    );

    expect(getByText("Previous")).toBeVisible();
    expect(getByText("Next")).toBeVisible();
  });

  it("shows previous and done buttons for last step", () => {
    const { getByText } = render(
      <TourPopup
        {...DEFAULT_PROPS}
        /** current is zero-indexed */
        current={4}
        totalSteps={5}
      />
    );

    expect(getByText("Previous")).toBeVisible();
    expect(getByText("Done")).toBeVisible();
  });

  it("triggers the next step when the next button is clicked", () => {
    const gotoStep = jest.fn();
    const { getByText } = render(
      <TourPopup
        {...DEFAULT_PROPS}
        gotoStep={gotoStep}
        current={0}
        totalSteps={5}
      />
    );

    userEvent.click(getByText("Next"));
    expect(gotoStep).toBeCalledWith(1);
  });

  it("triggers the previous step when the previous button is clicked", () => {
    const gotoStep = jest.fn();
    const { getByText } = render(
      <TourPopup
        {...DEFAULT_PROPS}
        gotoStep={gotoStep}
        current={1}
        totalSteps={5}
      />
    );

    userEvent.click(getByText("Previous"));
    expect(gotoStep).toBeCalledWith(0);
  });

  it("Dismisses the tour when the done button is clicked", () => {
    const done = jest.fn();
    const { getByText } = render(
      <TourPopup
        {...DEFAULT_PROPS}
        close={done}
        /** current is zero-indexed */
        current={4}
        totalSteps={5}
      />
    );

    userEvent.click(getByText("Done"));
    expect(done).toBeCalled();
  });
});
