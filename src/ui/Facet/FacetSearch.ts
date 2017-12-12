/// <reference path="Facet.ts" />

import { IIndexFieldValue } from '../../rest/FieldValue';
import { Facet } from './Facet';
import { $$, Dom } from '../../utils/Dom';
import { Utils } from '../../utils/Utils';
import { InitializationEvents } from '../../events/InitializationEvents';

import { FacetSearchParameters } from './FacetSearchParameters';
import { IAnalyticsFacetMeta, analyticsActionCauseList } from '../Analytics/AnalyticsActionListMeta';
import { IEndpointError } from '../../rest/EndpointError';
import { Component } from '../Base/Component';
import { l } from '../../strings/Strings';
import { Assert } from '../../misc/Assert';
import { KEYBOARD } from '../../utils/KeyboardUtils';
import { FacetValue } from './FacetValues';
import { StringUtils } from '../../utils/StringUtils';
import { IFacetSearchValuesListKlass } from './FacetSearchValuesList';
import { FacetValueElement } from './FacetValueElement';
import { SearchInterface } from '../SearchInterface/SearchInterface';
import { ResponsiveComponentsUtils } from '../ResponsiveComponents/ResponsiveComponentsUtils';
import { FacetValuesOrder } from './FacetValuesOrder';
import * as _ from 'underscore';
import { SVGIcons } from '../../utils/SVGIcons';
import { SVGDom } from '../../utils/SVGDom';
import Popper from 'popper.js';
/**
 * Used by the {@link Facet} component to render and handle the facet search part of each facet.
 */
export class FacetSearch {
  public currentlyDisplayedResults: string[];
  public searchResults: HTMLElement;
  public search: HTMLElement;

  private searchStateWidget: HTMLElement;
  private magnifier: HTMLElement;
  private wait: HTMLElement;
  private input: HTMLInputElement;
  private facetSearchTimeout: number;
  private facetSearchPromise: Promise<IIndexFieldValue[]>;
  private moreValuesToFetch = true;
  private onResize: (...args: any[]) => void;
  private onDocumentClick: (e: Event) => void;
  private lastSearchWasEmpty = true;

  constructor(public facet: Facet, public facetSearchValuesListKlass: IFacetSearchValuesListKlass, private root: HTMLElement) {
    this.searchResults = $$('ul', {
      className: 'coveo-facet-search-results p-0 popover'
    }).el;
    this.onResize = _.debounce(() => {
      // Mitigate issues in UT where the window in phantom js might get resized in the scope of another test.
      // These would point to random instance of a test karma object, and not a real search interface.
      if (this.facet instanceof Facet && this.facet.searchInterface instanceof SearchInterface) {
        if (this.shouldPositionSearchResults()) {
          this.positionSearchResults();
        }
      }
    }, 250);
    this.onDocumentClick = (e: Event) => {
      this.handleClickElsewhere(e);
    };
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('click', (e: Event) => this.onDocumentClick(e));
    $$(facet.root).on(InitializationEvents.nuke, () => this.handleNuke());
  }

  /**
   * Build the search component and return an `HTMLElement` which can be appended to the {@link Facet}.
   * @returns {HTMLElement}
   */
  public build(): HTMLElement {
    return this.buildBaseSearch();
  }

  /**
   * Position the search results at the footer of the facet.
   */
  public positionSearchResults(nextTo: HTMLElement = this.search) {
    if (this.searchResults != null) {
      $$(this.searchResults).show();
      this.searchResults.style.width = this.facet.element.clientWidth + 'px';
      new Popper(nextTo, this.searchResults, {
        placement: 'bottom-end'
      });
    }
  }

  /**
   * Dismiss the search results
   */
  public completelyDismissSearch() {
    this.cancelAnyPendingSearchOperation();
    this.facet.unfadeInactiveValuesInMainList();
    $$(this.searchResults).empty();
    this.moreValuesToFetch = true;
    $$(this.search).removeClass('coveo-facet-search-no-results');
    $$(this.facet.element).removeClass('coveo-facet-searching');
    this.hideSearchResultsElement();
    this.input.value = '';
    this.currentlyDisplayedResults = undefined;
  }

  /**
   * Trigger a new facet search, and display the results.
   * @param params
   */
  public triggerNewFacetSearch(params: FacetSearchParameters) {
    this.cancelAnyPendingSearchOperation();
    this.showFacetSearchWaitingAnimation();

    this.facet.logger.info('Triggering new facet search');

    this.facetSearchPromise = this.facet.facetQueryController.search(params);

    if (this.facetSearchPromise) {
      this.facetSearchPromise
        .then((fieldValues: IIndexFieldValue[]) => {
          this.facet.usageAnalytics.logCustomEvent<IAnalyticsFacetMeta>(
            analyticsActionCauseList.facetSearch,
            {
              facetId: this.facet.options.id,
              facetTitle: this.facet.options.title
            },
            this.facet.root
          );
          this.facet.logger.debug('Received field values', fieldValues);
          this.processNewFacetSearchResults(fieldValues, params);
          this.hideFacetSearchWaitingAnimation();
          this.facetSearchPromise = undefined;
        })
        .catch((error: IEndpointError) => {
          // The request might be normally cancelled if another search is triggered.
          // In this case we do not hide the animation to prevent flicking.
          if (Utils.exists(error)) {
            this.facet.logger.error('Error while retrieving facet values', error);
            this.hideFacetSearchWaitingAnimation();
          }
          this.facetSearchPromise = undefined;
          return null;
        });
    }
  }

  /**
   * Trigger the event associated with the focus of the search input.
   */
  public focus(): void {
    this.input.focus();
    this.handleFacetSearchFocus();
  }

  private shouldPositionSearchResults(): boolean {
    return !ResponsiveComponentsUtils.isSmallFacetActivated($$(this.root)) && $$(this.facet.element).hasClass('coveo-facet-searching');
  }

  private buildBaseSearch(): HTMLElement {
    this.search = $$('div', {
      className: 'card-block'
    }).el;

    const searchWrapper = $$('div', {
      className: 'input-group'
    });

    this.search.appendChild(searchWrapper.el);

    this.searchStateWidget = $$('div', { className: 'input-group-addon' }, SVGIcons.icons.search).el;
    searchWrapper.append(this.searchStateWidget);

    this.magnifier = $$('div', { className: 'coveo-facet-search-magnifier' }, SVGIcons.icons.search).el;
    SVGDom.addClassToSVGInContainer(this.magnifier, 'coveo-facet-search-magnifier-svg text-primary');

    this.wait = $$(
      'div',
      {
        className: 'coveo-facet-search-wait-animation'
      },
      SVGIcons.icons.loading
    ).el;
    SVGDom.addClassToSVGInContainer(this.wait, 'coveo-facet-search-wait-animation-svg text-primary');

    this.hideFacetSearchWaitingAnimation();

    this.input = $$('input', {
      type: 'text',
      autocapitalize: 'off',
      autocorrect: 'off',
      className: 'form-control',
      placeholder: l('Search')
    }).el as HTMLInputElement;
    Component.pointElementsToDummyForm(this.input);
    searchWrapper.append(this.input);

    $$(this.input).on('keyup', (e: KeyboardEvent) => this.handleFacetSearchKeyUp(e));
    $$(this.input).on('focus', (e: Event) => this.handleFacetSearchFocus());

    this.root.appendChild(this.searchResults);
    this.hideSearchResultsElement();

    return this.search;
  }

  private handleFacetSearchKeyUp(event: KeyboardEvent) {
    Assert.exists(event);
    let isEmpty = this.input.value.trim() == '';
    this.handleKeyboardNavigation(event, isEmpty);
  }

  private handleNuke() {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('click', this.onDocumentClick);
  }

  private handleFacetSearchFocus() {
    // Trigger a query only if the results are not already rendered.
    // Protect against the case where user can "focus" out of the search box by clicking not directly on a search results
    // Then re-focusing the search box
    if (this.currentlyDisplayedResults == null) {
      this.startNewSearchTimeout(this.buildParamsForExcludingCurrentlyDisplayedValues());
    }
  }

  private handleClickElsewhere(event: Event) {
    if (this.currentlyDisplayedResults && this.search != event.target && this.searchResults != event.target && this.input != event.target) {
      this.completelyDismissSearch();
    }
  }

  private handleKeyboardNavigation(event: KeyboardEvent, isEmpty: boolean) {
    switch (event.which) {
      case KEYBOARD.ENTER:
        this.keyboardNavigationEnterPressed(event, isEmpty);
        break;
      case KEYBOARD.DELETE:
        this.keyboardNavigationDeletePressed(event);
        break;
      case KEYBOARD.ESCAPE:
        this.completelyDismissSearch();
        break;
      case KEYBOARD.DOWN_ARROW:
        this.moveCurrentResultDown();
        break;
      case KEYBOARD.UP_ARROW:
        this.moveCurrentResultUp();
        break;
      default:
        this.moreValuesToFetch = true;
        this.highlightCurrentQueryWithinSearchResults();
        if (!isEmpty) {
          this.lastSearchWasEmpty = false;
          this.startNewSearchTimeout(this.buildParamsForNormalSearch());
        } else if (!this.lastSearchWasEmpty) {
          // This normally happen if a user delete the search box content to go back to "empty" state.
          this.currentlyDisplayedResults = undefined;
          $$(this.searchResults).empty();
          this.lastSearchWasEmpty = true;
          this.startNewSearchTimeout(this.buildParamsForFetchingMore());
        }

        break;
    }
  }

  private keyboardNavigationEnterPressed(event: KeyboardEvent, isEmpty: boolean) {
    if (event.shiftKey) {
      this.triggerNewFacetSearch(this.buildParamsForNormalSearch());
    } else {
      if (this.searchResults.style.display != 'none') {
        this.performSelectActionOnCurrentSearchResult();
        this.completelyDismissSearch();
      } else if ($$(this.input).is('.is-invalid') && !isEmpty) {
        this.selectAllValuesMatchingSearch();
      }
    }
  }

  private keyboardNavigationDeletePressed(event: KeyboardEvent) {
    if (event.shiftKey) {
      this.performExcludeActionOnCurrentSearchResult();
      this.completelyDismissSearch();
      this.input.value = '';
    }
  }

  private startNewSearchTimeout(params: FacetSearchParameters) {
    this.cancelAnyPendingSearchOperation();
    this.facetSearchTimeout = setTimeout(() => {
      this.triggerNewFacetSearch(params);
    }, this.facet.options.facetSearchDelay);
  }

  private cancelAnyPendingSearchOperation() {
    if (Utils.exists(this.facetSearchTimeout)) {
      clearTimeout(this.facetSearchTimeout);
      this.facetSearchTimeout = undefined;
    }
    if (Utils.exists(this.facetSearchPromise)) {
      Promise.reject(this.facetSearchPromise).catch(() => {});
      this.facetSearchPromise = undefined;
    }

    this.hideFacetSearchWaitingAnimation();
  }

  private processNewFacetSearchResults(fieldValues: IIndexFieldValue[], facetSearchParameters: FacetSearchParameters) {
    Assert.exists(fieldValues);
    fieldValues = new FacetValuesOrder(this.facet, this.facet.facetSort).reorderValues(fieldValues);
    if (fieldValues.length > 0) {
      $$(this.input).removeClass('is-invalid');
      this.facet.fadeInactiveValuesInMainList(this.facet.options.facetSearchDelay);
      this.rebuildSearchResults(fieldValues, facetSearchParameters);
      if (!facetSearchParameters.fetchMore) {
        this.showSearchResultsElement();
      }
      this.highlightCurrentQueryWithinSearchResults();
      this.makeFirstSearchResultTheCurrentOne();
    } else {
      if (facetSearchParameters.fetchMore) {
        this.moreValuesToFetch = false;
      } else {
        this.hideSearchResultsElement();
        $$(this.input).addClass('is-invalid');
      }
    }
  }

  private rebuildSearchResults(fieldValues: IIndexFieldValue[], facetSearchParameters: FacetSearchParameters) {
    Assert.exists(fieldValues);
    if (!facetSearchParameters.fetchMore) {
      $$(this.searchResults).empty();
    }
    let selectAll = $$('list', {
      className: 'list-group-item list-group-item-action p-2'
    }).el;

    if (Utils.isNonEmptyString(facetSearchParameters.valueToSearch)) {
      $$(selectAll).text(l('SelectAll'));
      $$(selectAll).on('click', () => this.selectAllValuesMatchingSearch());
      this.searchResults.appendChild(selectAll);
    }

    let facetValues = _.map(fieldValues, fieldValue => {
      return FacetValue.create(fieldValue);
    });
    _.each(new this.facetSearchValuesListKlass(this.facet, FacetValueElement).build(facetValues), (listElement: HTMLElement) => {
      this.searchResults.appendChild(listElement);
    });
    if (this.currentlyDisplayedResults) {
      this.currentlyDisplayedResults = this.currentlyDisplayedResults.concat(_.pluck(facetValues, 'value'));
    } else {
      this.currentlyDisplayedResults = _.pluck(facetValues, 'value');
    }

    _.each(this.getSelectables(), (elem: HTMLElement) => {
      this.setupFacetSearchResultsEvents(elem);
    });

    $$(this.searchResults).on('scroll', () => this.handleFacetSearchResultsScroll());
  }

  private setupFacetSearchResultsEvents(elem: HTMLElement) {
    $$(elem).on('mousemove', () => {
      this.makeCurrentResult(elem);
    });

    // Prevent closing the search results on the end of a touch drag
    let touchDragging = false;
    let mouseDragging = false;
    $$(elem).on('mousedown', () => (mouseDragging = false));
    $$(elem).on('mousemove', () => (mouseDragging = true));
    $$(elem).on('touchmove', () => (touchDragging = true));

    $$(elem).on('mouseup touchend', () => {
      if (!touchDragging && !mouseDragging) {
        setTimeout(() => {
          this.completelyDismissSearch();
        }, 0); // setTimeout is to give time to trigger the click event before hiding the search menu.
      }
      touchDragging = false;
      mouseDragging = false;
    });
  }

  private handleFacetSearchResultsScroll() {
    if (this.facetSearchPromise || this.getValueInInputForFacetSearch() != '' || !this.moreValuesToFetch) {
      return;
    }

    let elementHeight = this.searchResults.clientHeight;
    let scrollHeight = this.searchResults.scrollHeight;
    let bottomPosition = this.searchResults.scrollTop + elementHeight;
    if (scrollHeight - bottomPosition < elementHeight / 2) {
      this.triggerNewFacetSearch(this.buildParamsForFetchingMore());
    }
  }

  private buildParamsForNormalSearch() {
    let params = new FacetSearchParameters(this.facet);
    params.setValueToSearch(this.getValueInInputForFacetSearch());
    params.fetchMore = false;
    return params;
  }

  private buildParamsForFetchingMore() {
    let params = this.buildParamsForExcludingCurrentlyDisplayedValues();
    params.fetchMore = true;
    return params;
  }

  protected buildParamsForExcludingCurrentlyDisplayedValues() {
    let params = new FacetSearchParameters(this.facet);
    params.excludeCurrentlyDisplayedValuesInSearch(this.searchResults);
    params.setValueToSearch(this.getValueInInputForFacetSearch());
    return params;
  }

  private showSearchResultsElement() {
    this.positionSearchResults();
  }

  private hideSearchResultsElement() {
    $$(this.searchResults).hide();
  }

  private highlightCurrentQueryWithinSearchResults() {
    let captions = $$(this.searchResults).findAll('.coveo-facet-value-caption');
    _.each(captions, (captionElement: HTMLElement) => {
      let search = this.getValueInInputForFacetSearch();
      let regex = new RegExp('(' + StringUtils.wildcardsToRegex(search, this.facet.options.facetSearchIgnoreAccents) + ')', 'ig');

      let text = $$(captionElement).text();
      let highlighted = text.replace(regex, '<span class="coveo-highlight">$1</span>');
      captionElement.innerHTML = highlighted;
    });
  }

  private makeFirstSearchResultTheCurrentOne() {
    this.makeCurrentResult(this.getSelectables()[0]);
  }

  private makeCurrentResult(result: HTMLElement) {
    _.each(this.getSelectables(), (selectable: HTMLElement) => {
      $$(selectable).removeClass('active');
    });
    $$(result).addClass('active');
  }

  private moveCurrentResultDown() {
    let current = $$(this.searchResults).find('.active');
    _.each(this.getSelectables(), (selectable: HTMLElement) => {
      $$(selectable).removeClass('active');
    });
    let allSelectables = this.getSelectables();
    let idx = _.indexOf(allSelectables, current);
    let target: Dom;
    if (idx < allSelectables.length - 1) {
      target = $$(allSelectables[idx + 1]);
    } else {
      target = $$(allSelectables[0]);
    }
    this.highlightAndShowCurrentResultWithKeyboard(target);
  }

  private moveCurrentResultUp() {
    let current = $$(this.searchResults).find('.active');
    _.each(this.getSelectables(), s => {
      $$(s).removeClass('active');
    });

    let allSelectables = this.getSelectables();
    let idx = _.indexOf(allSelectables, current);
    let target: Dom;
    if (idx > 0) {
      target = $$(allSelectables[idx - 1]);
    } else {
      target = $$(allSelectables[allSelectables.length - 1]);
    }
    this.highlightAndShowCurrentResultWithKeyboard(target);
  }

  private highlightAndShowCurrentResultWithKeyboard(target: Dom) {
    target.addClass('active');
    this.searchResults.scrollTop = target.el.offsetTop;
  }

  private getSelectables(target = this.searchResults) {
    return $$(target).findAll('.list-group-item');
  }

  private performSelectActionOnCurrentSearchResult() {
    let current = $$(this.searchResults).find('.active');
    Assert.check(current != undefined);

    let checkbox = <HTMLInputElement>$$(current).find('input[type="checkbox"]');
    if (checkbox != undefined) {
      checkbox.checked = true;
      $$(checkbox).trigger('change');
    } else {
      current.click();
    }
  }

  private performExcludeActionOnCurrentSearchResult() {
    let current = $$(this.searchResults).find('.active');
    Assert.check(current != null);
    let valueCaption = $$(current).find('.coveo-facet-value-caption');
    let valueElement = this.facet.facetValuesList.get($$(valueCaption).text());

    valueElement.toggleExcludeWithUA();
  }

  public getValueInInputForFacetSearch() {
    return this.input.value.trim();
  }

  protected selectAllValuesMatchingSearch() {
    this.facet.showWaitingAnimation();

    let searchParameters = new FacetSearchParameters(this.facet);
    searchParameters.nbResults = 1000;
    searchParameters.setValueToSearch(this.getValueInInputForFacetSearch());
    this.facet.facetQueryController.search(searchParameters).then((fieldValues: IIndexFieldValue[]) => {
      this.completelyDismissSearch();
      let facetValues = _.map(fieldValues, fieldValue => {
        let facetValue = this.facet.values.get(fieldValue.value);
        if (!Utils.exists(facetValue)) {
          facetValue = FacetValue.create(fieldValue);
        }
        facetValue.selected = true;
        facetValue.excluded = false;
        return facetValue;
      });
      this.facet.processFacetSearchAllResultsSelected(facetValues);
    });
    this.completelyDismissSearch();
  }

  private showFacetSearchWaitingAnimation() {
    $$(this.searchStateWidget).append(this.wait);
    $$(this.magnifier).remove();
  }

  private hideFacetSearchWaitingAnimation() {
    $$(this.searchStateWidget).append(this.magnifier);
    $$(this.wait).remove();
  }
}
