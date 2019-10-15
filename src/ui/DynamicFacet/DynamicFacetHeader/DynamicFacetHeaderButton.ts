import { $$, Dom } from '../../../utils/Dom';
import { SVGDom } from '../../../utils/SVGDom';
import { DynamicFacet } from '../DynamicFacet';

export interface IDynamicFacetHeaderButtonOptions {
  label: string;
  ariaLabel?: string;
  shouldDisplay?: boolean;
  className?: string;
  iconSVG?: string;
  iconClassName?: string;
  action?: () => void;
}

export class DynamicFacetHeaderButton {
  private button: Dom;
  public element: HTMLElement;

  constructor(facet: DynamicFacet, private rootOptions: IDynamicFacetHeaderButtonOptions) {
    this.create();
  }

  private create() {
    this.button = $$(this.createButton());

    this.rootOptions.action && this.button.on('click', this.rootOptions.action);

    if (this.rootOptions.ariaLabel) {
      this.button.setAttribute('aria-label', this.rootOptions.ariaLabel);
    }

    if (this.rootOptions.shouldDisplay !== undefined) {
      this.toggle(this.rootOptions.shouldDisplay);
    }

    this.element = this.button.el;
  }

  private createButton() {
    const hasIcon = this.rootOptions.iconSVG && this.rootOptions.iconClassName;
    const button = $$(
      'button',
      { className: `coveo-dynamic-facet-header-btn ${this.rootOptions.className || ''}`.trim() },
      hasIcon ? this.rootOptions.iconSVG : this.rootOptions.label
    );

    if (hasIcon) {
      button.setAttribute('aria-label', this.rootOptions.label);
      button.setAttribute('title', this.rootOptions.label);
      SVGDom.addClassToSVGInContainer(button.el, this.rootOptions.iconClassName);
    }

    return button.el;
  }

  public toggle(shouldDisplay: boolean) {
    this.button.toggle(shouldDisplay);
  }
}
