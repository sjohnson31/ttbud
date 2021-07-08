import React, { useState } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

// Stupid hack until we support touchscreen-only devices
const isMobile = Boolean(
  navigator.userAgent.match(
    /Android|webOS|iPhone|iPad|iPod|Blackberry|Windows Phone/i
  )
);

const email = "media@ttbud.app";
const subject = "TTBud mobile";
const body = "Let me know when TTBud works well on mobile!";
const emailLink = `mailto: ${email}?subject=${encodeURIComponent(
  subject
)}&body=${encodeURIComponent(body)}`;

const useStyles = makeStyles({
  actionList: {
    width: "100%",
  },
});

const MobileWarningDialog: React.FC = () => {
  const classes = useStyles();
  const [open, setOpen] = useState(isMobile);

  const closeDialog = () => setOpen(false);
  return (
    <Dialog open={open} onClose={closeDialog}>
      <DialogTitle>Warning</DialogTitle>
      <DialogContent>
        <DialogContentText variant="body1">
          TTBud doesn't work well on mobile yet, we're working on it
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <List className={classes.actionList}>
          <Divider />
          <ListItem
            button
            component="a"
            href={emailLink}
            onClick={closeDialog}
            color="primary"
          >
            <ListItemText>Email me when it works on mobile</ListItemText>
          </ListItem>
          <Divider />
          <ListItem button onClick={closeDialog}>
            <ListItemText>View the broken-ness</ListItemText>
          </ListItem>
        </List>
      </DialogActions>
    </Dialog>
  );
};

export default MobileWarningDialog;
