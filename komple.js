// This app intercepts a double space input and displays an autocomplete suggestion in the currently active element, taking the suggestion from an external API.

const endpoint = '...' // Replace with your own endpoint
const apiKey = '...' // Replace with your API key.

let keyCount = 0

const autocompleteListener = ({ key }) =>
  // If it's a backslash, increment the count. If it's a double backslash, autocomplete.
  key === '\\' ? (
    ++keyCount > 1 && (
      keyCount = 0,
      autocomplete()
    )
  ) :
    keyCount = 0

function enable() {

  document.addEventListener('keyup', autocompleteListener)

}

function disable() {

  document.removeEventListener('keyup', autocompleteListener)

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
    // emulate five backspace presses
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

    const promptKey = 'prompt'
    const otherBodyParams = {
      max_tokens: 50,
      temperature: 0.6,
      n: 1,
      stop: '\n'
    }
    const choicesKey = 'choices'
    const multipleChoices = true
    const resultKey = 'text'

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

    return multipleChoices ?
      json[choicesKey][0][resultKey] :
      json[resultKey]
}


komple = {
  enable, disable
}

komple.enable()