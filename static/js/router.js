// Minimal hash router. Screen switches happen entirely inside this one
// document — `hashchange` re-renders #content, there is no full page load
// between screens (that's the whole point: compare to the old multi-.html
// version this replaced).

const routes = [];

/** pattern like '/students/:id' — ':name' segments are captured into params. */
export function route(pattern, render) {
  const paramNames = [];
  const regex = new RegExp(
    '^' +
      pattern.replace(/:[^/]+/g, (seg) => {
        paramNames.push(seg.slice(1));
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ regex, paramNames, render });
}

function currentPath() {
  const hash = location.hash.slice(1); // drop '#'
  return hash || '/today';
}

async function dispatch() {
  const [path, queryString] = currentPath().split('?');
  const query = new URLSearchParams(queryString ?? '');

  for (const r of routes) {
    const match = r.regex.exec(path);
    if (!match) continue;
    const params = {};
    r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
    await r.render({ params, query });
    window.scrollTo(0, 0);
    return;
  }

  // No match — fall back to Today.
  navigate('/today');
}

export function navigate(path) {
  if (location.hash.slice(1) === path) dispatch();
  else location.hash = path;
}

export function startRouter() {
  window.addEventListener('hashchange', dispatch);
  dispatch();
}
