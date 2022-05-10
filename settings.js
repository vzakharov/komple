// Extension settings

const defaultApi = {
  name: 'default',                // Arbitrary name for the API
  endpoint: 'https://...',        // The endpoint to use for autocompletion
  auth: 'Bearer ...',             // The authorization token to use for the API. Don't forget to add the Bearer prefix!
  censor: false,                  // Whether to hide the above fields in the configuration modal
  promptKey: 'prompt',            // The key to use for the prompt in the API request body
  suffixKey: 'suffix',            // The key to use for the suffix. Leave empty if the model doesn't support it.
  otherBodyParams: {              // Other parameters to add to the request body (number of tokens, temperature, etc.)
    max_tokens: 50,
    temperature: 0.6,
    stop: '\n'
  },
  arrayKey: 'choices',            // Where is the array of suggestions in the response? Empty if no array is returned.
  resultKey: 'text'               // Where is the result text in the response?
}

const settings = {

  // APIs: the endpoints you will use to get autocompletion suggestions. You can use as many by adding more objects to the array.
  // You will be also able to modify the settings via a configuration modal.
  apis: [ defaultApi ],

  currentApiName: 'default',          // The name of the current API to use

  hotkeys: {                          // Hotkeys to use for the extension

    autocomplete: {                   // Hotkey to manually trigger autocompletion
      key: ' ',
      modifier: 'Control'
    },
    
    apiPicker: {                      // Hotkey that shows a small div with all the APIs to choose from (via hotkeys)
      key: 'k',
      modifier: 'Alt'
    }

  },

  activateOnHangingChar: false,       // If true, autocomplete will be triggered whenever there's a hanging space after a word,
                                      // after waiting for 0.5 seconds. Note that this can result in higher spend of API tokens:  
                                      // Even if you cancel the autocomplete after the timer lapses, the API will still be called.

  activeTab: 'api'                    // The tab to show when opening the extension popup
}

const defaultSettings = JSON.parse(JSON.stringify(settings))

// Getter for the current API -- do not modify
Object.defineProperty(settings, 'api', {
  get: () => settings.apis.find(api => api.name === settings.currentApiName) || settings.apis[0]
})

