import { Facet } from './Facet';
import { FacetValue } from './FacetValues';
import { $$ } from '../../utils/Dom';
import { Utils } from '../../utils/Utils';
import { l } from '../../strings/Strings';
import { Component } from '../Base/Component';
import * as _ from 'underscore';
//import { SVGIcons } from '../../utils/SVGIcons';
//import { SVGDom } from '../../utils/SVGDom';

export class ValueElementRenderer {
  public listItem: HTMLElement;
  public label: HTMLElement;
  public checkbox: HTMLElement;
  public stylishCheckbox: HTMLElement;
  public valueCaption: HTMLElement;
  public valueCount: HTMLElement;
  public icon: HTMLElement;
  public excludeIcon: HTMLElement;
  public computedField: HTMLElement;

  constructor(public facet: Facet, public facetValue: FacetValue) {}

  public withNo(element: HTMLElement[]): ValueElementRenderer;
  public withNo(element: HTMLElement): ValueElementRenderer;
  public withNo(element: any): ValueElementRenderer {
    if (_.isArray(element)) {
      _.each(element, (e: HTMLElement) => {
        if (e) {
          $$(e).detach();
        }
      });
    } else {
      if (element) {
        $$(element).detach();
      }
    }
    return this;
  }

  public build(): ValueElementRenderer {
    this.listItem = $$('li', {
      className: 'list-group-item list-group-item-action row no-gutters p-0'
    }).el;

    this.listItem.setAttribute('data-value', this.facetValue.value);
    const labelDiv = $$('div', {
      className: 'form-check container p-0 m-0'
    }).el;

    this.label = $$('label', {
      className: 'form-check-label d-flex align-items-center flex-nowrap row no-gutters p-2 pr-3'
    }).el;

    this.listItem.appendChild(labelDiv);
    labelDiv.appendChild(this.label);

    this.excludeIcon = this.buildExcludeIcon();
    this.listItem.appendChild(this.excludeIcon);

    $$(this.excludeIcon).on('mouseover', () => {
      $$(this.listItem).addClass('coveo-facet-value-will-exclude');
    });

    $$(this.excludeIcon).on('mouseout', () => {
      $$(this.listItem).removeClass('coveo-facet-value-will-exclude');
    });

    if (Utils.exists(this.facetValue.computedField)) {
      this.computedField = this.buildValueComputedField();
      if (this.computedField) {
        this.label.appendChild(this.computedField);
      }
      $$(this.label).addClass('coveo-with-computed-field');
    }

    this.checkbox = this.buildValueCheckbox();
    this.label.appendChild(this.checkbox);

    this.valueCaption = this.buildValueCaption();
    this.label.appendChild(this.valueCaption);

    this.valueCount = this.buildValueCount();
    if (this.valueCount) {
      this.label.appendChild(this.valueCount);
    }

    this.setCssClassOnListValueElement();
    return this;
  }

  public setCssClassOnListValueElement(): void {
    $$(this.listItem).toggleClass('coveo-excluded', this.facetValue.excluded);
  }

  protected buildExcludeIcon(): HTMLElement {
    const excludeIcon = $$(
      'button',
      {
        type: 'button',
        title: l('Exclude', this.facet.getValueCaption(this.facetValue)),
        className: 'close',
        'aria-label': 'Close',
        tabindex: 0
      },
      $$(
        'span',
        {
          'aria-hidden': true
        },
        '&times;'
      )
    ).el;
    this.addFocusAndBlurEventListeners(excludeIcon);
    //excludeIcon.innerHTML = SVGIcons.icons.checkboxHookExclusionMore;
    //SVGDom.addClassToSVGInContainer(excludeIcon, 'coveo-facet-value-exclude-svg');
    return excludeIcon;
  }

  protected buildValueComputedField(): HTMLElement {
    const computedField = this.facetValue.getFormattedComputedField(this.facet.options.computedFieldFormat);
    if (Utils.isNonEmptyString(computedField)) {
      const elem = $$('span', {
        className: 'coveo-facet-value-computed-field'
      }).el;
      $$(elem).text(computedField);
      return elem;
    } else {
      return undefined;
    }
  }

  protected buildValueCheckbox(): HTMLElement {
    const checkbox = $$('input', {
      type: 'checkbox',
      className: 'col-1'
    }).el;
    if (this.facetValue.selected) {
      checkbox.setAttribute('checked', 'checked');
    } else {
      checkbox.removeAttribute('checked');
    }
    if (this.facetValue.excluded) {
      checkbox.setAttribute('disabled', 'disabled');
    } else {
      checkbox.removeAttribute('disabled');
    }
    Component.pointElementsToDummyForm(checkbox);
    return checkbox;
  }

  protected buildValueIcon(): HTMLElement {
    const icon = this.getValueIcon();
    if (Utils.exists(icon)) {
      return $$('img', {
        className: 'coveo-facet-value-icon coveo-icon',
        src: this.getValueIcon()
      }).el;
    } else {
      return this.buildValueIconFromSprite();
    }
  }

  protected getValueIcon(): string {
    if (Utils.exists(this.facet.options.valueIcon)) {
      return this.facet.options.valueIcon(this.facetValue);
    } else {
      return undefined;
    }
  }

  protected buildValueIconFromSprite(): HTMLElement {
    return $$('div', {
      className: 'coveo-facet-value-icon coveo-icon ' + this.facet.options.field.substr(1) + ' ' + this.facetValue.value
    }).el;
  }

  protected buildValueCaption(): HTMLElement {
    const caption = this.facet.getValueCaption(this.facetValue);
    const valueCaption = $$('span', {
      className: 'coveo-facet-value-caption col',
      title: caption,
      'data-original-value': this.facetValue.value
    }).el;

    $$(valueCaption).text(caption);
    return valueCaption;
  }

  protected buildValueCount(): HTMLElement {
    const count = this.facetValue.getFormattedCount();
    if (Utils.isNonEmptyString(count)) {
      const countElement = $$('span', {
        className: 'badge badge-secondary'
      }).el;
      $$(countElement).text(count);
      return countElement;
    } else {
      return undefined;
    }
  }

  private addFocusAndBlurEventListeners(elem: HTMLElement) {
    $$(elem).on('focus', () => $$(this.listItem).addClass('coveo-focused'));
    $$(elem).on('blur', () => $$(this.listItem).removeClass('coveo-focused'));
  }
}
