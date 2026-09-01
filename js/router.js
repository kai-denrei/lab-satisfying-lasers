/**
 * Hash router. Two views, one page. Each view owns its own WebGL context and
 * only renders while it is the active one — two beams running at full tilt on
 * a 16GB machine is not a good trade.
 */
const VIEWS = ['lab', 'techniques'];
const listeners = new Set();

export function currentView(){
  const v = (location.hash.replace(/^#\/?/, '') || 'lab').split('?')[0];
  return VIEWS.includes(v) ? v : 'lab';
}

export function onViewChange(fn){
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function broadcast(){
  const v = currentView();
  document.body.dataset.view = v;
  for (const el of document.querySelectorAll('[data-tab]')){
    el.setAttribute('aria-current', el.dataset.tab === v ? 'page' : 'false');
  }
  for (const fn of listeners) fn(v);
}

addEventListener('hashchange', broadcast);
addEventListener('DOMContentLoaded', broadcast);
broadcast();
