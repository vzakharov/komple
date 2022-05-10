new Vue({
  el: '#app',

  data() {
    return {
      settings: null,
      vm: this
    }
  },

  mounted() {
    chrome.storage.sync.get('settings', data => {
      console.log(data)
      this.settings = data.settings
      window.settings = this.settings
      window.chrome = chrome
    })
    window.vm = this
  },

  computed: {

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
    }

  }
  
})

console.log('popup.js loaded')