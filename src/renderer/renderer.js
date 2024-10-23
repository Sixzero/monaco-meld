import { originalText, modifiedText } from './samples.js';
import { DiffOperation } from './diffOperations.js';

window.addEventListener("DOMContentLoaded", () => {
  console.log("Loading Monaco...");
  require.config({ paths: { vs: '../../node_modules/monaco-editor/min/vs' }});
  
  window.MonacoEnvironment = {
    getWorkerUrl: function(moduleId, label) {
      return './monaco-editor-worker-loader-proxy.js';
    }
  };

  require(['vs/editor/editor.main'], async function() {
    console.log("Monaco diff editor loaded");
    
    // Get contents from command line if available
    let leftContent = '';  // Default to empty string
    let rightContent = '';  // Default to empty string
    let initialContent = '';  // Add proper declaration here
    
    try {
      const diffContents = await window.electronAPI.getDiffContents();
      if (diffContents) {
        // If diffContents exists but content is null, use samples
        if (diffContents.leftContent === null && diffContents.rightContent === null) {
          leftContent = originalText;
          rightContent = modifiedText;
        } else {
          // Otherwise use provided content (even if empty string)
          if (diffContents.leftContent !== null) leftContent = diffContents.leftContent;
          if (diffContents.rightContent !== null) rightContent = diffContents.rightContent;
        }
      }
      initialContent = await window.electronAPI.getOriginalContent();
    } catch (err) {
      console.error('Error getting diff contents:', err);
    }

    monaco.editor.defineTheme('fastdiff-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
    });

    const diffEditor = monaco.editor.createDiffEditor(document.getElementById('container'), {
      theme: 'vs-dark',
      automaticLayout: true,
      renderSideBySide: true,
      originalEditable: true,
      renderIndicators: true,
      renderMarginRevertIcon: true,
      ignoreTrimWhitespace: false
    });

    const originalModel = monaco.editor.createModel(leftContent, 'javascript');
    const modifiedModel = monaco.editor.createModel(rightContent, 'javascript');

    // Enable undo support
    originalModel.setEOL(monaco.editor.EndOfLineSequence.LF);
    originalModel.pushStackElement();

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel
    });

    // Expose functions for main process
    window.hasUnsavedChanges = () => {
      const currentContent = originalModel.getValue();
      return initialContent !== null && currentContent !== initialContent;
    };

    window.getLeftContent = () => originalModel.getValue();

    // Focus on the original (left) editor
    setTimeout(() => diffEditor.getModifiedEditor().focus(), 100);

    const modifiedEditor = diffEditor.getModifiedEditor();
    const originalEditor = diffEditor.getOriginalEditor();
    
    // Save command
    originalEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      try {
        const content = originalModel.getValue();
        const saved = await window.electronAPI.saveContent(content);
        if (!saved) {
          console.error('Failed to save file');
        } else {
          initialContent = content; // Update initial content after successful save
        }
      } catch (err) {
        console.error('Error saving:', err);
      }
    });

    // Navigation commands
    modifiedEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      const changes = diffEditor.getLineChanges();
      const currentLine = modifiedEditor.getPosition().lineNumber;
      const nextChange = changes?.find(change => change.modifiedStartLineNumber > currentLine);
      
      if (nextChange) {
        modifiedEditor.setPosition({
          lineNumber: nextChange.modifiedStartLineNumber,
          column: 1
        });
        modifiedEditor.revealLineInCenter(nextChange.modifiedStartLineNumber);
      }
    });

    modifiedEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      const changes = diffEditor.getLineChanges();
      const currentLine = modifiedEditor.getPosition().lineNumber;
      const prevChange = [...(changes || [])].reverse()
        .find(change => change.modifiedStartLineNumber < currentLine);
      
      if (prevChange) {
        modifiedEditor.setPosition({
          lineNumber: prevChange.modifiedStartLineNumber,
          column: 1
        });
        modifiedEditor.revealLineInCenter(prevChange.modifiedStartLineNumber);
      }
    });

    // Transfer chunk from right to left on Alt+Left
    modifiedEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow, () => {
      const changes = diffEditor.getLineChanges();
      const currentLine = modifiedEditor.getPosition().lineNumber;
      
      const diffOp = new DiffOperation(originalModel, modifiedModel);
      diffOp.acceptCurrentChange(currentLine, changes);
    });

    // Enable Ctrl+Z for undo in the original editor
    originalEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
      originalModel.undo();
    });
  });
});
