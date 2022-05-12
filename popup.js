new Vue({
  el: '#app',

  data() {
    return {
      settings: {},
      vm: this,
      window,
      console
    }
  },

  mounted() {
    chrome.storage.sync.get('settings', ({ settings }) => {
      console.log('Settings:', settings)
      this.settings = settings || defaultSettings
      window.settings = this.settings
    })
    Object.assign(window, {
      chrome,
      vm: this,
    })
    setTimeout(() => {
      document.getElementById('api-list').focus()
    }, 0)
  },

  computed: {

    activeTab() {
      return this.settings.activeTab || 'api'
    },

    subTab() {
      return this.settings.subTab || 'general'
    },

    api: {
      get() {
        return this.settings?.apis?.find(api => api.name === this.settings.currentApiName)
      },
      set(api) {
        this.settings.currentApiName = api.name
      }
    },

    stringifiedApiParams: {
      get() {
        return JSON.stringify(this.api.otherBodyParams, null, 2)
      },
      set(text) {
        try {
          this.api.otherBodyParams = JSON.parse(text)
        } catch (e) {
          this.$bvToast.toast('Invalid JSON', {
            title: 'Error',
            variant: 'danger',
            solid: true
          })
        }
      }
    },

    isMac() {
      return navigator.platform.includes('Mac')
    }
  },

  watch: {

    settings: {
      handler(settings) {
        // Store in chrome.storage.sync and send to all tabs' content scripts
        chrome.storage.sync.set({ settings })
        chrome.tabs.query({}, tabs => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { settings })
          })
        })
        console.log('Settings updated:', settings)      
      },
      deep: true,
    },


  },

  methods: {

    currentApiIndex() {
      return this.settings?.apis?.indexOf(this.api)
    },

    changeApiName(name) {
      this.api.name = name
      this.settings.currentApiName = name
    },

    nudge(direction) {
      // Reorder the APIs array, moving the current API either up or down depending on the direction (1 or -1)
      let { settings: { apis }, api } = this
      let currentApiIndex = apis.indexOf(api)
      let newIndex = currentApiIndex + direction
      if ( newIndex >= 0 && newIndex < apis.length ) {
        apis.splice(currentApiIndex, 1)
        apis.splice(newIndex, 0, api)
        this.api = api
      }
    },

    addApi() {
      // Add a new API to the list
      let newApiName = 'New API'

      // If there's already an API with that name, add a number to the name until there's no conflict
      for ( let i = 2; this.settings.apis.find(api => api.name === newApiName); i++ ) {
        newApiName = `New API (${i})`
      }

      this.settings.apis = [...this.settings.apis,
        {
          ...JSON.parse(JSON.stringify(defaultApi)),
          name: newApiName
        }
      ]

      this.api = this.settings.apis[this.settings.apis.length - 1]

    },

    deleteApi() {
      // Prompt first
      if ( !confirm(`Are you sure you want to delete the API "${this.api.name}"? There is no undo!`) )
        return
      // Delete the current API
      let { settings: { apis }, api } = this
      let currentApiIndex = apis.indexOf(api)
      apis.splice(currentApiIndex, 1)
      this.api = apis[currentApiIndex - 1] || apis[0]
    },

    cloneApi() {
      // Clone the current API
      let { settings: { apis }, api } = this
      let currentApiIndex = apis.indexOf(api)
      let newApi = JSON.parse(JSON.stringify(api))
      newApi.name = `${api.name} (copy)`
      for ( let i = 2; this.settings.apis.find(api => api.name === newApi.name); i++ ) {
        newApi.name = `${api.name} (copy ${i})`
      }
      apis.splice(currentApiIndex + 1, 0, newApi)
      this.api = apis[currentApiIndex + 1]
    },

    downloadSettings() {
      // Download the settings as a JSON file
      let data = JSON.stringify(this.settings, null, 2)
      let blob = new Blob([data], { type: 'application/json' })
      let link = document.createElement('a')
      link.id = 'download-settings'
      link.href = URL.createObjectURL(blob)
      link.download = 'settings.json'
      link.click()

      // Clean up
      setTimeout(() => {
        document.getElementById('download-settings').remove()
      }, 0)

    },

    resetSettings() {
      // Prompt first
      if ( !confirm(`Are you sure you want to reset all settings? There is no undo!`) )
        return

      // Reset the settings
      this.settings = JSON.parse(JSON.stringify(defaultSettings))
      this.api = this.settings.apis[0]

    }

  }
  
})

console.log('popup.js loaded')