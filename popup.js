new Vue({
  el: '#app',

  data() {
    return {
      settings: null,
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

    changeApiName(name) {
      this.api.name = name
      this.settings.currentApiName = name
    }
  }
  
})

console.log('popup.js loaded')