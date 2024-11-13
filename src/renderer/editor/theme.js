export function defineOneMonokaiTheme() {
  monaco.editor.defineTheme('one-monokai', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // Comments
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'html.doctype', foreground: '5c6370', fontStyle: 'italic' },
      
      // Strings
      { token: 'string', foreground: '98c379' },
      { token: 'string.embedded.begin', foreground: 'e06c75' },
      { token: 'string.embedded.end', foreground: 'e06c75' },
      { token: 'string.embedded', foreground: '56b6c2' },
      
      // Numbers and constants
      { token: 'constant.numeric', foreground: 'd19a66' },
      { token: 'constant.language', foreground: 'd19a66' },
      { token: 'constant.character', foreground: 'd19a66' },
      { token: 'constant.other', foreground: 'd19a66' },
      
      // Variables
      { token: 'variable.language', foreground: 'c678dd' },
      { token: 'variable.readwrite', foreground: 'e06c75' },
      { token: 'variable.parameter', foreground: 'e06c75', fontStyle: 'italic' },
      { token: 'variable', foreground: 'abb2bf' },
      
      // Keywords and operators
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'keyword.operator', foreground: '61afef' },
      { token: 'keyword.operator.logical', foreground: 'c678dd' },
      { token: 'storage', foreground: 'c678dd' },
      { token: 'storage.type', foreground: 'c678dd' },
      
      // Classes and types
      { token: 'entity.name.class', foreground: 'e5c07b' },
      { token: 'entity.name.type', foreground: 'e5c07b' },
      { token: 'entity.other.inherited-class', foreground: '98c379' },
      { token: 'entity.name.function', foreground: '61afef' },
      
      // Tags and attributes
      { token: 'entity.name.tag', foreground: 'e06c75' },
      { token: 'entity.other.attribute-name', foreground: 'd19a66' },
      
      // Support
      { token: 'support.function', foreground: '56b6c2' },
      { token: 'support.class', foreground: 'e5c07b' },
      { token: 'support.type', foreground: 'e06c75' },
      { token: 'support.constant', foreground: 'e5c07b' },
      
      // JSON
      { token: 'support.dictionary.json', foreground: 'e06c75' },
      
      // Invalid
      { token: 'invalid', foreground: 'F8F8F0', background: 'c678dd' },
      { token: 'invalid.deprecated', foreground: 'F8F8F0', background: '56b6c2' },
      
      // Diff specific
      { token: 'meta.diff', foreground: '75715E' },
      { token: 'meta.diff.header', foreground: '75715E' },
      { token: 'markup.deleted', foreground: 'c678dd' },
      { token: 'markup.inserted', foreground: 'e5c07b' },
      { token: 'markup.changed', foreground: '98c379' },
      // Basic syntax - preserved from original
      { token: 'comment', foreground: '676F7D', fontStyle: 'italic' },
      { token: 'string', foreground: 'E5C07B' },
      { token: 'string.template', foreground: 'E5C07B' },
      { token: 'constant.numeric', foreground: 'C678DD' },
      { token: 'constant.language', foreground: '56B6C2' },
      { token: 'constant.character', foreground: '56B6C2' },
      { token: 'constant.other', foreground: '56B6C2' },
      { token: 'variable', foreground: 'ABB2BF' },
      { token: 'variable.language', foreground: 'E06C75' },
      { token: 'variable.parameter', foreground: 'D19A66', fontStyle: 'italic' },
      
      // Keywords and operators
      { token: 'keyword', foreground: 'E06C75' },
      { token: 'keyword.operator', foreground: 'E06C75' },
      { token: 'keyword.operator.logical', foreground: 'E06C75' },
      { token: 'storage', foreground: 'E06C75' },
      { token: 'storage.type', foreground: '56B6C2' },
      
      // Classes and types
      { token: 'entity.name.class', foreground: '61AFEF' },
      { token: 'entity.name.type', foreground: '61AFEF' },
      { token: 'entity.other.inherited-class', foreground: '98C379' },
      { token: 'entity.name.function', foreground: '98C379' },
      
      // Objects and properties
      { token: 'variable.other.object', foreground: '61AFEF' },
      { token: 'variable.other.constant', foreground: '61AFEF' },
      { token: 'variable.other.property', foreground: 'ABB2BF' },
      
      // Tags and attributes
      { token: 'entity.name.tag', foreground: 'E06C75' },
      { token: 'entity.other.attribute-name', foreground: '98C379' },
      
      // Support
      { token: 'support.function', foreground: '98C379' },
      { token: 'support.class', foreground: '61AFEF' },
      { token: 'support.type', foreground: '56B6C2' },
      { token: 'support.constant', foreground: '56B6C2' },
      
      // Markdown specific
      { token: 'markup.bold', foreground: 'E06C75', fontStyle: 'bold' },
      { token: 'markup.italic', foreground: 'E06C75', fontStyle: 'italic' },
      { token: 'markup.heading', foreground: 'E06C75', fontStyle: 'bold' },
      { token: 'markup.quote', foreground: '98C379' },
      { token: 'markup.raw', foreground: '56B6C2' }
    ],
    colors: {
      // Editor colors
      'editor.background': '#282C34',
      'editor.foreground': '#ABB2BF',
      'editor.lineHighlightBackground': '#383E4A',
      'editor.selectionBackground': '#3E4451',
      'editor.findMatchBackground': '#42557B',
      'editor.findMatchHighlightBackground': '#314365',
      'editorCursor.foreground': '#f8f8f0',
      'editorWhitespace.foreground': '#3B4048',
      'editorIndentGuide.background': '#3B4048',
      'editorLineNumber.foreground': '#495162',
      'editorError.foreground': '#c24038',
      
      // Editor widgets
      'editorWidget.background': '#21252B',
      'editorHoverWidget.background': '#21252B',
      'editorHoverWidget.border': '#181A1F',
      'editorSuggestWidget.background': '#21252B',
      'editorSuggestWidget.border': '#181A1F',
      'editorSuggestWidget.selectedBackground': '#2c313a',
      
      // Diff editor specific
      'diffEditor.insertedTextBackground': '#00809B33',
      'diffEditor.border': '#181A1F',
      
      // UI elements
      'scrollbarSlider.background': '#4E566680',
      'scrollbarSlider.hoverBackground': '#5A637580',
      'scrollbarSlider.activeBackground': '#747D9180',
      
      // Additional UI colors
      'activityBar.background': '#2F333D',
      'activityBar.foreground': '#D7DAE0',
      'sideBar.background': '#21252b',
      'sideBarSectionHeader.background': '#282c34',
      'statusBar.background': '#21252B',
      'statusBar.foreground': '#9da5b4',
      'titleBar.activeBackground': '#282c34',
      'titleBar.activeForeground': '#9da5b4',
      'titleBar.inactiveBackground': '#282C34',
      'titleBar.inactiveForeground': '#6B717D',
      'tab.activeBackground': '#2c313a',
      'tab.inactiveBackground': '#21252B',
      'tab.border': '#181A1F',
      'list.activeSelectionBackground': '#2c313a',
      'list.activeSelectionForeground': '#d7dae0',
      'list.focusBackground': '#383E4A',
      'list.hoverBackground': '#292d35'
    }
  });
}
