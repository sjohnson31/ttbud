import { makeStyles } from "@material-ui/core";
import { GRID_SIZE_PX } from "../../config";
import React, { CSSProperties, memo } from "react";

const ANIM_LENGTH_MS = 1000;
const useStyles = makeStyles({
  ping: {
    boxShadow: `50px solid #999`,
    borderRadius: "50%",
    zIndex: 1000,
    animation: `$pulsate ${ANIM_LENGTH_MS}ms ease-out`,
    animationIterationCount: "infinite",
  },
  "@keyframes pulsate": {
    "0%": { boxShadow: "0 0 0 0px rgba(0, 0, 0, 0.5)" },
    "100%": {
      boxShadow: "0 0 0 35px rgba(0, 0, 0, 0)",
    },
  },
});

interface Props {
  x: number;
  y: number;
}

const Ping: React.FC<Props> = memo(({ x, y }) => {
  const classes = useStyles();
  const style: CSSProperties = {
    position: "absolute",
    left: x + GRID_SIZE_PX / 2,
    top: y + GRID_SIZE_PX / 2,
  };

  return <div style={style} className={classes.ping} aria-label={"ping"} />;
});

export default Ping;
