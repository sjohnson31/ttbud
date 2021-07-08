import { PureSettings } from "./Settings";
import React, { useState } from "react";
import noop from "../../util/noop";

export default function SettingsFixture() {
  const [showTourPrompt, setShowTourPrompt] = useState(true);

  return (
    <PureSettings
      showTourPrompt={showTourPrompt}
      onClearMap={noop}
      onTourClicked={noop}
      onTourPromptDismissed={() => setShowTourPrompt(false)}
      onDeleteClicked={noop}
      onPingClicked={noop}
      onSearchClicked={noop}
      deleteMode={false}
      pingMode={false}
    />
  );
}
