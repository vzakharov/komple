// Komple: A chrome extension that displays an autocomplete suggestion in the currently active element, taking the suggestion from an external API.

let logMode = ''

const log = (mode, ...what) => (
  mode.split(',').includes(logMode) && console.log(...what),
  what[what.length - 1]
)

let autocompleteTimer = null
let autocompleteInProgress = null
let modifierPressed = null

function isHotkey(keydownEvent, hotkeyName) {
  const { key, modifier } = settings.hotkeys[hotkeyName]
  console.log(key, modifier, modifierPressed)
  return key === keydownEvent.key && modifierPressed === modifier
}

const modifierListener = ['keydown', e => {
  if ( ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key) ) {
    // console.log('Modifier pressed:', e.key)
    modifierPressed = e.key
  }
}]

const clearModifierListener = ['keyup', e => {
  if ( ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key) ) {
    // console.log('Modifier released:', modifierPressed)
    modifierPressed = null
  }
}]

const autocompleteListener = ( e ) => {
  // if the hotkey is pressed, autocomplete
  if ( e.key == settings.hotkeys.autocomplete.key && settings.hotkeys.autocomplete.modifier && modifierPressed === settings.hotkeys.autocomplete.modifier ) {
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
          let { modifier } = settings.hotkeys.apiPicker

          for ( let api of settings.apis ) {

            index++
            let apiDiv = document.createElement('div')
            apiDiv.innerHTML = `<kbd style="background-color: #ccc;">${index}</kbd> ${api.name}`
            apiDiv.className = 'komple-api-picker-item'
            apiDiv.style['font-weight'] = api === settings.api ? 'bold' : 'normal'
            apiDiv.style['margin-bottom'] = '5px'

            div.appendChild(apiDiv)
          }

          // Add listener for alt+numeric keys that will select the corresponding API
          let nextListener = ['keydown', event => {
            let { key } = event
            console.log('Picker listener:', key)
            // If no API picker exists, delete the listener and return
            if ( !document.getElementById('komple-api-picker') )
              return document.removeEventListener(...nextListener)
            
            if ( key.match(/^[1-9]$/) ) {
              settings.currentApiName = settings.apis[key - 1].name
              saveSettings()
              autocomplete()
            }
            
            if ( key === 'c' ) {
              navigator.clipboard.writeText(getPrompt().prompt)
            }

            removeApiPicker()
            event.preventDefault()
          }]

          let copyDiv = document.createElement('div')
          copyDiv.innerHTML = '<kbd style="background-color: #ccc;">c</kbd> Copy prompt to clipboard'
          div.appendChild(copyDiv)

          let keyupListener = ['keyup', e => {
            if ( e.key === modifier )
              removeApiPicker()
          }]

          function removeApiPicker() {
            apiPicker.remove()
            document.removeEventListener(...nextListener)
            document.removeEventListener('click', removeApiPicker)
            document.removeEventListener(...keyupListener)
          }


          document.addEventListener(...nextListener)


          // Remove the API picker when the user clicks anywhere in the document
          document.addEventListener('click', removeApiPicker)
          document.addEventListener(...keyupListener)

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

  document.addEventListener(...modifierListener)
  document.addEventListener(...clearModifierListener)

  // Load extension config from chrome storage
  chrome.storage.sync.get('settings', data => {
    console.log('Loaded config from chrome storage:', data.settings)
    if ( data.settings )
      for ( let key in settings )
        settings[key] = data.settings[key]
    console.log('Loaded settings:', settings)
  })

  // Listen to chrome storage to update settings
  chrome.storage.onChanged.addListener(event => {
    let { newValue } = event.settings
    Object.assign(settings, newValue)
    console.log('Settings changed:', settings)
  })
}

function disable() {

  document.removeEventListener('keydown', autocompleteListener)
  document.removeEventListener('keydown', pickerListener)
  document.removeEventListener('click', cancelAutocomplete)
  document.removeEventListener('keydown', escapeListener)
  document.removeEventListener(...modifierListener)
  document.removeEventListener(...clearModifierListener)

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

  // Cool shadow
  div.style.boxShadow = '0px 2px 5px -1px rgba(50, 50, 93, 0.25), 0px 1px 3px -1px rgba(0, 0, 0, 0.3) '

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
    'reddit.com': {
      scraperVersion: 'v1',
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
      scraperVersion: 'v2',
      stop: {
        selector: 'h2' // Stop at conversation title
      },
      whatIsScraped: 'conversation',
      whatIsInputed: 'user reply',
    },
    'quora.com': {
      scraperVersion: 'v2',
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
  } else if ( element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' ) {
    input = element.value.slice(0, element.selectionStart).trimEnd()
    suffix = element.value.slice(element.selectionEnd).trimStart()
  } else {
    feeder = input = builder?.feeder || ''
  }

  if ( suffix ) suffix = ' ' + suffix

  try {

    prompt = typeof builder === 'function' ?
      builder({ input, feeder, suffix })
      : (
        scrape[builder?.scraperVersion || 'default'](builder)
      )
    
    // If it's an object, it will return { prompt, suffix }, which we need to reassign
    if ( typeof prompt === 'object' ) {
      ({ prompt, suffix } = prompt)
      suffix = suffix.trimRight()
      prompt = prompt.trim()
    } else {
      prompt += input
    }
  } catch (e) {
    console.log('Error:', e)
    ;( { prompt, suffix } = scrape.default() )
  }

  process = text => {  
    if (!text) return
    // Remove all {{...}} bits
    text = text.replace(/\{\{[\s\S]+?\}\}/g, '')
    // Replace any number of newlines with 2
    text = text.replace(/\n+/g, '\n\n')
    text = text.trimRight()
    return text
  }

  prompt = process(prompt)
  suffix = process(suffix)

  // Remove everything in the prompt before and including '//start'
  prompt = prompt.split('\n//start').pop()

  // Remove everything in the suffix after and including '//stop'
  if ( suffix) suffix = suffix.split('\n//stop').shift()

  console.log('Prompt:', prompt)
  console.log('Suffix:', suffix)

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
  output += `${myHandle}: `

  return output

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