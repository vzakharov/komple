const logMode = 'mid'

const log = (mode, ...what) => (
  mode.split(' ').includes(logMode) && console.log(...what),
  what[what.length - 1]
)

if ( !getCurrentElement ) // in case we're running this right from the console (otherwise it's already defined in komple.js)
  function getCurrentElement() {
    let { parentElement } = document.getSelection().getRangeAt(0).startContainer
    return parentElement
  }

// Function to scrape all text preceding a certain element.
function scrapePrompt({ stop }) {
  let node = getCurrentElement()
  let text = ''

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
        log('full mid', 'adding text', node.textContent, node.offsetTop)

        // Let's see if we need to add a new line.
        let 
          addNewLine = node.nodeName === 'BR',
          checkNode = node

        addNewLineLoop:
        while ( !addNewLine ) {
          // If there's a previous sibling, compare its offsetTop to the node's offsetTop. If it's the same, we don't need a new line.
          let { previousSibling } = checkNode
          if ( previousSibling ) {
            
            addNewLine = 
              checkNode.nodeType !== Node.TEXT_NODE 
              && checkNode.offsetTop !== previousSibling.offsetTop

            log('full mid', 'add new line?', addNewLine, checkNode, previousSibling)
            break
          } else {
            // Iterate to the topmost parent element with a previous sibling.
            while ( !checkNode.previousSibling  ) {
              checkNode = checkNode.parentElement
              log('full', 'no previous sibling, going up', checkNode)
              if ( isStopElement(checkNode) ) {
                log('full', 'no previous sibling, stopping', checkNode)
                break addNewLineLoop
              }
            }
          }
          
        }
        text = `${addNewLine ? '\n' : ' '}${node.textContent.trim()}${text}`
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

  // Trim text and replace any more than 2 consecutive new lines with a double new line.
  text = text.trim().replace(/\n{2,}/g, '\n\n')

  text = `Predict user input based on text scraped from the page.\n\n== Text scraped from ${window.location.href} ==\n\n${text}`

  text = `${text}\n\n== User's input ==\n\n`

  console.log(text)
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