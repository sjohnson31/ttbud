import React from "react";
import Pos2d from "../../util/shape-math";
import { ContentType, TokenContents } from "../../types";
import FloorIcon from "./FloorIcon";
import FloorText from "./FloorText";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { ICONS_BY_ID } from "../icons";

interface Props {
  contents: TokenContents;
  pos: Pos2d;
}

const Floor: React.FC<Props> = ({ contents, pos }) => {
  switch (contents.type) {
    case ContentType.Icon:
      const icon = ICONS_BY_ID.get(contents.iconId);
      if (icon) {
        return <FloorIcon icon={icon} pos={pos} />;
      } else {
        console.warn(`Invalid icon id ${contents.iconId}`);
        return <FloorText text={"?"} pos={pos} />;
      }
    case ContentType.Text:
      return <FloorText text={contents.text} pos={pos} />;
    /* istanbul ignore next */
    default:
      throw new UnreachableCaseError(contents);
  }
};

export default Floor;
