import Floor from "./Floor";
import { ContentType } from "../../types";
import { WALL_ICON } from "../icons";

const floorFixtures = {
  icon: (
    <Floor
      contents={{ type: ContentType.Icon, iconId: WALL_ICON.id }}
      pos={{ x: 0, y: 0 }}
    />
  ),
  text: (
    <Floor
      contents={{ type: ContentType.Text, text: "d" }}
      pos={{ x: 0, y: 0 }}
    />
  ),
};

export default floorFixtures;
