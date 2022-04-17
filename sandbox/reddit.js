// Crawl DOM for conversation content from reddit

let crawlRules = {
  pieces: {
    author: {
      selector: '[data-click-id="user"]',
      last: true
    },
    title: {
      selector: 'title'
    },
    post: {
      selector: '[data-click-id="text"]',
      last: true
    },
    comments: {
      many: true,
      crawl: true, // we start with the active element (where we will be adding new comments) and crawl backwards
      stop: {
        // stop at the first comment in *this* thread, its padding-left is 16px
        style: {
          'padding-left': '16px'
        }
      },
      extract: {
        author: {
          test: {
            attributes: {
              'data-testid': {
                value: 'comment_author_link'
              }
            }
          }
        },
        comment: {
          test: {
            attributes: {
              'data-testid': {
                value: 'comment'
              }
            }
          }
        }
      },
      output: `
u/%author%:

%comment%
`

    },
    self: {
      // First <a> element that is a descendant of an element with style="max-width:100%"
      selector: '[class="header-user-dropdown"] > button > span > span > span > span'
    }
  },
  output: `
%title%
Posted by %author%

%post%

Comments:
%comments%
u/%self%:

`}

function getCurrentElement() {
  let { parentElement } = document.getSelection().getRangeAt(0).startContainer
  console.log(parentElement)
  return parentElement
}

function getText(element, { property, replace } = {}) {
  let text = element[property || 'textContent']
  if ( replace )
    text = text.replace(new RegExp(replace[0], 'g'), replace[1])
  return text
}

function testObject(object, test) {
  for ( let property in test ) {
    // If Object, recurse; otherwise, test the value
    let passed = 
      ( typeof test[property] === 'object') ? 
        testObject(object[property], test[property]) 
        : object?.[property] === test[property]
    if ( !passed )
      return false
  }
  return true
}

function getPromptFromRules(crawlRules) {

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
}

getPromptFromRules(crawlRules)