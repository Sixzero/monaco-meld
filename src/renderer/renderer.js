import { sampleText1, sampleText2 } from "./samples.js";
import { DiffOperation } from "./diffOperations.js";

function getLanguageFromPath(filePath) {
  if (!filePath) return 'plaintext';
  const ext = filePath.split('.').pop().toLowerCase();
  const langMap = {
    js: 'javascript',
    jsx: 'javascript',
    jl: 'julia',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    cpp: 'cpp',
    c: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bash: 'shell',
    sql: 'sql'
  };
  return langMap[ext] || 'plaintext';
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("Loading Monaco...");

  require.config({
    paths: {
      vs: "../node_modules/monaco-editor/min/vs", // Two levels up from src/renderer
    },
  });

  window.MonacoEnvironment = {
    getWorkerUrl: function (moduleId, label) {
      return "./monaco-editor-worker-loader-proxy.js"; // Relative to public folder
    },
  };

  require(["vs/editor/editor.main"], async function () {
    console.log("Monaco diff editor loaded");

    let leftContent = ""; // Default to empty string
    let rightContent = ""; // Default to empty string
    let initialContent = ""; // Add proper declaration here
    let originalModel, modifiedModel; // Declare models at this scope

    try {
      const diffContents = await window.electronAPI.getDiffContents();
      // If no diffContents or both contents null, use samples
      if (!diffContents || (diffContents.leftContent === null && diffContents.rightContent === null)) {
        leftContent = sampleText1;
        rightContent = sampleText2;
        originalModel = monaco.editor.createModel(leftContent, 'javascript');
        modifiedModel = monaco.editor.createModel(rightContent, 'javascript');
      } else {
        // Otherwise use provided content (even if empty string)
        if (diffContents.leftContent !== null) leftContent = diffContents.leftContent;
        if (diffContents.rightContent !== null) rightContent = diffContents.rightContent;

        // Get language from file paths
        const language = getLanguageFromPath(diffContents.leftPath) || getLanguageFromPath(diffContents.rightPath);
        originalModel = monaco.editor.createModel(leftContent, language);
        modifiedModel = monaco.editor.createModel(rightContent, language);

        // Update window title with filenames
        const leftName = diffContents.leftPath ? diffContents.leftPath : 'untitled';
        const rightName = diffContents.rightPath ? diffContents.rightPath : 'untitled';
        document.title = `MonacoMeld - ${leftName} ↔ ${rightName}`;
      }
      
      initialContent = await window.electronAPI.getOriginalContent();
    } catch (err) {
      console.error("Error getting diff contents:", err);
      // Fallback to samples if error
      leftContent = sampleText1;
      rightContent = sampleText2;
      originalModel = monaco.editor.createModel(leftContent, 'javascript');
      modifiedModel = monaco.editor.createModel(rightContent, 'javascript');
    }

    // Enable undo support
    originalModel.setEOL(monaco.editor.EndOfLineSequence.LF);
    originalModel.pushStackElement();

    const diffEditor = monaco.editor.createDiffEditor(
      document.getElementById("container"),
      {
        theme: "vs-dark",
        automaticLayout: true,
        renderSideBySide: true,
        originalEditable: true,
        renderIndicators: true,
        renderMarginRevertIcon: true,
        ignoreTrimWhitespace: false,
      }
    );

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
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
    originalEditor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      async () => {
        try {
          const content = originalModel.getValue();
          const saved = await window.electronAPI.saveContent(content);
          if (!saved) {
            console.error("Failed to save file");
          } else {
            initialContent = content; // Update initial content after successful save
          }
        } catch (err) {
          console.error("Error saving:", err);
        }
      }
    );

    // Navigation commands
    modifiedEditor.addCommand(
      monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
      () => {
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
    );

    modifiedEditor.addCommand(
      monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
      () => {
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
    );

    // Transfer chunk from right to left on Alt+Left
    modifiedEditor.addCommand(
      monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow,
      () => {
        const changes = diffEditor.getLineChanges();
        const currentLine = modifiedEditor.getPosition().lineNumber;

        const diffOp = new DiffOperation(originalModel, modifiedModel);
        diffOp.acceptCurrentChange(currentLine, changes);
      }
    );

    // Enable Ctrl+Z for undo in the original editor
    originalEditor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ,
      () => {
        originalModel.undo();
      }
    );
  });
});
