// Simple function to normalize content differences
export function normalizeContent(leftContent, rightContent) {
  if (!leftContent || !rightContent) return rightContent;
  
  // Remove leading newline if it shouldn't be there
  if (rightContent.startsWith('\n') && !leftContent.startsWith('\n')) {
    rightContent = rightContent.substring(1);
  }
  
  // Match trailing newlines only if they differ by one
  const leftNewlines = (leftContent.match(/\n*$/) || [''])[0].length;
  const rightNewlines = (rightContent.match(/\n*$/) || [''])[0].length;
  
  if (Math.abs(leftNewlines - rightNewlines) === 1) {
    rightContent = rightContent.replace(/\n*$/, '') + '\n'.repeat(leftNewlines);
  }
  
  return rightContent;
}