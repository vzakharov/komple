// Komple: A chrome extension that displays an autocomplete suggestion in the currently active element, taking the suggestion from an external API.

// Extension settings

const settings = {
  apis: [{
    name: 'default',
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
  }],
  currentApiName: 'default',
}

Object.defineProperty(settings, 'api', {
  get: () => settings.apis.find(api => api.name === settings.currentApiName) || settings.apis[0]
})

let debug = what => {
  console.log(what)
  return what
}

let autocompleteTimer = null
let autocompleteInProgress = null

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

  console.log('Cancelling autocomplete')
  if ( autocompleteTimer || autocompleteInProgress ) {
    console.log('Autocomplete timer canceled'),
    clearTimeout(autocompleteTimer),
    autocompleteTimer = null,
    autocompleteInProgress = null,
    // Remove element with id 'komple-thinking'
    document.getElementById('komple-thinking')?.remove()
  }

}

const configureListener = ({ key, altKey }) => {
  if ( key === 'k' && altKey ) {

    let apiPicker = document.getElementById('komple-api-picker')
    let configModal = document.getElementById('komple-config')
    let configVisible = configModal && configModal.style.display !== 'none'

    if ( apiPicker || configVisible ) {
      apiPicker?.remove()
      console.log({ configVisible })
      if ( configVisible )
        configModal.style.display = 'none'
    } else apiPicker = createDivUnderCurrentElement({ id: 'komple-api-picker' }, div => {

      // White transparent background
      div.style.backgroundColor = 'rgba(255,255,255,0.9)'
      div.style['border-radius'] = '5px'
      div.style.padding = '5px'
      div.style['font-family'] = 'sans-serif'
      div.style['font-size'] = '0.8em'

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
          removeApiPicker()
          autocomplete()
        }
      }]

      let configDiv = document.createElement('div')
      configDiv.innerText = '[Alt+C] Configure APIs'

      // Add listener on Alt+C
      let configListener = ['keydown', ({ key, altKey }) => {
        if ( key === 'c' && altKey ) {
          console.log('Configuring')
          let configModal = document.getElementById('komple-config') || createConfigModal()
          configModal.style.display = 'block'
          removeApiPicker()
        }
      }]
      document.addEventListener(...configListener)

      div.appendChild(configDiv)

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
  document.addEventListener('keydown', configureListener)
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
  document.removeEventListener('keydown', configureListener)
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
  let { parentElement } = document.getSelection().getRangeAt(0).startContainer
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

  let thinking = document.getElementById('komple-thinking')
  
  thinking = createDivUnderCurrentElement({
    id: 'komple-thinking',
    innerHTML: '🤖🤔'
  })

  // Add another thinking emoji to the end of the thinking element every second
  let thinkingInterval = setInterval(() => {
    document.getElementById('komple-thinking') ?
      thinking.innerText += '🤔'
      : clearInterval(thinkingInterval)
  }, 1000)

  // // Get the deepest matching child.
  // let element = deepestMatchingChild(document.activeElement)
  let element = document.activeElement

  // console.log('Enclosing element:', element)

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
    
    try {
      let completion = await getSuggestion(prompt.replace(/\s+$/, ''))
    
      if ( autocompleteInProgress === id ) {
        // If prompt ends with a space, remove the leading space from the completion
        prompt.match(/\s+$/) && ( completion = completion.replace(/^\s+/, '') )
  
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
    } = settings.api

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

function saveSettings() {
  // Save to chrome storage
  chrome.storage.sync.set({ settings }, () => {
    console.log('Saved config to chrome storage:', settings)
  })
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
  modal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; border-radius: 10px; z-index: 100000; padding: 20px; font-family: sans-serif;'
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


  // Create a dropdown to select the api in settings.apis
  let endpointSelect = document.createElement('select')
  endpointSelect.id = 'komple-select-api'
  endpointSelect.style.cssText = 'width: 100%;'
  modalBody.appendChild(endpointSelect)
  
  function createOptions() {
    // Delete any existing options
    endpointSelect.innerHTML = ''

    for ( let api of settings.apis ) {
      let option = document.createElement('option')
      option.id = `komple-option-${api.name}`
      option.textContent = api.name
      option.selected = api == settings.api
      endpointSelect.appendChild(option)
    }

  }

  createOptions()


  // If the user changes the selected API, update the settings.currentApiName and rerun the createInputs function.
  endpointSelect.addEventListener('change', ({ target }) => {
    settings.currentApiName = target.options[target.selectedIndex].textContent
    createInputs()
  })

  // Add an empty span to anchor the inputs to.
  let inputsAnchor = document.createElement('span')
  modalBody.appendChild(inputsAnchor)

  function createInputs() {
    // First, delete the inputs table if it exists.
    document.getElementById('komple-inputs-table')?.remove()

    let inputsTable = document.createElement('table')
    inputsTable.id = 'komple-inputs-table'

    // Append the table to the anchor
    inputsAnchor.appendChild(inputsTable)

    let inputs = {}
    let { api } = settings
    for ( let key of [
      'name', 'endpoint', 'auth', 'censor', 'promptKey', 'otherBodyParams', 'arrayKey', 'resultKey'
    ] ) {

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
            : ['censor'].includes(key) ?
              'checkbox'
              : 'text'
      )

      let valueKey = input.type === 'checkbox' ? 'checked' : 'value'
      input[valueKey] = key === 'otherBodyParams' ? JSON.stringify(api[key], null, 2) : api[key]

      let tr = document.createElement('tr')
      inputsTable.appendChild(tr)

      let labelTd = document.createElement('td')
      labelTd.textContent = {
        name: 'Name',
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

      let notes = {
        name: 'Any name you want to use for this API.',
        arrayKey: 'Leave empty if no array returned.',
        auth: 'Include "Bearer", if applicable.',
      }

      for ( let noteKey in notes )
        if ( noteKey === key ) {
          let note = document.createElement('div')
          note.style.cssText = 'font-size: 0.8em; color: #888; margin-bottom: 5px;'
          note.textContent = notes[noteKey]
          labelTd.appendChild(note)
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

          key === 'censor' && (
            ['endpoint', 'auth'].forEach(key => {
              inputs[key].type = input.checked ? 'password' : 'text'
            })
          )
  
          if ( key === 'name' ) {
  
            // Convert to lowercase and replace any non-alphanumeric characters with a dash. Update the input.
            input.value = input.value.toLowerCase().replace(/[^a-z0-9]+/gi, '-')
  
            if ( api !== settings.api ) {
              if ( settings.apis.find(({ name }) => name === input.value) ) {
                alert('Name already taken; reverting to previous value.')
                input.value = api.name
                return
              }
            } else {
              settings.currentApiName = input.value
            }
  
            // Change the respective option in the dropdown.
            let option = document.getElementById(`komple-option-${api.name}`)
            option.textContent = input.value
            option.id = `komple-option-${input.value}`
  
          }
  
          api[key] = input[valueKey]

        }

        saveSettings()
      })

      inputs[key] = input

    }

  }

  createInputs()  

  let modalFooter = document.createElement('div')
  modalFooter.classList.add('komple-config-footer')
  modalContent.appendChild(modalFooter)

  let cloneApiButton = document.createElement('button')
  cloneApiButton.textContent = 'Clone'
  cloneApiButton.addEventListener('click', () => {

    let newApi = {
      ...JSON.parse(JSON.stringify(settings.api)),
      otherBodyParams: JSON.parse(JSON.stringify(settings.api.otherBodyParams)),
      name: `${settings.api.name}-clone`
    }

    settings.apis.push(newApi)
    settings.currentApiName = newApi.name

    createOptions()
    createInputs()
    saveSettings()

  })

  let deleteApiButton = document.createElement('button')
  deleteApiButton.textContent = 'Delete'
  deleteApiButton.addEventListener('click', () => {
    
    if ( settings.apis.length === 1 ) {
      alert('You must have at least one API.')
      return
    }

    settings.apis = settings.apis.filter(({ name }) => name !== settings.currentApiName)
    settings.currentApiName = settings.apis[settings.apis.length - 1].name

    createOptions()
    createInputs()
    saveSettings()

  })

  modalFooter.appendChild(cloneApiButton)
  modalFooter.appendChild(deleteApiButton)

  // "Press Alt+K to close"
  let closeText = document.createElement('div')
  closeText.textContent = 'Press Alt+K to close'

  modalContent.appendChild(closeText)  

  document.body.appendChild(modalBackground)

  return modalBackground
}

enable()
