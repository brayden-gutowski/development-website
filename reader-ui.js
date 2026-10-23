export const BOOK_ASPECT = .53 / .403;
export const mobileReaderLayout = () => innerWidth <= 700 || matchMedia('(hover: none) and (pointer: coarse)').matches;
export const ease = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (10 + t * (-15 + 6 * t));
};
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Both readers expose the same page-side controls, focus rules and swipe order.
export function createPageSides(root, onChange) {
  const nav = element('nav', 'reader-page-sides');
  nav.setAttribute('aria-label', 'Book page side');
  const buttons = ['left', 'right'].map(side => {
    const button = element('button', '', side === 'left' ? '← Left page' : 'Right page →');
    button.type = 'button';
    button.setAttribute('aria-label', `${side === 'left' ? 'Left' : 'Right'} page`);
    button.addEventListener('click', () => set(side));
    nav.append(button);
    return button;
  });
  root.append(nav);
  let side = 'right';
  function refresh() {
    const mobile = mobileReaderLayout();
    root.classList.toggle('is-mobile', mobile);
    root.dataset.pageSide = side;
    nav.hidden = !mobile;
    nav.inert = root.dataset.phase !== 'reading';
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(side === (i ? 'right' : 'left'))));
    root.querySelectorAll('.diary-spread > .diary-page, .review-spread > .review-page').forEach(page => {
      page.inert = mobile && !page.classList.contains(`diary-page--${side}`);
    });
  }
  function set(value, notify = true) {
    side = value;
    refresh();
    if (notify) onChange();
  }
  refresh();
  return { set, refresh, get side() { return side; }, step(direction) {
    if (!mobileReaderLayout()) return false;
    if (direction > 0 && side === 'left') { set('right'); return true; }
    if (direction < 0 && side === 'right') { set('left'); return true; }
    return false;
  } };
}

export function trapReaderFocus(root, event) {
  if (event.key !== 'Tab') return;
  const controls = [...root.querySelectorAll('button:not(:disabled), [tabindex="0"]')]
    .filter(node => !node.closest('[inert], [hidden]') && node.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (!first) { event.preventDefault(); return; }
  if (!controls.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
