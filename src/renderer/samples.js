
export const samples = [
  {
    leftPath: 'app.js',
    rightPath: 'app.js.new',
    left: [
      'function calculateTotal(items) {',
      '  return items.reduce((sum, item) => {',
      '    return sum + item.price;',
      '  }, 0);',
      '}',
      '',
      'const items = [',
      '  { name: "Book", price: 10 },',
      '  { name: "Pen", price: 1 }',
      '];',
      '',
      'console.log(calculateTotal(items));'
    ].join('\n'),
    right: [
      'function calculateTotal(items) {',
      '  return items.reduce((sum, item) => {',
      '    const discount = item.discount || 0;',
      '    return sum + (item.price * (1 - discount));',
      '  }, 0);',
      '}',
      '',
      'const items = [',
      '  { name: "Book", price: 10, discount: 0.1 },',
      '  { name: "Pen", price: 1 },',
      '  { name: "Notebook", price: 5, discount: 0.2 }',
      '];',
      '',
      'console.log("Total:", calculateTotal(items));'
    ].join('\n')
  },
  {
    leftPath: 'styles.css',
    rightPath: 'styles.css.new',
    left: [
      '.button {',
      '  background: blue;',
      '  color: white;',
      '  padding: 10px;',
      '}',
      '',
      '.header {',
      '  font-size: 24px;',
      '}'
    ].join('\n'),
    right: [
      '.button {',
      '  background: #2196f3;',
      '  color: white;',
      '  padding: 12px 24px;',
      '  border-radius: 4px;',
      '  transition: all 0.3s;',
      '}',
      '',
      '.button:hover {',
      '  transform: translateY(-2px);',
      '  box-shadow: 0 2px 8px rgba(0,0,0,0.2);',
      '}',
      '',
      '.header {',
      '  font-size: 24px;',
      '  font-weight: bold;',
      '}'
    ].join('\n')
  },
  {
    leftPath: 'config.json',
    rightPath: 'config.json.new',
    left: [
      '{',
      '  "port": 3000,',
      '  "debug": false,',
      '  "theme": "light"',
      '}'
    ].join('\n'),
    right: [
      '{',
      '  "port": 3000,',
      '  "debug": true,',
      '  "theme": "dark",',
      '  "api": {',
      '    "timeout": 5000,',
      '    "retries": 3',
      '  }',
      '}'
    ].join('\n')
  }
];

// Remove this function since we'll handle it in emptyState
export function createSampleDiffs(createDiffEditor, getLanguageFromPath) {
  samples.forEach(sample => {
    createDiffEditor(
      'container',
      sample.left,
      sample.right,
      getLanguageFromPath(sample.leftPath),
      sample.leftPath,
      sample.rightPath
    );
  });
}

