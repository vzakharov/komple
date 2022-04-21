// Various lodash-like functions

function get(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj)
}