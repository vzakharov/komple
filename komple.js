// Komple: A chrome extension that displays an autocomplete suggestion in the currently active element, taking the suggestion from an external API.

let logMode = ''

const log = (mode, ...what) => (
  mode.split(',').includes(logMode) && console.log(...what),
  what[what.length - 1]
)

let autocompleteTimer = null
let autocompleteInProgress = null

const autocompleteListener = ( e ) => {
  // if the hotkey is pressed, autocomplete
  if ( e.key == settings.hotkeys.autocomplete.key && e.getModifierState(settings.hotkeys.autocomplete.modifier) ) {
    autocomplete()
  } 
  // if the activateOnHangingChar setting is on, autocomplete after a hanging character is typed
  else if ( settings.activateOnHangingChar ) {
    // if a hanging character is typed, start the autocomplete timer
    if ( e.key.match(/^[\[\(\{\s“,]$/) ) {
      autocompleteTimer = setTimeout(
        () => autocomplete(),
        500),
        console.log('Autocomplete timer started')
    // if a non-hanging character is typed, cancel the autocomplete timer
    } else {
      if ( autocompleteTimer || autocompleteInProgress )
        cancelAutocomplete()
    }
  }
}

function cancelAutocomplete() {

  if ( autocompleteTimer || autocompleteInProgress ) {
    clearTimeout(autocompleteTimer),
    autocompleteTimer = null,
    autocompleteInProgress = null,
    document.getElementById('komple-thinking')?.remove()
  }

}

function toggleConfigModal() {
  let 
    modal = document.getElementById('komple-config')

  if ( modal )
    modal.style.display = modal.style.display === 'none' ? 'block' : 'none'
  else 
    createConfigModal()
}

const pickerListener = ( e ) => {
  if ( isHotkey(e, 'apiPicker') ) {

    let apiPicker = document.getElementById('komple-api-picker')
    let configModal = document.getElementById('komple-config')
    let configVisible = configModal && configModal.style.display !== 'none'

    if ( apiPicker || configVisible ) {
      apiPicker?.remove()
      console.log({ configVisible })
      if ( configVisible )
        configModal.style.display = 'none'
    } else 
      getCurrentElement()?.isContentEditable ? 
        apiPicker = createDivUnderCurrentElement({ id: 'komple-api-picker' }, div => {

        let index = 0
        
        // 'Choose an API'
        div.appendChild(document.createElement('div')).innerHTML = '<b>Choose an API</b>'

        for ( let api of settings.apis ) {

          index++
          let apiDiv = document.createElement('div')
          apiDiv.innerText = `[Alt+${index}] ${api.name}`
          apiDiv.className = 'komple-api-picker-item'
          apiDiv.style['font-weight'] = api === settings.api ? 'bold' : 'normal'

          div.appendChild(apiDiv)
        }

        // Add listener for alt+numeric keys that will select the corresponding API
        let numListener = ['keydown', ({ key, altKey }) => {
          // If no API picker exists, delete the listener and return
          if ( !document.getElementById('komple-api-picker') )
            document.removeEventListener(...numListener)
          else if ( key.match(/^[1-9]$/) && altKey ) {
            settings.currentApiName = settings.apis[key - 1].name
            saveSettings()
            removeApiPicker()
            autocomplete()
          }
        }]

        let configDiv = document.createElement('div')
        configDiv.innerText = '[Alt+X] Configure APIs'

        let copyDiv = document.createElement('div')
        copyDiv.innerText = '[Alt+C] Copy prompt to clipboard'

        // Add listener on Alt+C
        let configListener = ['keydown', ({ key, altKey }) => {
          if ( key === 'x' && altKey ) {
            console.log('Configuring')
            let configModal = document.getElementById('komple-config') || createConfigModal()
            configModal.style.display = 'block'
            removeApiPicker()
          } else if ( key === 'c' && altKey ) {
            navigator.clipboard.writeText(getPrompt().prompt)
            removeApiPicker()
          }
        }]
        document.addEventListener(...configListener)

        div.appendChild(configDiv)
        div.appendChild(copyDiv)

        function removeApiPicker() {
          apiPicker.remove()
          document.removeEventListener(...numListener)
          document.removeEventListener(...configListener)
        }

        document.addEventListener(...numListener)


        // Remove the API picker when the user clicks anywhere in the document
        document.addEventListener('click', removeApiPicker)
        // ...or presses escape

        }) 
        : toggleConfigModal()
  }
}

const escapeListener = ({ key }) => {
  if ( key === 'Escape' ) {
    // Remove picker and modal, if either exists
    document.getElementById('komple-api-picker')?.remove()
    document.getElementById('komple-config')?.remove()
  }
}

function enable() {

  document.addEventListener('keydown', autocompleteListener)
  document.addEventListener('keydown', pickerListener)
  // cancel autocomplete on mouse click
  document.addEventListener('click', cancelAutocomplete)
  document.addEventListener('keydown', escapeListener)

  // Load extension config from chrome storage
  chrome.storage.sync.get('settings', data => {
    console.log('Loaded config from chrome storage:', data.settings)
    if ( data.settings )
      for ( let key in settings )
        settings[key] = data.settings[key]
    console.log('Loaded settings:', settings)
  })

}

function disable() {

  document.removeEventListener('keydown', autocompleteListener)
  document.removeEventListener('keydown', pickerListener)
  document.removeEventListener('click', cancelAutocomplete)
  document.removeEventListener('keydown', escapeListener)

}

// Recursively go through children of an element to the deepest child whose textContent ends with a double backslash.
function deepestMatchingChild(element) {

  if ( element.textContent/*.includes('\\')*/ ) {
    // Scan children. If none, return the element.
    if ( !element.children.length )
      return element
    // If there are children, recurse.
    else
      for ( let child of element.children ) {
        let result = deepestMatchingChild(child)
        if ( result )
          return result
      }
  }
    
}

function getCurrentElement() {
  let { parentElement } = document.getSelection()?.focusNode
  return parentElement
}

function createDivUnderCurrentElement(attributes, callback) {

  let div = document.createElement('div')
  Object.assign(div, attributes)

  div.style.position = 'fixed'
  div.style.color = 'rgba(0,0,0,0.7)'

  let currentElement = getCurrentElement()
  // console.log('currentElement:', currentElement)
  let { bottom, left } = currentElement.getBoundingClientRect()
  div.style.top = bottom + 'px'
  div.style.left = left + 'px'
  div.style.zIndex = '9999'
  div.style.backgroundColor = '#fff'
  div.style['border-radius'] = '5px'
  div.style.padding = '5px'
  div.style['font-family'] = 'sans-serif'
  div.style['font-size'] = '0.8em'

  callback?.(div)

  document.body.appendChild(div)

  // console.log('Created div:', div)

  return div

}

async function autocomplete() {

  if ( autocompleteInProgress )
    cancelAutocomplete()

  // Assign a random id to this autocomplete
  let id = Math.random().toString(36).substring(2, 15)
  autocompleteInProgress = id
  console.log('Autocomplete started, id = ' + id)

  // // Get the deepest matching child.
  // let element = deepestMatchingChild(document.activeElement)
  let element = document.activeElement

  // console.log('Enclosing element:', element)

  if ( element ) {

    let { prompt, feeder, suffix } = getPrompt(element)
    
    try {
      startThinking( suffix ? 'Inserting' : 'Completing' )
      let completion = await getSuggestion(prompt.trimRight(), { feeder, suffix })
      if ( feeder ) completion = feeder + completion
    
      if ( autocompleteInProgress === id ) {
        // If the prompt's last character isn't alphanumeric, remove the leading space from the completion
        prompt.match(/\W$/) && completion.replace(/^\s+/, '')

        // Remove any leading and trailing newlines
        completion = completion.replace(/^\n+/, '').replace(/\n+$/, '')

        // Replace any newlines (in any quantity) with a space
        completion = completion.replace(/\n+/g, ' ')
  
        // Remove everything after and including the first newline
        completion = completion.replace(/\n.*/g, '')
  
        console.log('Completion:', completion)
  
        simulateTextInput(completion)

        cancelAutocomplete()
      }
  
    } catch (e) {
      console.log('Error:', e)
      cancelAutocomplete()
    }

  }

}

function startThinking(action = 'Completing') {
  let thinking = document.getElementById('komple-thinking')

  thinking = createDivUnderCurrentElement({
    id: 'komple-thinking',
    innerHTML: `${action} with <b>${settings.currentApiName}</b>...`
  })

  // Add another thinking emoji to the end of the thinking element every second
  let thinkingInterval = setInterval(() => {
    document.getElementById('komple-thinking') ?
      thinking.innerHTML += '.'
      : clearInterval(thinkingInterval)
  }, 1000)
}

function getPrompt(element = getCurrentElement()) {
  let builders = {
    'twitter.com': getTwitterPrompt,
    'notion.so': getNotionPrompt,
    'reddit.com': {
      legacy: true,
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
          crawl: true,
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
      u/%author%: %comment%
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
      u/%self%:`
    },
    'mail.google.com': {
      stop: {
        selector: 'h2' // Stop at conversation title
      },
      whatIsScraped: 'conversation',
      whatIsInputed: 'user reply',
    },
    'quora.com': {
      whatIsScraped: 'question',
      whatIsInputed: 'insightful answer',
      instruction: 'Here is an insightful answer on Quora',
    }
  }

  let host = document.location.hostname.replace(/^(www\.)?/, '')
  let builder = builders[host]
  console.log('Builder:', builder)
  let prompt, input, feeder, suffix
  if ( element.textContent ) {
    // Get the selection
    let selection = window.getSelection()
    // Get the caret position for the beginning and end of the selection
    let { 
      anchorOffset, focusOffset,
      anchorNode, focusNode,
    } = selection
    // Split the selection before and after the caret, assigning the values to input and suffix, respectively
    input = anchorNode.textContent.slice(0, anchorOffset).trimEnd()
    suffix = focusNode.textContent.slice(focusOffset).trimStart()
    if ( suffix) suffix = ' ' + suffix
  } else {
    feeder = input = builder?.feeder || ''
  }


  try {
    prompt = builder ?
      typeof builder === 'function' ?
        builder({ input, feeder, suffix })
        : ( builder.legacy ?
          getPromptFromRules(builder)  
          : scrapePrompt(builder)
        ) + input
      : scrapePrompt() + input
  } catch (e) {
    console.log('Error:', e)
    prompt = input
  }

  console.log('Prompt:', prompt)
  return { prompt, feeder, suffix }
}

function getTwitterPrompt({ input }) {

  // function to extract Twitter handle from href
  const getHandle = href => href.replace(/^.*?(\w+)$/, '@$1')

  // Find element with aria-label "Profile" and extract the Twitter handle from its href
  let myHandle = getHandle( document.querySelector('[aria-label="Profile"]').href )

  // Find element with aria-label of Timeline: Conversation
  let conversation = document.querySelector('[aria-label="Timeline: Conversation"]')

  let output = `Here is a conversation with an insightful reply by ${myHandle}:\n\n`

  // Scan through all its decendants, adding items if it's an <article> element
  for ( let element of conversation.querySelectorAll('*') ) {

    // If it's the current active element, exit the loop
    if ( element === document.activeElement )
      break

    // If it's an <article> element, add it to the list of messages
    if ( element.tagName === 'ARTICLE' ) {
      let handle = getHandle( element.querySelector('a[role="link"]').href )
      let content = element.querySelector('[lang]')?.textContent || '[image]'

      output += `${handle}: ${content}\n\n`
    
    }

  }

  // Add my handle to the end of the list, plus any existing content of the active element
  output += `${myHandle}: ${input}`

  return output

}

function getNotionPrompt({ input, suffix }) {

  try {

    // Remove 'Add icon\nAdd cover\nAdd comment\n' from the beginning of the active element's innerText
    let prompt = document.activeElement.innerText.replace(/^Add icon\nAdd cover\nAdd comment\n/, '')

    // Replace newlines with double newlines
    prompt = prompt.replace(/\n/g, '\n\n')

    // If input and suffix are present, remove everything after the input from the prompt
    // This is a workaround (because the input can repeat several times in the prompt)
    // console.log({ input, suffix })
    if ( input && suffix )
      prompt = prompt.replace(new RegExp(`(${escapeRegExp(input)})[\\s\\S]*$`), '$1')

    return prompt

  } catch (e) {
    console.log(e)
  }

}

function getText(element, { property, replace } = {}) {
  if (!element) return ''

  let text = element[property || 'textContent']
  if ( replace )
    text = text.replace(new RegExp(replace[0], 'g'), replace[1])

  return text
}

function testObject(object, test) {
  for ( let property in test ) {
    // If Object, recurse; otherwise, test the value
    let 
      value = object?.[property], 
      testValue = test[property],
      passed =
        ( typeof testValue === 'object' ) ?
          testObject(value, testValue)
          : value === testValue
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


function setCaretPosition(element, position) {

  let range = document.createRange()
  let sel = window.getSelection()
  range.setStart(element.firstChild, position)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)

}

function simulateTextInput(text) {

  document.execCommand('insertText', false, text)

}

async function getSuggestion(text, { suffix }) {

    let {
      endpoint, auth, promptKey, otherBodyParams, arrayKey, resultKey, suffixKey
    } = settings.api

    console.log({suffixKey, suffix})
    // Get the suggestion from the external API.
    let json = await(
      await fetch(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `${auth}`
          },
          body: JSON.stringify({
            [promptKey]: text,
            ...( suffixKey && suffix ) ? { [suffixKey]: suffix } : {},
            ...otherBodyParams
          })
        }
      )
    ).json()

    // return arrayKey ? 
    //   json[arrayKey][0][resultKey] 
    //   : json[resultKey]
    return get(arrayKey ? json[arrayKey][0] : json, resultKey)
}

function saveSettings() {
  // Save to chrome storage
  chrome.storage.sync.set({ settings }, () => {
    console.log('Saved config to chrome storage:', settings)
  })
}

enable()
