export class DiffOperation {
  constructor(originalModel, modifiedModel) {
    this.originalModel = originalModel;
    this.modifiedModel = modifiedModel;
    
    // Initialize model fields if not exists
    if (!this.originalModel._fields) {
      // Fields used to track diff operations and state:
      // - _operationStack: Stores the history of operations (edits and accepts) for undo
      // - _hasChangeTracking: Flag to ensure we only set up change tracking once
      // - _isPerformingAcceptChange: Flag to prevent recursive tracking during accept operations
      this.originalModel._fields = {
        operationStack: [],
        hasChangeTracking: false,
        isPerformingAcceptChange: false
      };
    }

    // Track content changes if not already set up
    if (!this.originalModel._fields.hasChangeTracking) {
      this.originalModel.onDidChangeContent((event) =>
        this.onModelContentChange(event, 'original'));
      this.modifiedModel.onDidChangeContent((event) =>
        this.onModelContentChange(event, 'modified'));
      this.originalModel._fields.hasChangeTracking = true;
    }
  }

  onModelContentChange(event, modelType) {
    if (this.originalModel._fields.isPerformingAcceptChange) return;
    if (!event.isUndoing && !event.isRedoing) {
      this.originalModel._fields.operationStack.push({ type: 'regularEdit', model: modelType });
    }
  }

  acceptCurrentChange(currentLine, changes) {
    const currentChange = this.findChangeForLine(currentLine, changes);
    
    if (!currentChange) {
      console.log('No change found for line:', currentLine);
      return;
    }

    this.originalModel._fields.isPerformingAcceptChange = true;


    // Store the current state before changes
    const originalRange = {
      startLineNumber: currentChange.originalStartLineNumber || 1,
      startColumn: 1,
      endLineNumber: currentChange.originalEndLineNumber || 1,
      endColumn: this.originalModel.getLineMaxColumn(currentChange.originalEndLineNumber || 1)
    };

    const modifiedRange = {
      startLineNumber: currentChange.modifiedStartLineNumber,
      startColumn: 1,
      endLineNumber: currentChange.modifiedEndLineNumber || 1,
      endColumn: currentChange.modifiedEndLineNumber > 0 ? this.modifiedModel.getLineMaxColumn(currentChange.modifiedEndLineNumber) : 1
      
    };


    // Store original content before change
    const originalContent = currentChange.originalStartLineNumber ? this.originalModel.getValueInRange(originalRange) : '';
    const modifiedContent = this.getModifiedText(currentChange);

    // Apply the change
    this.applyChange(currentChange, modifiedContent);

    this.originalModel._fields.isPerformingAcceptChange = false;

    // Record the accept change operation
    this.originalModel._fields.operationStack.push({
      type: 'acceptChange',
      original: { range: originalRange, content: originalContent },
      modified: { range: modifiedRange, content: modifiedContent }
    });
  }

  undoLastOperation() {
    if (!this.originalModel._fields?.operationStack?.length) return;

    const lastOp = this.originalModel._fields.operationStack.pop();
    if (lastOp.type === 'acceptChange') {
      // Restore original content
      this.originalModel.undo()
      // Restore modified content
      this.modifiedModel.undo()
    } else if (lastOp.type === 'regularEdit') {
      // Undo only the model where the edit occurred
      const modelToUndo = lastOp.model === 'original' ?
        this.originalModel : this.modifiedModel;
      modelToUndo.undo();
    }
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
      endColumn: change.modifiedEndLineNumber > 0 ? this.modifiedModel.getLineMaxColumn(change.modifiedEndLineNumber) : 1
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
      endColumn: 1,
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

    // Apply the edit operation as a single undoable action
    this.originalModel.pushEditOperations([], [{
      range,
      text
    }], () => null);

  }
}
