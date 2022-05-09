// Various lodash-like functions

// Get value by path in an object
function get(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj)
}

// Set value by path in an object
function set(obj, path, value) {
  const parts = path.split('.')
  const last = parts.pop()
  const parent = parts.reduce((acc, part) => acc && acc[part], obj)
  parent[last] = value
}

// Escape regex characters in a string
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}