// Komple: A chrome extension that displays an autocomplete suggestion in the currently active element, taking the suggestion from an external API.

// Completion API settings

const api = {
  endpoint: '',
  apiKey: '',
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

const autocompleteListener = ({ key }) =>
  // If it's a backslash, increment the count. If it's a double backslash, autocomplete.
  key === '\\' ? (
    ++keyCount > 1 && (
      keyCount = 0,
      autocomplete()
    )
  ) :
    keyCount = 0

const configureListener = ({ key, altKey }) => {
  if ( key === 'k' && altKey ) {
    let configModal = document.getElementById('komple-config')
    if ( configModal ) {
      let { style } = configModal
      style.display = style.display === 'none' ? 'block' : 'none'
    } else {
      configureApi()
    }
  }
}


function enable() {

  document.addEventListener('keyup', autocompleteListener)
  document.addEventListener('keydown', configureListener)

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

  if ( element.textContent.includes('\\') ) {
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

  // Get the deepest matching child.
  let element = deepestMatchingChild(document.activeElement)

  if ( element ) {

    let initialCaretPosition = element.textContent.length - 2
    simulateTextInput('...')
    
    let completion = await getSuggestion(element.textContent.replace('\\\\...', ''))
    element.textContent = element.textContent.replace('\\\\...', '')
    element.textContent += completion

    setCaretPosition(element, initialCaretPosition)

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
      endpoint, apiKey, promptKey, otherBodyParams, arrayKey, resultKey
    } = api

    // Get the suggestion from the external API.
    let json = await(
      await fetch(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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

function configureApi() {
  // Creates and displays a modal dialog to configure the completion API.
  let modalBackground = document.createElement('div')
  modalBackground.id = 'komple-config'
  modalBackground.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 9999;'

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
        ['endpoint', 'apiKey'].includes(key) ?
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
      apiKey: 'API Key',
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
      note.textContent = 'Leave empty if your endpoint does not return an array.'
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
        ['endpoint', 'apiKey'].forEach(key => {
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

}

komple = {
  enable, disable, api
}

komple.enable()