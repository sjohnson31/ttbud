import { assert } from "./invariants";
import { Page } from "playwright";

export interface Pos {
  x: number;
  y: number;
}

export default async function dragTo(page: Page, selector: string, dest: Pos) {
  const element = await page.$(selector);
  assert(element !== null, `Unable to find selector ${selector}`);
  const boundingBox = await element!.boundingBox();
  assert(
    boundingBox,
    `Unable to get bounding box for element found by selector ${selector}`
  );

  await page.mouse.move(
    boundingBox.x + boundingBox.width / 2,
    boundingBox.y + boundingBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(dest.x, dest.y);
  await page.mouse.up();
}
