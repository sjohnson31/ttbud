import React, { CSSProperties } from "react";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../config";
import Pos2d from "../../util/shape-math";
import { Icon } from "../icons";

interface Props {
  icon: Icon;
  pos: Pos2d;
}

const useStyles = makeStyles({
  media: {
    width: GRID_SIZE_PX,
    height: GRID_SIZE_PX,
    userDrag: "none",
    userSelect: "none",
  },
});

const FloorIcon: React.FC<Props> = ({ icon, pos }) => {
  const classes = useStyles();

  const style: CSSProperties = {
    position: "absolute",
    top: pos.y,
    left: pos.x,
    backgroundImage: `url(${icon.img})`,
    zIndex: 0,
  };

  // Using an actual image element here makes it so sometimes if you click and
  // drag over the icon you get the "image dragging" ui that browsers provide.
  // Setting draggable to false or user-drag to none on this or its parent
  // does not prevent this from happening, so instead we use a background image.
  return (
    <span
      style={style}
      className={classes.media}
      role={"img"}
      aria-label={`Floor: ${icon.desc}`}
    />
  );
};

export default FloorIcon;
