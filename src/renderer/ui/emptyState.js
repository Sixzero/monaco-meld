import { currentPort } from '../config.js';
import { sampleText1, sampleText2 } from "../samples.js";

export function createEmptyState(container, createDiffEditor) {
  // Create wrapper div to contain all elements
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    padding: 20px;
    height: calc(100% - 40px);
    overflow: auto;
  `;
  
  // Create message element
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    text-align: center;
    color: #d4d4d4;
    margin-top: 20px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 16px;
  `;
  messageDiv.textContent = 'There are no diffs to show';
  
  // Create curl help text with better readability
  const helpDiv = document.createElement('div');
  helpDiv.style.cssText = `
    text-align: left;
    color: #d4d4d4;
    margin: 20px auto;
    max-width: 800px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    background: #1e1e1e;
    padding: 20px;
    border-radius: 4px;
    white-space: pre-wrap;
    line-height: 1.5;
    font-size: 14px;
    border: 1px solid #383838;
  `;
  helpDiv.textContent = `To send a diff via curl:

curl -X POST http://localhost:${currentPort}/diff \\
  -H "Content-Type: application/json" \\
  -d '{
    "leftPath": "path/to/save/file.js",
    "leftContent": "original content",
    "rightContent": "modified content",
    "pwd": "/absolute/path/to/working/dir"
  }'

# Or with relative paths from pwd:
curl -X POST http://localhost:${currentPort}/diff \\
  -H "Content-Type: application/json" \\
  -d '{
    "leftPath": "./relative/path/file.js",
    "rightPath": "./other/file.js",
    "pwd": "'$(pwd)'"
  }'`;
  
  // Create button element
  const button = document.createElement('button');
  button.style.cssText = `
    display: block;
    margin: 20px auto;
    padding: 8px 16px;
    background: #2d2d2d;
    color: #e0e0e0;
    border: 1px solid #454545;
    border-radius: 4px;
    cursor: pointer;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  button.textContent = 'Load Example Diff';
  
  button.onmouseover = () => button.style.background = '#383838';
  button.onmouseout = () => button.style.background = '#2d2d2d';
  
  button.onclick = () => {
    wrapper.remove(); // Remove the wrapper instead of individual elements
    createDiffEditor(
      'container',
      sampleText1,
      sampleText2,
      'javascript',
      'sample1.js',
      'sample2.js'
    );
  };
  
  // Append elements to wrapper first
  wrapper.appendChild(messageDiv);
  wrapper.appendChild(helpDiv);
  wrapper.appendChild(button);
  
  // Then append wrapper to container
  container.appendChild(wrapper);
}
