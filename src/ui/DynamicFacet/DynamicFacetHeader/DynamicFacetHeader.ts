import 'styling/DynamicFacet/_DynamicFacetHeader';
import { $$, Dom } from '../../../utils/Dom';
import { l } from '../../../strings/Strings';
import { SVGIcons } from '../../../utils/SVGIcons';
import { SVGDom } from '../../../utils/SVGDom';
import { RendererUtils } from '../../../utils/RendererUtils';
import { DynamicFacet, IDynamicFacetCustomSection } from '../DynamicFacet';
import { DynamicFacetHeaderButton } from './DynamicFacetHeaderButton';
import { DynamicFacetHeaderCollapseToggle } from './DynamicFacetHeaderCollapseToggle';
import { analyticsActionCauseList } from '../../Analytics/AnalyticsActionListMeta';

export interface IDynamicFacetCustomHeaderSections {
  title?: IDynamicFacetCustomSection;
}

export class DynamicFacetHeader {
  public static showLoadingDelay = 2000;
  public element: HTMLElement;
  private title: Dom;
  private waitAnimation: Dom;
  private clearButton: DynamicFacetHeaderButton;
  private collapseToggle: DynamicFacetHeaderCollapseToggle;
  private showLoadingTimeout: number;

  constructor(private facet: DynamicFacet) {
    this.render();
  }

  private render() {
    this.element = $$('div', { className: 'coveo-dynamic-facet-header' }).el;

    $$(this.element).append(this.createTitle());
    $$(this.element).append(this.createWaitAnimation());
    $$(this.element).append(this.createClearButton());
    this.facet.options.enableCollapse && this.enableCollapse();
  }

  private createClearButton() {
    this.clearButton = new DynamicFacetHeaderButton(this.facet, {
      label: l('Clear'),
      ariaLabel: l('Clear', this.facet.options.title),
      className: 'coveo-dynamic-facet-header-clear',
      shouldDisplay: false,
      action: () => this.clear(),
    });

    return this.clearButton.element;
  }

  private clear() {
    this.facet.reset();
    this.facet.enableFreezeFacetOrderFlag();
    this.facet.scrollToTop();
    this.facet.triggerNewQuery(() => this.logClearAllToAnalytics());
  }

  private logClearAllToAnalytics() {
    this.facet.logAnalyticsEvent(analyticsActionCauseList.dynamicFacetClearAll, this.facet.basicAnalyticsFacetState);
  }

  private createCollapseToggle() {
    this.collapseToggle = new DynamicFacetHeaderCollapseToggle(this.facet);
    return this.collapseToggle.element;
  }

  private enableCollapse() {
    $$(this.element).append(this.createCollapseToggle());
    $$(this.title).addClass('coveo-clickable');
    $$(this.title).on('click', () => this.facet.toggleCollapse());
  }

  public toggleCollapse(isCollapsed: boolean) {
    this.facet.options.enableCollapse && this.collapseToggle.toggleButtons(isCollapsed);
  }

  private get customSections() {
    return this.facet.options.customSections;
  }

  private get defaultTitleTemplate() {
    return `<h2 class="coveo-dynamic-facet-header-title">
      <span aria-hidden="true" title="${this.facet.options.title}">
        ${this.facet.options.title}
      </span>
    </h2>`;
  }

  private createTitle() {
    const template = this.customSections.title && this.customSections.title.template
      ? this.customSections.title.template(this.facet)
      : this.defaultTitleTemplate;

    const originalElement = RendererUtils.getElementFromTemplate(template);
    const element = this.customSections.title && this.customSections.title.modifyElement
      ? this.customSections.title.modifyElement(this.facet, originalElement)
      : originalElement;

    this.title = $$(element);
    this.title.setAttribute('ariaLabel', `${l('FacetTitle', this.facet.options.title)}`);
    return this.title.el;
  }

  private createWaitAnimation() {
    const element = $$('div', { className: 'coveo-dynamic-facet-header-wait-animation' }, SVGIcons.icons.loading).el;
    SVGDom.addClassToSVGInContainer(element, 'coveo-dynamic-facet-header-wait-animation-svg');

    this.waitAnimation = $$(element);
    this.waitAnimation.toggle(false);
    return this.waitAnimation.el;
  }

  public toggleClear(visible: boolean) {
    this.clearButton.toggle(visible);
  }

  public showLoading() {
    clearTimeout(this.showLoadingTimeout);
    this.showLoadingTimeout = window.setTimeout(() => this.waitAnimation.toggle(true), DynamicFacetHeader.showLoadingDelay);
  }

  public hideLoading() {
    clearTimeout(this.showLoadingTimeout);
    this.waitAnimation.toggle(false);
  }
}
