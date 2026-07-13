// 自定义：产品页加购-底部固定栏（Product sticky add-to-cart bar）
class ProductStickyBar extends HTMLElement {
  connectedCallback() {
    this.formId = this.getAttribute("form")
    this.form = document.getElementById(this.formId)
    this.buyButtonsBlock = document.querySelector('.product-info__block-item[data-block-type="buy-buttons"]')
    this.footer = document.querySelector(".footer")
    this.desktopMediaQuery = window.matchMedia("(min-width: 700px)")

    this._buyButtonsVisible = false
    this._buyButtonsPassed = false
    this._buyButtonsNotReached = true
    this._footerReached = false
    this._ticking = false

    // 通过事件委托绑定 Buy now，使变体切换触发 product-rerender 替换内部内容后仍然有效
    this._onClickHandler = this._onClick.bind(this)
    this.addEventListener("click", this._onClickHandler)

    this._observer = new IntersectionObserver(this._onObserved.bind(this))
    if (this.buyButtonsBlock) this._observer.observe(this.buyButtonsBlock)
    if (this.footer) this._observer.observe(this.footer)

    this._onScrollHandler = this._onScroll.bind(this)
    window.addEventListener("scroll", this._onScrollHandler, { passive: true })

    this._onMediaChange = this._updateVisibility.bind(this)
    this.desktopMediaQuery.addEventListener("change", this._onMediaChange)

    this._updateVisibility()
  }

  disconnectedCallback() {
    if (this._observer) this._observer.disconnect()
    window.removeEventListener("scroll", this._onScrollHandler)
    this.desktopMediaQuery.removeEventListener("change", this._onMediaChange)
    this.removeEventListener("click", this._onClickHandler)
  }

  _onObserved(entries) {
    entries.forEach((entry) => {
      if (entry.target === this.buyButtonsBlock) {
        const rect = entry.boundingClientRect
        this._buyButtonsVisible = entry.isIntersecting
        this._buyButtonsPassed = rect.bottom < 0
        this._buyButtonsNotReached = rect.top > window.innerHeight
      }
      if (entry.target === this.footer) {
        this._footerReached = entry.isIntersecting
      }
    })
    this._updateVisibility()
  }

  _onScroll() {
    if (this._ticking) return
    this._ticking = true
    window.requestAnimationFrame(() => {
      this._updateVisibility()
      this._ticking = false
    })
  }

  _updateVisibility() {
    let visible
    if (this.desktopMediaQuery.matches) {
      // PC 端：始终固定在底部，不会消失
      visible = true
    } else {
      // H5 端：首屏即展示；当页面内的 buy_buttons 块进入视口时隐藏，滚动经过后再展示（直到 footer）
      const beforeBuyButtons = this._buyButtonsNotReached && !this._buyButtonsVisible
      const afterBuyButtons = this._buyButtonsPassed && !this._footerReached
      visible = beforeBuyButtons || afterBuyButtons
    }
    this.classList.toggle("is-visible", visible)
  }

  _onClick(event) {
    const trigger = event.target.closest("[data-sticky-buy-now]")
    if (!trigger || !this.contains(trigger)) return
    event.preventDefault()
    this._buyNow(trigger)
  }

  _buyNow(trigger) {
    const variantId = this._getVariantId()
    if (!variantId) return
    const quantity = this._getQuantity()
    const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/"
    trigger.setAttribute("aria-busy", "true")
    // 购物车永久链接：加入该变体并直接前往结账页
    window.location.href = root + "cart/" + variantId + ":" + quantity
  }

  _getVariantId() {
    const input = this.form && this.form.querySelector('[name="id"]')
    return input ? input.value : null
  }

  _getQuantity() {
    const input =
      document.querySelector('[name="quantity"][form="' + this.formId + '"]') ||
      (this.form && this.form.querySelector('[name="quantity"]'))
    let quantity = parseInt(input && input.value, 10)
    if (!quantity || quantity < 1) quantity = 1
    return quantity
  }
}

if (!window.customElements.get("product-sticky-bar")) {
  customElements.define("product-sticky-bar", ProductStickyBar)
}

// 自定义：折扣码（Discount code）。点击 Copy Code 复制优惠码；点击其它区域勾选/取消勾选，
// 通过在 <body> 上切换 `discount-applied` 类来联动 price_second、底部固定栏、主图优惠角标。
// 状态放在 body 上，使其在变体切换触发 product-rerender（局部重渲染）后依然保留。
class DiscountToggle extends HTMLElement {
  static APPLIED_CLASS = "discount-applied"

  connectedCallback() {
    this.checkbox = this.querySelector("[data-discount-checkbox]")
    this.copyButton = this.querySelector("[data-discount-copy]")
    this.copyLabel = this.querySelector("[data-discount-copy-label]")

    this._onClickHandler = this._onClick.bind(this)
    this.addEventListener("click", this._onClickHandler)

    // 仅在整页首次加载时应用「默认勾选」，避免变体切换触发的 product-rerender 把用户手动取消的状态又强制勾回
    this._applyDefaultIfNeeded()

    // 重渲染后根据 body 上的持久状态恢复勾选框（此处不触发动画，因为元素是以最终态直接渲染的）
    this._syncCheckbox()
  }

  _applyDefaultIfNeeded() {
    if (document.body.hasAttribute("data-discount-initialized")) return
    document.body.setAttribute("data-discount-initialized", "")
    if (this.hasAttribute("default-checked")) {
      document.body.classList.add(DiscountToggle.APPLIED_CLASS)
    }
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._onClickHandler)
    if (this._copyTimer) clearTimeout(this._copyTimer)
  }

  get _applied() {
    return document.body.classList.contains(DiscountToggle.APPLIED_CLASS)
  }

  _syncCheckbox() {
    if (this.checkbox) this.checkbox.checked = this._applied
  }

  _onClick(event) {
    if (this.copyButton && this.copyButton.contains(event.target)) {
      event.preventDefault()
      this._copy()
      return
    }
    this._toggle()
  }

  _toggle() {
    const applied = document.body.classList.toggle(DiscountToggle.APPLIED_CLASS)
    if (this.checkbox) this.checkbox.checked = applied
  }

  _copy() {
    const code = this.copyButton.getAttribute("data-code") || ""
    const restore = () => {
      if (!this.copyLabel) return
      this.copyLabel.textContent = this.copyButton.getAttribute("data-copy-label") || "Copy Code"
    }
    const showCopied = () => {
      if (this.copyLabel) {
        this.copyLabel.textContent = this.copyButton.getAttribute("data-copied-label") || "Copied"
      }
      if (this._copyTimer) clearTimeout(this._copyTimer)
      this._copyTimer = setTimeout(restore, 3000)
    }

    // 回退方案：临时 textarea + execCommand。主题编辑器把店铺装进跨域 iframe，
    // navigator.clipboard 常被拦截而 reject，因此 reject 时必须再走 execCommand，而非直接放弃。
    const fallbackCopy = () => {
      const textarea = document.createElement("textarea")
      textarea.value = code
      textarea.setAttribute("readonly", "")
      textarea.style.position = "fixed"
      textarea.style.top = "0"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      textarea.setSelectionRange(0, code.length)
      try {
        document.execCommand("copy")
      } catch (e) {}
      document.body.removeChild(textarea)
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(showCopied, () => {
        fallbackCopy()
        showCopied()
      })
    } else {
      fallbackCopy()
      showCopied()
    }
  }
}

if (!window.customElements.get("discount-toggle")) {
  customElements.define("discount-toggle", DiscountToggle)
}