const scrape = {

  v1(crawlRules) {

    let finalOutput = crawlRules.output
  
    for ( let key in crawlRules.pieces ) {
      let piece = crawlRules.pieces[key]
      let { selector, last, property, many, crawl, stop, extract, replace, output } = piece
  
      let text = ''
  
      if ( !crawl ) {
  
        let elements = document.querySelectorAll(selector)
        let element = last ? elements[elements.length - 1] : elements[0]
        text = getText(element, piece)
  
      } else {
  
        let items = many && [{}]
        let item = items?.[0] || {}
  
        let element = getCurrentElement()
  
        while ( true ) {
  
          // Go to previous sibling
          let { previousElementSibling, parentElement } = element
  
          if ( previousElementSibling ) {
            element = previousElementSibling
            // Go to the deepest last descendant of the element
            while ( element.lastElementChild ) {
              element = element.lastElementChild
            }
          } else // Go to parent
            element = parentElement
  
          // If we've reached the stop element or the top of the document, stop
          if ( testObject(element, stop) || !element )
            break
          
          // Check if the element matches any of the test attributes
          for ( let key in extract ) {
            
            if ( testObject(element, extract[key].test) )
              item[key] = getText(element, extract[key])
  
          }
  
          // If all extract selectors have been found: if many, add a new item to the array, else break out
          if ( Object.keys(item).length === Object.keys(extract).length ) {
            if ( many )
              items.push(item = {})
            else
              break
          }
  
        }
  
        // Reverse items
        items = items.reverse()
  
        // If the first item is incomplete, remove it
        if ( Object.keys(items[0]).length !== Object.keys(extract).length )
          items.shift()
  
        // Convert items to text
        text = ( 
          many ? items : [ item ]
        ).map(item => {
          let text = output
          for ( let key in item ) {
            text = text.replace(`%${key}%`, item[key])
          }
          return text
        }).join('')
  
      }
  
      finalOutput = finalOutput.replace(`%${key}%`, text)
    }
  
    console.log(finalOutput)
  
    return finalOutput
  },

  v2({ 
    stop = { selector: 'body'}, 
    whatIsScraped = 'text', 
    whatIsInputed = 'user input predicted' ,
    instruction = 'Predict user input based on scraped text'
  } = {} ) {
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
  
          let addNewLine = parentElement.offsetTop + parentElement.offsetHeight <= lastParentElement?.offsetTop
          log('full,mid', 'add new line', addNewLine, parentElement, lastParentElement)
          text = node.textContent + ( addNewLine ? '\n' : ' ' ) + text
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
  
    text = `${instruction}.\n\n== ${whatIsScraped} from ${window.location.href} ==\n\n${text}`
    // Trim text and replace any more than 2 consecutive new lines with a double new line.
    text = text.trim().replace(/(\n\s*){2,}/g, '\n\n')
  
    text = `${text}\n\n== ${whatIsInputed} based on the ${whatIsScraped} above ==\n\n`
  
    log('full', 'text', text)
    return text
    
  },

  v3(up) {

    let 
      selection = getSelection(),
      element = selection.anchorNode.parentElement, 
      texts = []
  
    if ( typeof up !== 'undefined' ) {
  
      const sibling = element => element[`${up ? 'previous' : 'next'}ElementSibling`]
      const addText = text => texts[up ? 'unshift' : 'push'](text)
  
      // First, add the text from the element itself, cutting it at either anchor or focus node and adding the respective text.
      addText(
        element.textContent.slice(
          ...up ? 
            [ 0, selection.anchorOffset ] :
            [ selection.focusOffset ]
        )
      )
  
      outerLoop: while (true) {
  
        while (sibling(element)) {
  
          element = sibling(element)
  
          // If the element is contenteditable, insert its textContent in the beginning of the texts array.
          if (element.attributes.contenteditable?.value === 'true') {
            console.log(element, element.textContent)
            addText(element.textContent)
          }
  
  
          // If it is not, but any of its descendants are, add  their combined textContent to the texts array.
          else {
            let editableDescendants = Array.from(element.querySelectorAll('[contenteditable="true"]'))
            if (editableDescendants.length) {
              let combinedText = editableDescendants.reduce((acc, el) => acc + el.textContent, '')
              console.log(element, editableDescendants, combinedText)
              addText(combinedText)
            } else {
              // If no descendants are contenteditable, stop the outer loop.
              break outerLoop
            }
          }
  
        }
  
        // Go to the deepest parent that has a previous sibling
        while (!sibling(element)) {
          element = element.parentElement
          if (!element)
            break outerLoop
        }
  
      }
  
      return texts.join('\n')
    } else {
  
      let [ prompt, suffix ] = [ 1, 0 ].map(scrape.v3)
      return { prompt, suffix } 
  
    }
  
  }
  
}

scrape.default = scrape.v3