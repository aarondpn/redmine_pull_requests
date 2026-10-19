// Compact list for issues with several pull requests: one row per pull
// request, expandable to the full card. The view (compact or expanded) is
// remembered in the browser, expanded rows survive panel updates.
(function () {
  var STORAGE_KEY = 'redmine_pull_requests.view';
  // controls that keep their focus when the panel is replaced after an update
  var FOCUS_CONTROLS = ['pr-action--refresh', 'pr-action--unlink', 'pr-toggle', 'pr-title', 'pr-repo', 'pr-checks'];
  var expandedRows = {};
  var lastControl = null;

  function storedView() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function storeView(view) {
    try { window.localStorage.setItem(STORAGE_KEY, view); } catch (e) { /* private mode */ }
  }

  function setRowExpanded(row, expanded) {
    var toggle = row.querySelector('.pr-toggle');
    row.classList.toggle('is-expanded', expanded);
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', toggle.getAttribute(expanded ? 'data-label-hide' : 'data-label-show'));
      toggle.title = toggle.getAttribute('aria-label');
    }
    if (expanded) { expandedRows[row.id] = true; } else { delete expandedRows[row.id]; }
  }

  function apply(panel, view) {
    var list = panel.querySelector('.pr-list');
    var button = panel.querySelector('[data-pr-view-toggle]');
    var compact = view === 'compact';
    if (!list) return;

    list.classList.toggle('pr-list--compact', compact);
    list.querySelectorAll('.pr').forEach(function (row) {
      setRowExpanded(row, compact && !!expandedRows[row.id]);
    });
    if (button) {
      button.hidden = false;
      // the label names the action, so this is no toggle button with aria-pressed
      button.querySelector('span').textContent = button.getAttribute(compact ? 'data-label-expanded' : 'data-label-compact');
      button.classList.toggle('is-expanded', !compact);
    }
  }

  function currentView(panel) {
    var list = panel.querySelector('.pr-list');
    if (!list || list.children.length < 2) return 'expanded';
    return storedView() || 'compact';
  }

  function isVisible(element) {
    return !!element && element.getClientRects().length > 0;
  }

  function rowFocusTarget(row) {
    return row && [row.querySelector('.pr-toggle'), row.querySelector('.pr-title')].filter(isVisible)[0];
  }

  // Remembers which control of the panel was used, the panel is replaced
  // once the request is done
  function rememberControl(control) {
    var row = control.closest('.pr');
    lastControl = {
      rowId: row && row.id,
      nextRowId: row && row.nextElementSibling && row.nextElementSibling.id,
      previousRowId: row && row.previousElementSibling && row.previousElementSibling.id,
      className: FOCUS_CONTROLS.filter(function (name) { return control.classList.contains(name); })[0]
    };
  }

  function restoreFocus() {
    var panel = document.getElementById('pull-requests');
    var control = lastControl;
    var active = document.activeElement;
    lastControl = null;
    // nothing to do if the focus has moved on to another part of the page
    if (!panel || !control || (active && active !== document.body && !panel.contains(active))) return;

    var candidates = [];
    if (control.rowId) {
      var row = document.getElementById(control.rowId);
      if (row) {
        // e.g. refreshed: the same button of the same row
        if (control.className) candidates.push(row.querySelector('.' + control.className));
        candidates.push(rowFocusTarget(row));
      } else {
        // unlinked: the next or previous pull request
        candidates.push(rowFocusTarget(document.getElementById(control.nextRowId)));
        candidates.push(rowFocusTarget(document.getElementById(control.previousRowId)));
      }
    }
    // e.g. linked: the link that opened the form
    candidates.push(panel.querySelector('[data-pr-link-toggle]'));
    var target = candidates.filter(isVisible)[0];
    if (!target) {
      target = panel.querySelector('.pr-heading');
      target.setAttribute('tabindex', '-1');
    }
    target.focus();
  }

  // Capturing, rails-ujs stops the propagation of clicks on remote links
  document.addEventListener('click', function (event) {
    var control = event.target.closest('#pull-requests a, #pull-requests button, #pull-requests input');
    if (control) rememberControl(control);
  }, true);

  document.addEventListener('submit', function (event) {
    if (event.target.closest('#pull-requests')) rememberControl(event.target);
  }, true);

  document.addEventListener('click', function (event) {
    // The link form is shown and hidden by inline handlers (like Redmine's
    // toggle_link), this keeps aria-expanded and the focus in sync
    var linkToggle = event.target.closest('[data-pr-link-toggle]');
    var cancel = event.target.closest('[data-pr-link-cancel]');
    if (linkToggle || cancel) {
      var header = event.target.closest('.pull-requests').querySelector('[data-pr-link-toggle]');
      var form = document.getElementById('new-pull-request-form');
      header.setAttribute('aria-expanded', String(isVisible(form)));
      if (cancel) header.focus();
      return;
    }

    var viewToggle = event.target.closest('[data-pr-view-toggle]');
    if (viewToggle) {
      var panel = viewToggle.closest('.pull-requests');
      var view = panel.querySelector('.pr-list--compact') ? 'expanded' : 'compact';
      storeView(view);
      expandedRows = {};
      apply(panel, view);
      return;
    }

    // In the compact list a click on the row (outside links and buttons) toggles it
    var row = event.target.closest('.pr-list--compact .pr');
    if (!row) return;
    if (!event.target.closest('.pr-toggle') &&
        (event.target.closest('a, button, input, .pr-card__body') || String(window.getSelection()))) return;
    setRowExpanded(row, !row.classList.contains('is-expanded'));
  });

  window.RedminePullRequests = {
    init: function (panel) {
      if (panel) apply(panel, currentView(panel));
    },
    restoreFocus: restoreFocus
  };
})();
