// Various lodash-like functions

// Get value by path in an object
function get(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj)
}

// Escape regex characters in a string
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}