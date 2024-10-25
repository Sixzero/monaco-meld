export class DiffOperation {
  constructor(originalModel, modifiedModel) {
    this.originalModel = originalModel;
    this.modifiedModel = modifiedModel;
  }

  acceptCurrentChange(currentLine, changes) {
    const currentChange = this.findChangeForLine(currentLine, changes);
    if (!currentChange) return;

    this.originalModel.pushStackElement();
    const modifiedText = this.getModifiedText(currentChange);
    this.applyChange(currentChange, modifiedText);
    this.originalModel.pushStackElement();
  }

  findChangeForLine(currentLine, changes) {
    return changes?.find(change => 
      currentLine >= change.modifiedStartLineNumber && 
      currentLine <= (change.modifiedEndLineNumber || change.modifiedStartLineNumber)
    );
  }

  getModifiedText(change) {
    const is_empty_modified_text = change.modifiedEndLineNumber === 0;
    return is_empty_modified_text ? "" : this.modifiedModel.getValueInRange({
      startLineNumber: change.modifiedStartLineNumber,
      startColumn: 1,
      endLineNumber: change.modifiedEndLineNumber,
      endColumn: this.modifiedModel.getLineMaxColumn(change.modifiedEndLineNumber)
    });
  }

  applyChange(change, modifiedText) {
    const originalLineCount = this.originalModel.getLineCount();

    // Handle empty file case
    if (originalLineCount === 0) {
      this.originalModel.pushEditOperations([], [{
        range: {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1
        },
        text: modifiedText
      }], () => null);
      return;
    }

    const isInsert = change.originalEndLineNumber === 0;
    const isDelete = change.modifiedEndLineNumber === 0;
    const isInsertAtStart = isInsert && change.originalStartLineNumber === 0;

    const range = isInsertAtStart ? {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1
    } : isInsert ? {
      startLineNumber: change.originalStartLineNumber,
      startColumn: this.originalModel.getLineMaxColumn(change.originalStartLineNumber),
      endLineNumber: change.originalStartLineNumber,
      endColumn: this.originalModel.getLineMaxColumn(change.originalStartLineNumber)
    } : isDelete ? { 
      startLineNumber: change.originalStartLineNumber,
      startColumn: 1,
      endLineNumber: change.originalEndLineNumber + 1,
      endColumn: 1 
    } : {
      startLineNumber: change.originalStartLineNumber,
      startColumn: 1,
      endLineNumber: change.originalEndLineNumber,
      endColumn: this.originalModel.getLineMaxColumn(change.originalEndLineNumber)
    };

    // For inserts, ensure newlines on both ends
    const text = isDelete ? null : isInsert ? 
      (isInsertAtStart ? modifiedText + '\n' : '\n' + modifiedText) : 
      modifiedText;

    this.originalModel.pushEditOperations([], [{
      range,
      text
    }], () => null);
  }
}
