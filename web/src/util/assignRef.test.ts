import assignRef from "./assignRef";

describe("assignRef", () => {
  it("Does nothing if the ref is null", () => {
    assignRef(null, "ref-value");
  });

  it("Does nothing if the ref is undefined", () => {
    assignRef(undefined, "ref-value");
  });

  it("Calls the function with the value if the ref is a function", () => {
    const ref = jest.fn();
    assignRef(ref, "ref-value");
    expect(ref).toBeCalledWith("ref-value");
  });

  it("Assigns the current value if it's a mutable ref", () => {
    const mutableRef = { current: null };
    assignRef(mutableRef, "ref-value");
    expect(mutableRef.current).toEqual("ref-value");
  });
});
