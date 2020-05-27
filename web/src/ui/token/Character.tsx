import React, { memo, MouseEvent } from "react";
import { Card, CardMedia, makeStyles, Theme } from "@material-ui/core";
import clsx from "clsx";
import { ICONS_BY_ID } from "../icons";
import { GRID_SIZE_PX } from "../../config";
import { Color, ContentType, TokenContents } from "../../types";
import { assert } from "../../util/invariants";
import UnreachableCaseError from "../../util/UnreachableCaseError";
import { DragAttributes } from "../../drag/Draggable";
import { Pos3d } from "../../util/shape-math";

const useStyles = makeStyles<Theme, Props>({
  character: ({ pos, color }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    position: pos ? "absolute" : "static",
    top: pos?.y,
    left: pos?.x,
    width: GRID_SIZE_PX,
    height: GRID_SIZE_PX,
    border: `3px solid ${toCssColor(color)}`,
  }),
  media: {
    width: "70%",
    height: "70%",
  },
});

interface Props {
  contents: TokenContents;
  color?: Color;
  onDelete?: () => void;
  className?: string;
  pos?: Pos3d;
  isDragging?: boolean;
  dragAttributes?: DragAttributes;
}

function toCssColor(color: Color | undefined) {
  return color
    ? `rgb(${color.red}, ${color.green}, ${color.blue})`
    : "rgba(0, 0, 0, 0)";
}

const Character: React.FC<Props> = memo((props) => {
  const classes = useStyles(props);
  const { isDragging, contents, className, dragAttributes, onDelete } = props;

  const renderContents = (contents: TokenContents) => {
    switch (contents.type) {
      case ContentType.Icon:
        return renderIcon(contents.iconId);
      case ContentType.Text:
        return contents.text.toLocaleUpperCase();
      default:
        throw new UnreachableCaseError(contents);
    }
  };

  const renderIcon = (iconId: string) => {
    const icon = ICONS_BY_ID.get(iconId);
    assert(icon, `Invalid icon id ${iconId}`);

    return (
      <CardMedia
        className={classes.media}
        image={icon.img}
        aria-label={`Character: ${icon.desc}`}
        draggable={false}
      />
    );
  };

  const onContextMenu = (e: MouseEvent) => {
    if (onDelete) {
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <Card
      onContextMenu={onContextMenu}
      raised={isDragging}
      className={clsx(classes.character, className)}
      {...dragAttributes}
    >
      {renderContents(contents)}
    </Card>
  );
});

export default Character;
