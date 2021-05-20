;(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global =
        typeof globalThis !== 'undefined' ? globalThis : global || self),
      (global.A11yDialog = factory()))
})(this, function () {
  'use strict'

  var focusableSelectors = [
    'a[href]:not([tabindex^="-"])',
    'area[href]:not([tabindex^="-"])',
    'input:not([type="hidden"]):not([type="radio"]):not([disabled]):not([tabindex^="-"])',
    'input[type="radio"]:not([disabled]):not([tabindex^="-"]):checked',
    'select:not([disabled]):not([tabindex^="-"])',
    'textarea:not([disabled]):not([tabindex^="-"])',
    'button:not([disabled]):not([tabindex^="-"])',
    'iframe:not([tabindex^="-"])',
    'audio[controls]:not([tabindex^="-"])',
    'video[controls]:not([tabindex^="-"])',
    '[contenteditable]:not([tabindex^="-"])',
    '[tabindex]:not([tabindex^="-"])',
  ]

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i]
      }
      return arr2
    } else {
      return Array.from(arr)
    }
  }

  // Older browsers don't support event options, feature detect it.

  // Adopted and modified solution from Bohdan Didukh (2017)
  // https://stackoverflow.com/questions/41594997/ios-10-safari-prevent-scrolling-behind-a-fixed-overlay-and-maintain-scroll-posi

  var hasPassiveEvents = false
  if (typeof window !== 'undefined') {
    var passiveTestOptions = {
      get passive() {
        hasPassiveEvents = true
        return undefined
      },
    }
    window.addEventListener('testPassive', null, passiveTestOptions)
    window.removeEventListener('testPassive', null, passiveTestOptions)
  }

  var isIosDevice =
    typeof window !== 'undefined' &&
    window.navigator &&
    window.navigator.platform &&
    (/iP(ad|hone|od)/.test(window.navigator.platform) ||
      (window.navigator.platform === 'MacIntel' &&
        window.navigator.maxTouchPoints > 1))

  var locks = []
  var documentListenerAdded = false
  var initialClientY = -1
  var previousBodyOverflowSetting = void 0
  var previousBodyPaddingRight = void 0

  // returns true if `el` should be allowed to receive touchmove events.
  var allowTouchMove = function allowTouchMove(el) {
    return locks.some(function (lock) {
      if (lock.options.allowTouchMove && lock.options.allowTouchMove(el)) {
        return true
      }

      return false
    })
  }

  var preventDefault = function preventDefault(rawEvent) {
    var e = rawEvent || window.event

    // For the case whereby consumers adds a touchmove event listener to document.
    // Recall that we do document.addEventListener('touchmove', preventDefault, { passive: false })
    // in disableBodyScroll - so if we provide this opportunity to allowTouchMove, then
    // the touchmove event on document will break.
    if (allowTouchMove(e.target)) {
      return true
    }

    // Do not prevent if the event has more than one touch (usually meaning this is a multi touch gesture like pinch to zoom).
    if (e.touches.length > 1) return true

    if (e.preventDefault) e.preventDefault()

    return false
  }

  var setOverflowHidden = function setOverflowHidden(options) {
    // If previousBodyPaddingRight is already set, don't set it again.
    if (previousBodyPaddingRight === undefined) {
      var _reserveScrollBarGap =
        !!options && options.reserveScrollBarGap === true
      var scrollBarGap =
        window.innerWidth - document.documentElement.clientWidth

      if (_reserveScrollBarGap && scrollBarGap > 0) {
        previousBodyPaddingRight = document.body.style.paddingRight
        document.body.style.paddingRight = scrollBarGap + 'px'
      }
    }

    // If previousBodyOverflowSetting is already set, don't set it again.
    if (previousBodyOverflowSetting === undefined) {
      previousBodyOverflowSetting = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
  }

  var restoreOverflowSetting = function restoreOverflowSetting() {
    if (previousBodyPaddingRight !== undefined) {
      document.body.style.paddingRight = previousBodyPaddingRight

      // Restore previousBodyPaddingRight to undefined so setOverflowHidden knows it
      // can be set again.
      previousBodyPaddingRight = undefined
    }

    if (previousBodyOverflowSetting !== undefined) {
      document.body.style.overflow = previousBodyOverflowSetting

      // Restore previousBodyOverflowSetting to undefined
      // so setOverflowHidden knows it can be set again.
      previousBodyOverflowSetting = undefined
    }
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight#Problems_and_solutions
  var isTargetElementTotallyScrolled = function isTargetElementTotallyScrolled(
    targetElement
  ) {
    return targetElement
      ? targetElement.scrollHeight - targetElement.scrollTop <=
          targetElement.clientHeight
      : false
  }

  var handleScroll = function handleScroll(event, targetElement) {
    var clientY = event.targetTouches[0].clientY - initialClientY

    if (allowTouchMove(event.target)) {
      return false
    }

    if (targetElement && targetElement.scrollTop === 0 && clientY > 0) {
      // element is at the top of its scroll.
      return preventDefault(event)
    }

    if (isTargetElementTotallyScrolled(targetElement) && clientY < 0) {
      // element is at the bottom of its scroll.
      return preventDefault(event)
    }

    event.stopPropagation()
    return true
  }

  var disableBodyScroll = function disableBodyScroll(targetElement, options) {
    // targetElement must be provided
    if (!targetElement) {
      // eslint-disable-next-line no-console
      console.error(
        'disableBodyScroll unsuccessful - targetElement must be provided when calling disableBodyScroll on IOS devices.'
      )
      return
    }

    // disableBodyScroll must not have been called on this targetElement before
    if (
      locks.some(function (lock) {
        return lock.targetElement === targetElement
      })
    ) {
      return
    }

    var lock = {
      targetElement: targetElement,
      options: options || {},
    }

    locks = [].concat(_toConsumableArray(locks), [lock])

    if (isIosDevice) {
      targetElement.ontouchstart = function (event) {
        if (event.targetTouches.length === 1) {
          // detect single touch.
          initialClientY = event.targetTouches[0].clientY
        }
      }
      targetElement.ontouchmove = function (event) {
        if (event.targetTouches.length === 1) {
          // detect single touch.
          handleScroll(event, targetElement)
        }
      }

      if (!documentListenerAdded) {
        document.addEventListener(
          'touchmove',
          preventDefault,
          hasPassiveEvents ? { passive: false } : undefined
        )
        documentListenerAdded = true
      }
    } else {
      setOverflowHidden(options)
    }
  }

  var enableBodyScroll = function enableBodyScroll(targetElement) {
    if (!targetElement) {
      // eslint-disable-next-line no-console
      console.error(
        'enableBodyScroll unsuccessful - targetElement must be provided when calling enableBodyScroll on IOS devices.'
      )
      return
    }

    locks = locks.filter(function (lock) {
      return lock.targetElement !== targetElement
    })

    if (isIosDevice) {
      targetElement.ontouchstart = null
      targetElement.ontouchmove = null

      if (documentListenerAdded && locks.length === 0) {
        document.removeEventListener(
          'touchmove',
          preventDefault,
          hasPassiveEvents ? { passive: false } : undefined
        )
        documentListenerAdded = false
      }
    } else if (!locks.length) {
      restoreOverflowSetting()
    }
  }

  var TAB_KEY = 9
  var ESCAPE_KEY = 27

  /**
   * Define the constructor to instantiate a dialog
   *
   * @constructor
   * @param {Element} element
   */
  function A11yDialog(element) {
    // Prebind the functions that will be bound in addEventListener and
    // removeEventListener to avoid losing references
    this._show = this.show.bind(this)
    this._hide = this.hide.bind(this)
    this._maintainFocus = this._maintainFocus.bind(this)
    this._bindKeypress = this._bindKeypress.bind(this)

    this.$el = element
    this.shown = false
    this._id = this.$el.getAttribute('data-a11y-dialog') || this.$el.id
    this._previouslyFocused = null
    this._listeners = {}

    // Initialise everything needed for the dialog to work properly
    this.create()
  }

  /**
   * Set up everything necessary for the dialog to be functioning
   *
   * @param {(NodeList | Element | string)} targets
   * @return {this}
   */
  A11yDialog.prototype.create = function () {
    this.$el.setAttribute('aria-hidden', true)
    this.$el.setAttribute('aria-modal', true)

    if (!this.$el.hasAttribute('role')) {
      this.$el.setAttribute('role', 'dialog')
    }

    // Keep a collection of dialog openers, each of which will be bound a click
    // event listener to open the dialog
    this._openers = $$('[data-a11y-dialog-show="' + this._id + '"]')
    this._openers.forEach(
      function (opener) {
        opener.addEventListener('click', this._show)
      }.bind(this)
    )

    // Keep a collection of dialog closers, each of which will be bound a click
    // event listener to close the dialog
    this._closers = $$('[data-a11y-dialog-hide]', this.$el).concat(
      $$('[data-a11y-dialog-hide="' + this._id + '"]')
    )
    this._closers.forEach(
      function (closer) {
        closer.addEventListener('click', this._hide)
      }.bind(this)
    )

    // Execute all callbacks registered for the `create` event
    this._fire('create')

    return this
  }

  /**
   * Show the dialog element, disable all the targets (siblings), trap the
   * current focus within it, listen for some specific key presses and fire all
   * registered callbacks for `show` event
   *
   * @param {Event} event
   * @return {this}
   */
  A11yDialog.prototype.show = function (event) {
    // If the dialog is already open, abort
    if (this.shown) {
      return this
    }

    // Keep a reference to the currently focused element to be able to restore
    // it later
    this._previouslyFocused = document.activeElement
    this.$el.removeAttribute('aria-hidden')
    this.shown = true

    if (this.$el.querySelector('[role="document"]')) {
      disableBodyScroll(this.$el.querySelector('[role="document"]'))
    }

    // Set the focus to the first focusable child of the dialog element
    setFocusToFirstItem(this.$el)

    // Bind a focus event listener to the body element to make sure the focus
    // stays trapped inside the dialog while open, and start listening for some
    // specific key presses (TAB and ESC)
    document.body.addEventListener('focus', this._maintainFocus, true)
    document.addEventListener('keydown', this._bindKeypress)

    // Execute all callbacks registered for the `show` event
    this._fire('show', event)

    return this
  }

  /**
   * Hide the dialog element, enable all the targets (siblings), restore the
   * focus to the previously active element, stop listening for some specific
   * key presses and fire all registered callbacks for `hide` event
   *
   * @param {Event} event
   * @return {this}
   */
  A11yDialog.prototype.hide = function (event) {
    // If the dialog is already closed, abort
    if (!this.shown) {
      return this
    }

    this.shown = false
    this.$el.setAttribute('aria-hidden', 'true')

    if (this.$el.querySelector('[role="document"]')) {
      enableBodyScroll(this.$el.querySelector('[role="document"]'))
    }

    // If there was a focused element before the dialog was opened (and it has a
    // `focus` method), restore the focus back to it
    // See: https://github.com/KittyGiraudel/a11y-dialog/issues/108
    if (this._previouslyFocused && this._previouslyFocused.focus) {
      this._previouslyFocused.focus()
    }

    // Remove the focus event listener to the body element and stop listening
    // for specific key presses
    document.body.removeEventListener('focus', this._maintainFocus, true)
    document.removeEventListener('keydown', this._bindKeypress)

    // Execute all callbacks registered for the `hide` event
    this._fire('hide', event)

    return this
  }

  /**
   * Destroy the current instance (after making sure the dialog has been hidden)
   * and remove all associated listeners from dialog openers and closers
   *
   * @return {this}
   */
  A11yDialog.prototype.destroy = function () {
    // Hide the dialog to avoid destroying an open instance
    this.hide()

    // Remove the click event listener from all dialog openers
    this._openers.forEach(
      function (opener) {
        opener.removeEventListener('click', this._show)
      }.bind(this)
    )

    // Remove the click event listener from all dialog closers
    this._closers.forEach(
      function (closer) {
        closer.removeEventListener('click', this._hide)
      }.bind(this)
    )

    // Execute all callbacks registered for the `destroy` event
    this._fire('destroy')

    // Keep an object of listener types mapped to callback functions
    this._listeners = {}

    return this
  }

  /**
   * Register a new callback for the given event type
   *
   * @param {string} type
   * @param {Function} handler
   */
  A11yDialog.prototype.on = function (type, handler) {
    if (typeof this._listeners[type] === 'undefined') {
      this._listeners[type] = []
    }

    this._listeners[type].push(handler)

    return this
  }

  /**
   * Unregister an existing callback for the given event type
   *
   * @param {string} type
   * @param {Function} handler
   */
  A11yDialog.prototype.off = function (type, handler) {
    var index = (this._listeners[type] || []).indexOf(handler)

    if (index > -1) {
      this._listeners[type].splice(index, 1)
    }

    return this
  }

  /**
   * Iterate over all registered handlers for given type and call them all with
   * the dialog element as first argument, event as second argument (if any).
   *
   * @access private
   * @param {string} type
   * @param {Event} event
   */
  A11yDialog.prototype._fire = function (type, event) {
    var listeners = this._listeners[type] || []

    listeners.forEach(
      function (listener) {
        listener(this.$el, event)
      }.bind(this)
    )
  }

  /**
   * Private event handler used when listening to some specific key presses
   * (namely ESCAPE and TAB)
   *
   * @access private
   * @param {Event} event
   */
  A11yDialog.prototype._bindKeypress = function (event) {
    // This is an escape hatch in case there are nested dialogs, so the keypresses
    // are only reacted to for the most recent one
    if (!this.$el.contains(document.activeElement)) return

    // If the dialog is shown and the ESCAPE key is being pressed, prevent any
    // further effects from the ESCAPE key and hide the dialog, unless its role
    // is 'alertdialog', which should be modal
    if (
      this.shown &&
      event.which === ESCAPE_KEY &&
      this.$el.getAttribute('role') !== 'alertdialog'
    ) {
      event.preventDefault()
      this.hide(event)
    }

    // If the dialog is shown and the TAB key is being pressed, make sure the
    // focus stays trapped within the dialog element
    if (this.shown && event.which === TAB_KEY) {
      trapTabKey(this.$el, event)
    }
  }

  /**
   * Private event handler used when making sure the focus stays within the
   * currently open dialog
   *
   * @access private
   * @param {Event} event
   */
  A11yDialog.prototype._maintainFocus = function (event) {
    // If the dialog is shown and the focus is not within a dialog element (either
    // this one or another one in case of nested dialogs) or within an element
    // with the `data-a11y-dialog-focus-trap-ignore` attribute, move it back to
    // its first focusable child.
    // See: https://github.com/KittyGiraudel/a11y-dialog/issues/177
    if (
      this.shown &&
      !event.target.closest('[aria-modal="true"]') &&
      !event.target.closest('[data-a11y-dialog-ignore-focus-trap]')
    ) {
      setFocusToFirstItem(this.$el)
    }
  }

  /**
   * Convert a NodeList into an array
   *
   * @param {NodeList} collection
   * @return {Array<Element>}
   */
  function toArray(collection) {
    return Array.prototype.slice.call(collection)
  }

  /**
   * Query the DOM for nodes matching the given selector, scoped to context (or
   * the whole document)
   *
   * @param {String} selector
   * @param {Element} [context = document]
   * @return {Array<Element>}
   */
  function $$(selector, context) {
    return toArray((context || document).querySelectorAll(selector))
  }

  /**
   * Set the focus to the first element with `autofocus` or the first focusable
   * child of the given element
   *
   * @param {Element} node
   */
  function setFocusToFirstItem(node) {
    var focusableChildren = getFocusableChildren(node)
    var focused = node.querySelector('[autofocus]') || focusableChildren[0]

    if (focused) {
      focused.focus()
    }
  }

  /**
   * Get the focusable children of the given element
   *
   * @param {Element} node
   * @return {Array<Element>}
   */
  function getFocusableChildren(node) {
    return $$(focusableSelectors.join(','), node).filter(function (child) {
      return !!(
        child.offsetWidth ||
        child.offsetHeight ||
        child.getClientRects().length
      )
    })
  }

  /**
   * Trap the focus inside the given element
   *
   * @param {Element} node
   * @param {Event} event
   */
  function trapTabKey(node, event) {
    var focusableChildren = getFocusableChildren(node)
    var focusedItemIndex = focusableChildren.indexOf(document.activeElement)

    // If the SHIFT key is being pressed while tabbing (moving backwards) and
    // the currently focused item is the first one, move the focus to the last
    // focusable item from the dialog element
    if (event.shiftKey && focusedItemIndex === 0) {
      focusableChildren[focusableChildren.length - 1].focus()
      event.preventDefault()
      // If the SHIFT key is not being pressed (moving forwards) and the currently
      // focused item is the last one, move the focus to the first focusable item
      // from the dialog element
    } else if (
      !event.shiftKey &&
      focusedItemIndex === focusableChildren.length - 1
    ) {
      focusableChildren[0].focus()
      event.preventDefault()
    }
  }

  function instantiateDialogs() {
    $$('[data-a11y-dialog]').forEach(function (node) {
      new A11yDialog(node)
    })
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', instantiateDialogs)
    } else {
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(instantiateDialogs)
      } else {
        window.setTimeout(instantiateDialogs, 16)
      }
    }
  }

  return A11yDialog
})
