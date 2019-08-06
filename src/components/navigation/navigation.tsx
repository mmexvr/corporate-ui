import {
  Component, Prop, State, Element, Watch, Listen, Event,
  EventEmitter, // eslint-disable-line no-unused-vars
} from '@stencil/core';

import { actions } from '../../store';

@Component({
  tag: 'c-navigation',
  styleUrl: 'navigation.scss',
  shadow: true,
})
export class Navigation {
  @Prop({ context: 'store' }) ContextStore: any;

  /** Per default, this will inherit the value from c-theme name property */
  @Prop({ mutable: true }) theme: string;

  /** Set the orientation for the navigation (vertical or horisontal). The default is horisontal navigation. */
  @Prop() orientation = '';

  /** Item links on the left side of the navigation */
  @Prop({ mutable: true }) primaryItems: any;

  /** Item links on the right side of the navigation. On vertical orientation, it will be added in order after primary-items. */
  @Prop({ mutable: true }) secondaryItems: any;

  /** Used to show a text in front of generated items on desktop and add a describing text for navigating back in mobile mode for sub navigation */
  @Prop() caption: string;

  /** Used to dynamically connect current node to a parent item in mobile mode interaction */
  @Prop() target: string;

  @State() store: any;

  @State() navigationOpen: boolean;

  @State() navigationExpanded: string;

  @State() isSub: boolean;

  @State() ddToggle = false;

  @State() tagName: string;

  @State() currentTheme: object;

  @State() parentEl: any;

  @State() navWidth: any;

  @State() scrollPos = 0;

  @Element() el: HTMLElement;

  @Event() onDdToggle: EventEmitter;

  @Watch('primaryItems')
  setPrimaryItems(items) {
    this.primaryItems = this.parse(items);
  }

  @Watch('secondaryItems')
  setSecondaryItems(items) {
    this.secondaryItems = this.parse(items);
  }

  @Watch('theme')
  setTheme(name = undefined) {
    this.theme = name || this.store.getState().theme.name;
    this.currentTheme = this.store.getState().themes[this.theme];
  }

  @Listen('window:scroll')
  handleScroll() {
    let isStick = false;
    // try catch is used to avoid error in IE with getBoundingClientRect
    try {
      isStick = this.el.getBoundingClientRect().top <= 0;
    } catch (e) { console.log(e); }

    if (!this.isSub) {
      isStick ? this.el.setAttribute('stuck', 'true') : this.el.removeAttribute('stuck');
    }

    if (!document.head.attachShadow) {
      if (this.el != null) {
        if ((window.pageYOffset || document.documentElement.scrollTop) <= this.scrollPos) this.el.removeAttribute('stuck');
      }
    }
  }

  @Listen('window:click')
  outsideClick(e) {
    if (!e.path[0].matches('.dropdown-toggle')) {
      if (this.ddToggle === true) this.ddToggle = false;
    }
  }

  @Listen('window:resize')
  initMoreDropdown(e) {
    const navbar = (this.el.shadowRoot || this.el).querySelector('.navbar');
    const secondary = (this.el.shadowRoot || this.el).querySelector('.navbar-collapse:nth-child(2)');
    const dropdown = (this.el.shadowRoot || this.el).querySelector('.dropdown .dropdown-menu');
    const primaryItems = this.el.querySelectorAll('[slot=primary-items]');
    const moreItem = (this.el.shadowRoot || this.el).querySelector('.dropdown');
    let totalItemWidth = 0;
    let lastItem;
    let firstItem;

    const availableSpace = navbar.clientWidth - moreItem.clientWidth - (secondary ? secondary.clientWidth : 0);

    primaryItems.forEach((item) => {
      totalItemWidth += item.clientWidth;
      const nextSibling = item.nextElementSibling.getAttribute('slot');
      if (item.parentElement.getAttribute('slot') !== 'sub') {
        if (nextSibling === 'sub' || nextSibling === 'secondary-items') {
          lastItem = item;
        }
      }
    });

    if (e.type === 'resize' && document.body.clientWidth < 992) {
      const hiddenItems = dropdown.querySelectorAll('a');

      hiddenItems.forEach(item => {
        item.classList.remove('dropdown-item');
        lastItem.parentNode.insertBefore(item, lastItem.nextSibling);
      });
    } else if (totalItemWidth > availableSpace && this.el.getAttribute('slot') !== 'sub') {
      if (lastItem) {
        lastItem.setAttribute('data-width', `${lastItem.clientWidth}`);
        lastItem.classList.add('dropdown-item');
      }
      dropdown.prepend(lastItem);
      this.initMoreDropdown(e);
    } else if (e.type === 'resize') {
      firstItem = (this.el.shadowRoot || this.el).querySelector('.dropdown .dropdown-menu a:first-child');
      if (firstItem) {
        const firstWidth = parseInt(firstItem.getAttribute('data-width'), 10);
        if (totalItemWidth + firstWidth < availableSpace) {
          firstItem.classList.remove('dropdown-item');
          lastItem.parentNode.insertBefore(firstItem, lastItem.nextSibling);
        }
      }
    }

    if (moreItem.querySelector('.dropdown-menu').children.length > 0) {
      moreItem.setAttribute('style', 'display:block;');
    } else {
      moreItem.setAttribute('style', 'display:none;');
    }
  }

  toggleNavigation(open) {
    this.store.dispatch({ type: actions.TOGGLE_NAVIGATION, open });
  }

  toggleSubNavigation(expanded) {
    this.store.dispatch({ type: actions.TOGGLE_SUB_NAVIGATION, expanded });
  }

  componentWillLoad() {
    this.store = this.ContextStore || (window as any).CorporateUi.store;

    this.setTheme(this.theme);
    this.setPrimaryItems(this.primaryItems);
    this.setSecondaryItems(this.secondaryItems);

    this.store.subscribe(() => {
      this.navigationOpen = this.store.getState().navigation.open;
      this.navigationExpanded = this.store.getState().navigation.expanded;

      this.setTheme();
    });
  }

  componentDidLoad() {
    // To make sure navigation is always shown from start
    this.toggleNavigation(true);

    if (!this.el) return;

    this.tagName = this.el.nodeName.toLowerCase();
    this.isSub = this.el.getAttribute('slot') === 'sub';

    const items = this.el.querySelectorAll('c-navigation[target]');

    if (!document.head.attachShadow) {
      [this.parentEl] = Array.from(this.el.children).filter(e => e.matches('nav'));
      this.navWidth = this.el.querySelector('.navbar').clientWidth;
      this.el.style.width = `${this.navWidth}px`;
    } else {
      this.parentEl = this.el;
    }

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const target = item.getAttribute('target');
      const node: HTMLAnchorElement = this.parentEl.querySelector(`a[href="${target}"]`);
      node.classList.add('parent');
      node.onclick = (event) => this.open(event);
    }
  }

  componentDidUpdate() {
    // only if it is not a sub and only on desktop
    if (this.el.getAttribute('slot') !== 'sub' && document.body.clientWidth > 992) {
      this.initMoreDropdown({ type: 'didUpdate' });
    }

    // fallback of sticky on IE
    if (!document.head.attachShadow) {
      setTimeout(() => {
        try {
          this.scrollPos = this.scrollPos === 0 ? this.el.getBoundingClientRect().top : this.scrollPos;
        } catch (e) { console.log(e); }
      }, 100);
    }
  }

  parse(items) {
    return Array.isArray(items) ? items : JSON.parse(items || '[]');
  }

  combineClasses(classes) {
    return [
      ...(classes || '').split(' '),
      ...['nav-item', 'nav-link'],
    ].join(' ');
  }

  open(event) {
    const target = event.target.getAttribute('href');
    const node = this.el.querySelector(`c-navigation[target="${target}"]`);

    if (window.innerWidth > 992) {
      return;
    }

    if (node) {
      event.preventDefault ? event.preventDefault() : (event.returnValue = false);
      this.toggleSubNavigation(target);
    }

    if (target === '#close') {
      event.preventDefault ? event.preventDefault() : (event.returnValue = false);
      this.toggleSubNavigation('');
    }
  }

  dropdownToggle() :void{
    this.ddToggle = !this.ddToggle;
    this.onDdToggle.emit({ visible: this.ddToggle });
  }

  hostData() {
    return {
      open: this.target === this.navigationExpanded || (!this.isSub && this.navigationExpanded) ? 'true' : 'false',
    };
  }

  render() {
    return [
      this.currentTheme ? <style id="themeStyle">{ this.currentTheme[this.tagName] }</style> : '',

      <nav class={`navbar navbar-expand-lg ${this.orientation}`}>
        <div class={`collapse navbar-collapse${this.navigationOpen ? ' show' : ''}`}>
          <nav class='navbar-nav'>
            { this.isSub
              ? [
                this.caption ? <strong class="nav-item caption">{ this.caption }</strong> : '',
                  <a href="#close" class="nav-item nav-link toggle-sub" onClick={(event) => this.open(event)}>{ this.caption || 'Back' }</a>,
              ]
              : ''
            }

            { this.primaryItems.map((item: any) => {
              item.class = this.combineClasses(item.class);
              return <a { ...item }></a>;
            }) }

            <slot name="primary-items" />
            <div class="dropdown" onClick={() => this.dropdownToggle()}>
              <a class="dropdown-toggle nav-item nav-link" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">more</a>

              <div class={`dropdown-menu ${this.ddToggle ? 'show' : ''}`}></div>
            </div>
          </nav>
        </div>

        <div class={`collapse navbar-collapse${this.navigationOpen ? ' show' : ''}`}>
          <nav class='navbar-nav ml-auto'>
            { this.secondaryItems.map((item: any) => {
              item.class = this.combineClasses(item.class);
              return <a { ...item }></a>;
            }) }

            <slot name="secondary-items" />
          </nav>
        </div>

        <a class='navbar-symbol'></a>
      </nav>,

      <slot name="sub" />,
    ];
  }
}
