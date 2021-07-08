import React, { CSSProperties } from "react";
import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../config";
import Pos2d from "../../util/shape-math";

interface Props {
  text: string;
  pos: Pos2d;
}

const useStyles = makeStyles({
  media: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: GRID_SIZE_PX,
    height: GRID_SIZE_PX,
    userSelect: "none",
    userDrag: "none",
  },
});

const FloorText: React.FC<Props> = ({ text, pos }) => {
  const classes = useStyles();

  const style: CSSProperties = {
    position: "absolute",
    top: pos.y,
    left: pos.x,
    zIndex: 0,
  };

  return (
    <div style={style} className={classes.media}>
      {text.toLocaleUpperCase()}
    </div>
  );
};

export default FloorText;
