// Extension settings

const defaultApi = {
  name: 'Default API',                // Arbitrary name for the API
  // endpoint: 'https://...',        // The endpoint to use for autocompletion
  // auth: 'Bearer ...',             // The authorization token to use for the API. Don't forget to add the Bearer prefix!
  // censor: false,                  // Whether to hide the above fields in the configuration modal
  // promptKey: 'prompt',            // The key to use for the prompt in the API request body
  // suffixKey: 'suffix',            // The key to use for the suffix. Leave empty if the model doesn't support it.
  // otherBodyParams: {              // Other parameters to add to the request body (number of tokens, temperature, etc.)
  //   max_tokens: 50,
  //   temperature: 0.6,
  //   stop: '\n'
  // },
  // arrayKey: 'choices',            // Where is the array of suggestions in the response? Empty if no array is returned.
  // resultKey: 'text'               // Where is the result text in the response?
  empty: true,                       // Whether the API is empty. If true, templates will be suggested.
}

const settings = {

  // APIs: the endpoints you will use to get autocompletion suggestions. You can use as many by adding more objects to the array.
  // You will be also able to modify the settings via a configuration modal.
  apis: [ defaultApi ],

  currentApiName: 'Default API',          // The name of the current API to use

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

  activeTab: 'api',                   // The tab to show when opening the extension popup
  subTab: 'general',                  // The subtab to show when opening the extension popup (where applicable)
  removeNewlines: false,              // If true, newlines will be removed from the result text
}

const defaultSettings = JSON.parse(JSON.stringify(settings))

const apiTemplates = [
  { name: 'GPT-3', settings: {
    endpoint: "https://api.openai.com/v1/engines/text-davinci-002/completions",
    promptKey: "prompt",
    arrayKey: "choices",
    resultKey: "text",
    suffixKey: "suffix",
    otherBodyParams: {
      frequency_penalty: 1,
      max_tokens: 50,
      n: 1,
      presence_penalty: 1,
      temperature: 0.6
    },
  } },
  { name: 'AI21', settings: {
    endpoint: "https://api.ai21.com/studio/v1/j1-jumbo/complete",
    promptKey: "prompt",
    resultKey: "data.text",
    otherBodyParams: {
      maxTokens: 50,
      numResults: 1,
      temperature: 0.6
    }
  } },
  { name: 'Cohere', settings: {
    endpoint: "https://api.cohere.ai/large/generate",
    promptKey: "prompt",
    arrayKey: "generations",
    resultKey: "text",
    otherBodyParams: {
      max_tokens: 50,
      temperature: 0.6
    }
  } },
  { name: 'Custom', settings: {
  } } 
]

// Getter for the current API -- do not modify
Object.defineProperty(settings, 'api', {
  get: () => settings.apis.find(api => api.name === settings.currentApiName) || settings.apis[0]
})