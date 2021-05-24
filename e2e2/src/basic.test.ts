import dragTo from "./dragTo";
import { assert } from "./invariants";

jest.setTimeout(600000);

function trayCharSelector(character: string) {
  return `[aria-label="Character Tray"] [aria-label="Character: ${character}"]`;
}

function boardCharSelector(character: string) {
  return `[aria-label="Board"] [aria-label="Character: ${character}"]`;
}

describe("TTBud", () => {
  it("Synchronizes actions between pages", async () => {
    const pageOne = page;
    const pageTwo = await browser.newPage();
    await pageOne.goto("https://ttbud.app");

    const trayArcher = trayCharSelector("archer");
    const boardArcher = boardCharSelector("archer");

    // Drag an archer out on the first page
    const selector = trayArcher;
    const dest = { x: 0, y: 0 };
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

    await expect(pageOne).toHaveSelector(boardArcher);

    // Archer should show up on the second page
    await pageTwo.goto(pageOne.url());
    const archer = await pageTwo.$(boardArcher);
    assert(archer, `Unable to find selector ${boardArcher}`);

    // Delete archer on second page
    await archer.click({ button: "right" });

    // Should disappear from first page
    await expect(pageOne).toHaveSelector(boardArcher, { state: "hidden" });
  });
});
