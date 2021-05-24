export function fail(msg: string): never {
  throw new Error(msg);
}

export function assert(
  condition: boolean | object | null | undefined | string,
  msg: string
): asserts condition {
  if (!condition) {
    fail(msg);
  }
}
