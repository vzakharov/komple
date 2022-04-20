// Extension settings

const settings = {
  apis: [{
    name: 'default',
    endpoint: 'https://...',
    auth: 'Bearer ...',
    censor: false,
    promptKey: 'prompt',
    suffixKey: 'suffix',
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