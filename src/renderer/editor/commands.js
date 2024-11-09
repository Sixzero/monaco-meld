import { DiffOperation } from "../diffOperations.js";

export function setupEditorCommands(diffEditor, originalEditor, modifiedEditor, saveCallback) {
  // Save command
  originalEditor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
    saveCallback
  );

  // Navigation commands
  modifiedEditor.addCommand(
    monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
    () => navigateToNextChange(diffEditor, modifiedEditor)
  );

  modifiedEditor.addCommand(
    monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
    () => navigateToPreviousChange(diffEditor, modifiedEditor)
  );

  // Transfer chunk command
  modifiedEditor.addCommand(
    monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow,
    () => acceptCurrentChange(diffEditor, modifiedEditor)
  );

  // Undo command
  originalEditor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ,
    () => window.originalModel.undo()
  );
}

function navigateToNextChange(diffEditor, modifiedEditor) {
  const changes = diffEditor.getLineChanges();
  const currentLine = modifiedEditor.getPosition().lineNumber;
  const nextChange = changes?.find(
    (change) => change.modifiedStartLineNumber > currentLine
  );

  if (nextChange) {
    modifiedEditor.setPosition({
      lineNumber: nextChange.modifiedStartLineNumber,
      column: 1,
    });
    modifiedEditor.revealLineInCenter(nextChange.modifiedStartLineNumber);
  }
}

function navigateToPreviousChange(diffEditor, modifiedEditor) {
  const changes = diffEditor.getLineChanges();
  const currentLine = modifiedEditor.getPosition().lineNumber;
  const prevChange = [...(changes || [])]
    .reverse()
    .find((change) => change.modifiedStartLineNumber < currentLine);

  if (prevChange) {
    modifiedEditor.setPosition({
      lineNumber: prevChange.modifiedStartLineNumber,
      column: 1,
    });
    modifiedEditor.revealLineInCenter(prevChange.modifiedStartLineNumber);
  }
}

function acceptCurrentChange(diffEditor, modifiedEditor) {
  const changes = diffEditor.getLineChanges();
  const currentLine = modifiedEditor.getPosition().lineNumber;
  const diffOp = new DiffOperation(window.originalModel, window.modifiedModel);
  diffOp.acceptCurrentChange(currentLine, changes);
}
