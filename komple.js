// Komple: A chrome extension that displays an autocomplete suggestion in the currently active element, taking the suggestion from an external API.

// Completion API settings

const api = {
  endpoint: '',
  auth: '',
  censor: false,
  promptKey: 'prompt',
  otherBodyParams: {
    max_tokens: 50,
    temperature: 0.6,
    n: 1,
    stop: '\n'
  },
  arrayKey: 'choices',
  resultKey: 'text'    
}

////

let keyCount = 0

let debug = what => {
  console.log(what)
  return what
}

let autocompleteTimer = null
let runningAutocompletes = []

const autocompleteListener = ({ key, ctrlKey }) => {
  // If it's a space or an opening bracket, parenthesis, etc., start the autocomplete timer. If anything else, cancel the timer and cancel any autocompletion in progress. If it's ctrl+space, start the autocomplete right away.
  key === ' ' && ctrlKey ? 
    autocomplete() 
    : key.match(/^[\[\(\{\s“]$/) ?
      (
        autocompleteTimer = setTimeout(
          () => autocomplete(),
        500),
        console.log('Autocomplete timer started')
      ) : !ctrlKey && cancelAutocomplete()
}

function cancelAutocomplete() {

  autocompleteTimer && (
    console.log('Autocomplete timer canceled'),
    clearTimeout(autocompleteTimer),
    autocompleteTimer = null,
    runningAutocompletes = [],
    // Remove element with id 'komple-thinking'
    document.getElementById('komple-thinking')?.remove()
  )

}

const configureListener = ({ key, altKey }) => {
  if ( key === 'k' && altKey ) {
    let configModal = document.getElementById('komple-config') || createConfigModal()
    configModal.style.display = configModal.style.display === 'none' ? 'block' : 'none'
  }
}


function enable() {

  document.addEventListener('keyup', autocompleteListener)
  document.addEventListener('keydown', configureListener)
  // cancel autocomplete on mouse click
  document.addEventListener('click', cancelAutocomplete)

  // Load api config from chrome storage
  chrome.storage.sync.get('api', data => {
    console.log('Loaded api config from chrome storage', data.api)
    for ( let key in api ) {
      api[key] = data.api[key]
    }
  })


}

function disable() {

  document.removeEventListener('keyup', autocompleteListener)
  document.removeEventListener('keydown', configureListener)

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

async function autocomplete() {

  // Assign a random id to this autocomplete
  let id = Math.random().toString(36).substring(2, 15)
  runningAutocompletes.push(id)
  console.log('Autocomplete started, id = ' + id)

  // Display a thinking robot emoji under the caret
  let thinking = document.createElement('div')
  thinking.id = 'komple-thinking'
  thinking.innerText = '🤖🤔'
  thinking.style.position = 'fixed'
  // Make it slightly transparent
  thinking.style.color = 'rgba(0,0,0,0.7)'

  let { bottom, left } = document.getSelection().getRangeAt(0).startContainer.parentElement.getBoundingClientRect()

  thinking.style.top = bottom + 'px'
  thinking.style.left = left + 'px'
  // Place on top of all other elements
  thinking.style.zIndex = '9999'
  document.body.appendChild(thinking)

  // Add another thinking emoji to the end of the thinking element every second
  let thinkingInterval = setInterval(() => {
    document.getElementById('komple-thinking') ?
      thinking.innerText += '🤔'
      : clearInterval(thinkingInterval)
  }, 1000)

  // // Get the deepest matching child.
  // let element = deepestMatchingChild(document.activeElement)
  let element = document.activeElement

  console.log('Enclosing element:', element)

  if ( element ) {

    let initialCaretPosition = element.textContent.length
    // simulateTextInput('...')
    
    // let prompt =
    //   // Are we on twitter.com?
    //   document.location.hostname === 'twitter.com' ?
    //     getTwitterPrompt(element) :
    //     // Are we on notion.so?
    //       document.location.hostname === 'notion.so' &&
    //         getNotionPrompt()
    


    let prompt = {
      'twitter.com': getTwitterPrompt,
      'notion.so': getNotionPrompt
    }[
      document.location.hostname.replace(/^(www\.)?/, '')
    ]?.() || element.innerText    

    console.log('Prompt:', prompt)
    
    let completion = await getSuggestion(prompt.replace(/\s+$/, ''))
    

    if ( runningAutocompletes.includes(id) ) {
      // If prompt ends with a space, remove the leading space from the completion
      prompt.match(/\s+$/) && ( completion = completion.replace(/^\s+/, '') )

      // Remove everything after and including the first newline
      completion = completion.replace(/\n.*/g, '')

      console.log('Completion:', completion)

      simulateTextInput(completion)
      // setCaretPosition(element, initialCaretPosition)
      thinking.remove()
    }

  }

}

function getTwitterPrompt() {

  try {
    // function to extract Twitter handle from href
    const getHandle = href => href.replace(/^.*?(\w+)$/, '@$1')

    // Find element with aria-label "Profile" and extract the Twitter handle from its href
    let myHandle = getHandle( document.querySelector('[aria-label="Profile"]').href )

    // Find element with aria-label of Timeline: Conversation
    let conversation = document.querySelector('[aria-label="Timeline: Conversation"]')

    let output = ''

    // Scan through all its decendants, adding items if it's an <article> element
    for ( let element of conversation.querySelectorAll('*') ) {

      // If it's the current active element, exit the loop
      if ( element === document.activeElement )
        break

      // If it's an <article> element, add it to the list of messages
      if ( element.tagName === 'ARTICLE' ) {
        let handle = getHandle( element.querySelector('a[role="link"]').href )
        let content = element.querySelector('[lang]').textContent

        output += `${handle}:\n${content}\n\n`
      
      }

    }

    // Add my handle to the end of the list, plus any existing content of the active element
    output += `${myHandle}:\n${document.activeElement.textContent}`

    return output
  } catch (e) {
    console.log(e)
  }

}

function getNotionPrompt() {

  try {

    // Remove 'Add icon\nAdd cover\nAdd comment\n' from the beginning of the active element's innerText
    let prompt = document.activeElement.innerText.replace(/^Add icon\nAdd cover\nAdd comment\n/, '')

    // Replace newlines with double newlines
    prompt = prompt.replace(/\n/g, '\n\n')

    return prompt    

  } catch (e) {
    console.log(e)
  }

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


async function getSuggestion(text) {

    let {
      endpoint, auth, promptKey, otherBodyParams, arrayKey, resultKey
    } = api

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
            ...otherBodyParams
          })
        }
      )
    ).json()

    return arrayKey ? 
      json[arrayKey][0][resultKey] 
      : json[resultKey]
}

function createConfigModal() {
  // Creates and displays a modal dialog to configure the completion API.
  let modalBackground = document.createElement('div')
  modalBackground.id = 'komple-config'
  modalBackground.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 9999; display: none;'

  // Clicking on the background sets display to none.
  modalBackground.addEventListener('click', ({ target }) => {
    target === modalBackground && ( modalBackground.style.display = 'none' )
  })


  let modal = document.createElement('div')
  // Center-align the modal vertically and horizontally.
  modal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; border-radius: 10px; z-index: 100000; padding: 20px;'
  modalBackground.appendChild(modal)

  
  let modalContent = document.createElement('div')
  modalContent.classList.add('komple-config-content')
  modal.appendChild(modalContent)

  let modalHeader = document.createElement('div')
  modalHeader.classList.add('komple-config-header')
  modalContent.appendChild(modalHeader)

  let modalTitle = document.createElement('h2')
  modalTitle.textContent = 'Configure completion API'
  modalHeader.appendChild(modalTitle)

  let modalBody = document.createElement('div')
  modalBody.classList.add('komple-config-body')
  modalContent.appendChild(modalBody)

  let inputsTable = document.createElement('table')
  inputsTable.classList.add('komple-config-inputs')
  modalBody.appendChild(inputsTable)


  let inputs = {}
  for ( let key in api ) {

    let multiline = ['otherBodyParams'].includes(key)

    let input = document.createElement(
      multiline ? 'textarea' : 'input'
    )

    // If text area, set number of rows to the number of lines in the value.
    multiline && ( input.rows = JSON.stringify(api[key], null, 2).split('\n').length )

    !multiline && (
      input.type = 
        ['endpoint', 'auth'].includes(key) ?
          api.censor ? 'password' : 'text'
          : ['promptKey', 'arrayKey', 'resultKey'].includes(key) ?
            'text' :
                ['censor'].includes(key) ?
                  'checkbox' :
                  'number'
    )

    let valueKey = input.type === 'checkbox' ? 'checked' : 'value'
    input[valueKey] = key === 'otherBodyParams' ? JSON.stringify(api[key], null, 2) : api[key]

    let tr = document.createElement('tr')
    inputsTable.appendChild(tr)

    let labelTd = document.createElement('td')
    labelTd.textContent = {
      endpoint: 'Endpoint',
      auth: 'Authorization header',
      promptKey: 'Prompt key',
      arrayKey: 'Array key',
      resultKey: 'Result key',
      otherBodyParams: 'Other body params',
      censor: 'Censor endpoint \& key'
    }[key]

    let inputTd = document.createElement('td')
    inputTd.appendChild(input)

    tr.appendChild(labelTd)
    tr.appendChild(inputTd)
    if ( key === 'arrayKey' ) {
      // Add a note under the array key input.
      let note = document.createElement('div')
      note.style.cssText = 'font-size: 0.8em; color: #888; margin-bottom: 5px;'
      note.textContent = 'Leave empty if no array returned.'
      inputTd.appendChild(note)
    }

    if ( key === 'auth' ) {
      // Add a note that it should include "Bearer", not just the API key.
      let note = document.createElement('div')
      note.style.cssText = 'font-size: 0.8em; color: #888; margin-bottom: 5px;'
      note.textContent = 'Include "Bearer", if applicable.'
      inputTd.appendChild(note)
    }


    input.addEventListener('change', () => {
      if ( ['otherBodyParams'].includes(key) ) {
        try {
          api[key] = JSON.parse(input.value)
        } catch (e) {
          alert('Invalid JSON; reverting to previous value.')
          input.value = JSON.stringify(api[key], null, 2)
          return
        }
      } else {
        api[key] = input[valueKey]
      }

      key === 'censor' && (
        ['endpoint', 'auth'].forEach(key => {
          inputs[key].type = input.checked ? 'password' : 'text'
        })
      )

      // Save to chrome storage
      chrome.storage.sync.set({ api }, () => {
        console.log('Saved API config to chrome storage:', api)
      })
    })

    inputs[key] = input

  }

  let modalFooter = document.createElement('div')
  modalFooter.classList.add('komple-config-footer')
  modalContent.appendChild(modalFooter)

  let modalCloseButton = document.createElement('button')
  modalCloseButton.textContent = 'Close'
  modalCloseButton.addEventListener('click', () => {
    modalBackground.style.display = 'none'
  })

  modalFooter.appendChild(modalCloseButton)

  document.body.appendChild(modalBackground)

  return modalBackground
}

komple = {
  enable, disable, api
}

komple.enable()