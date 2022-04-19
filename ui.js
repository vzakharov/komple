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
      'name', 'endpoint', 'auth', 'censor', 'promptKey', 'suffixKey', 'otherBodyParams', 'arrayKey', 'resultKey'
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
        suffixKey: 'Suffix key',
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
        suffixKey: 'Leave empty if not supported.',
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


  let buttonDiv = document.createElement('div')
  buttonDiv.classList.add('komple-config-buttons')
  // Align right with margins and paddings as needed
  buttonDiv.style.cssText = 'display: flex; justify-content: flex-end; margin-top: 10px; margin-bottom: 10px;' 

  let buttonActions = ({
    Clone() {
      
      let newApi = {
        ...JSON.parse(JSON.stringify(settings.api)),
        otherBodyParams: JSON.parse(JSON.stringify(settings.api.otherBodyParams)),
        name: `${settings.api.name}-clone`
      }

      settings.apis.push(newApi)
      settings.currentApiName = newApi.name

    },
    Delete() {
        
      if ( settings.apis.length === 1 ) {
        alert('You must have at least one API.')
        return
      }

      settings.apis = settings.apis.filter(({ name }) => name !== settings.currentApiName)
      settings.currentApiName = settings.apis[settings.apis.length - 1].name

    },
    Nudge() {
      // Move up
      let index = settings.apis.findIndex(({ name }) => name === settings.currentApiName)
      if ( index === 0 ) return
      let previousIndex = index - 1
      let previousApi = settings.apis[previousIndex]
      settings.apis[previousIndex] = settings.apis[index]
      settings.apis[index] = previousApi

    }
  })

  for ( let caption in buttonActions ) {
    let action = buttonActions[caption]
    let button = document.createElement('button')
    button.textContent = caption
    button.id = `komple-config-button-${caption.toLowerCase()}`
    button.addEventListener('click', () => {
      action()
      createOptions()
      createInputs()
      saveSettings()
    })
    // A-la bootstrap outline secondary
    button.style.cssText = 'border: 1px solid #ccc; border-radius: 4px; padding: 5px 10px; margin-right: 5px;'
    // highlight on hover
    button.onmouseover = () => button.style.backgroundColor = '#eee'
    button.onmouseout = () => button.style.backgroundColor = '#fff'
    buttonDiv.appendChild(button)
  }

  modalFooter.appendChild(buttonDiv)

  document.body.appendChild(modalBackground)

  return modalBackground
}