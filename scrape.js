const logMode = ''

const log = (mode, ...what) => (
  mode.split(',').includes(logMode) && console.log(...what),
  what[what.length - 1]
)

if ( !getCurrentElement ) // in case we're running this right from the console (otherwise it's already defined in komple.js)
  function getCurrentElement() {
    let { parentElement } = document.getSelection().getRangeAt(0).startContainer
    return parentElement
  }

// Function to scrape all text preceding a certain element.
function scrapePrompt({ stop, whatIsScraped, whatIsInputed } = {
  stop: { selector: 'body' },
  whatIsScraped: 'text',
  whatIsInputed: 'user input'
}) {
  let 
    node = getCurrentElement(),
    text = '',
    lastAddedNode = null

  const isStopElement = element => element.matches?.(stop.selector) || element == document.body
  
  while ( true ) {

    log('full', 'starting node', node)

    // Go to previous sibling
    let { previousSibling, parentElement } = node

    if ( previousSibling ) {

      node = previousSibling
      log('full', 'previous sibling', node)

      // Go to the deepest last descendant of the node
      while ( node.lastChild ) {
        log('full', 'descendant', node.lastChild)
        node = node.lastChild
      }

      // Add the node's textContent to the text with a new line, at the beginning. Skip if there's no text, if the parent element is not visible, or if it' a comment.
      if ( 
        node.nodeName === 'BR' ||
          node.textContent 
          && node.parentElement.offsetParent 
          && node.nodeType !== Node.COMMENT_NODE 
      ) {
        log('full,mid', 'adding text', node.textContent, node.offsetTop)

        // Let's see if we need to add a new line.
        let 
          { parentElement } = node,
          lastParentElement = lastAddedNode?.parentElement

        let addNewLine = parentElement.offsetTop !== lastParentElement?.offsetTop
        log('full,mid', 'add new line', addNewLine, parentElement.offsetTop, lastParentElement?.offsetTop)
        text = node.textContent.trim() + ( addNewLine ? '\n' : ' ' ) + text
        lastAddedNode = node
      }

    } else { 
      // Go to parent
      node = parentElement
      log('full', 'parent', node)
    }

    // If we've reached the stop element or the body, stop
    if ( isStopElement(node) || node === document.body ) {
      log('full', 'stopping', node)
      break
    }

  }

  text = 'Predict user input based on scraped text.\n\n== scraped text ==\n\n' + text
  // Trim text and replace any more than 2 consecutive new lines with a double new line.
  text = text.trim().replace(/(\n\s*){2,}/g, '\n\n')

  text = `${text}\n\n== ${whatIsInputed} predicted based on the ${whatIsScraped} above, as scraped from ${window.location.href} ==\n\n`

  log('full', 'text', text)
  return text
  
}

scrapePrompt({
  stop: {
    selector: 'h2'
  }
})

// // Bind the function to alt+q
// document.addEventListener('keydown', ({ key, altKey }) => {
//   (key === 's' && altKey) && scrapePrompt({
//     stop: {
//       selector: 'table'
//     }
//   })
// })

// console.log('Sandbox loaded.')