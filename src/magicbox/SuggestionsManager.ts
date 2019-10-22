import { IQuerySuggestSelection, OmniboxEvents } from '../events/OmniboxEvents';
import { Component } from '../ui/Base/Component';
import { $$, Dom } from '../utils/Dom';
import { InputManager } from './InputManager';
import { ResultPreviewsGrid, ISearchResultPreview, ResultPreviewsGridDirection, IProvidedSearchResultPreview } from './ResultPreviewsGrid';
import { SuggestionsList, SuggestionsListDirection, ISuggestion } from './SuggestionsList';
import { QueriesProcessor, QueryProcessResultStatus } from './QueriesProcessor';
import { l } from '../strings/Strings';
import { Utils } from '../utils/Utils';

export interface Suggestion {
  text?: string;
  index?: number;
  html?: string;
  dom?: HTMLElement;
  separator?: string;
  onSelect?: () => void;
}

export interface SuggestionsManagerOptions {
  selectableSuggestionClass?: string;
  selectedSuggestionClass?: string;
  selectedResultPreviewClass?: string;
  selectableResultPreviewClass?: string;
  timeout?: number;
  querySearchResultPreviewsDelay?: number;
}

enum Direction {
  Up = 'Up',
  Down = 'Down',
  Left = 'Left',
  Right = 'Right'
}

export interface IPopulateSearchResultPreviewsEventArgs {
  suggestion: ISuggestion;
  previewQueries: (IProvidedSearchResultPreview[] | Promise<IProvidedSearchResultPreview[]>)[];
}

export enum SuggestionsManagerEvents {
  PopulateSearchResultPreviews = 'populateSearchResultPreviews'
}

export enum FocusableContainerType {
  SuggestionsList = 'suggestionsList',
  ResultPreviewsGrid = 'resultPreviewsGrid',
  None = 'none'
}

export type IFocusedItem =
  | {
      container: FocusableContainerType.SuggestionsList;
      suggestion: Suggestion;
    }
  | {
      container: FocusableContainerType.ResultPreviewsGrid;
      preview: ISearchResultPreview;
    }
  | {
      container: FocusableContainerType.None;
    };

export interface IFocusMovement {
  handled: boolean;
  focusedSuggestion: ISuggestion;
}

export class SuggestionsManager {
  private options: SuggestionsManagerOptions;
  private lastPreviewedSuggestion: ISuggestion;
  private containsSuggestions: boolean;
  private containsPreviews: boolean;
  private suggestionsList: SuggestionsList;
  private resultPreviewsGrid: ResultPreviewsGrid;
  private suggestionsProcessor: QueriesProcessor<Suggestion>;
  private resultPreviewsProcessor: QueriesProcessor<IProvidedSearchResultPreview>;
  private focusablesContainer: Dom;
  private isKeyboardControlled: boolean;
  private fetchResultPreviewsPendingPromise: Promise<void>;
  private root: HTMLElement;

  public static createContainer() {
    return $$('div', {
      className: 'magic-box-suggestions',
      id: 'magic-box-suggestions-container'
    }).el;
  }

  public get hasSuggestions() {
    return this.containsSuggestions;
  }

  public get isExpanded() {
    return $$(this.element).hasClass('magic-box-hasSuggestion');
  }

  public set isExpanded(expanded: boolean) {
    $$(this.magicBoxContainer).setAttribute('aria-expanded', expanded.toString());
    this.element.classList.toggle('magic-box-hasSuggestion', expanded);
  }

  private set isLoadingPreviews(isLoading: boolean) {
    $$(this.focusablesContainer)
      .find('.coveo-preview-results')
      .classList.toggle('coveo-preview-results-loading', isLoading);
  }

  constructor(
    private element: HTMLElement,
    private magicBoxContainer: HTMLElement,
    private inputManager: InputManager,
    options?: SuggestionsManagerOptions
  ) {
    this.root = Component.resolveRoot(element);
    this.options = options;
    this.containsSuggestions = this.containsPreviews = false;
    this.isKeyboardControlled = false;
    this.isExpanded = false;

    this.element.classList.remove('magic-box-hasSuggestion', 'magic-box-hasPreviews');
    this.buildFocusablesContainer();
    this.initializeSuggestionsList();
    this.initializeSearchResultPreviewsGrid();
    this.initializeAccessibilityProperties();
  }

  public moveDown() {
    return this.moveFocus(Direction.Down);
  }

  public moveUp() {
    return this.moveFocus(Direction.Up);
  }

  public moveLeft() {
    return this.moveFocus(Direction.Left);
  }

  public moveRight() {
    return this.moveFocus(Direction.Right);
  }

  public keyboardSelect(): IFocusedItem {
    if (!this.isKeyboardControlled) {
      return {
        container: FocusableContainerType.None
      };
    }
    const focusedPreview = this.resultPreviewsGrid.focusedPreview;
    if (focusedPreview) {
      this.selectPreview(focusedPreview);
      return {
        container: FocusableContainerType.ResultPreviewsGrid,
        preview: focusedPreview
      };
    }
    const focusedSuggestion = this.suggestionsList.focusedSuggestion;
    if (focusedSuggestion) {
      $$(this.root).trigger(OmniboxEvents.querySuggestSelection, <IQuerySuggestSelection>{ suggestion: focusedSuggestion.text });
      this.selectSuggestion(focusedSuggestion);
      return {
        container: FocusableContainerType.SuggestionsList,
        suggestion: focusedSuggestion
      };
    }
    return {
      container: FocusableContainerType.None
    };
  }

  public async receiveSuggestions(queries: (Suggestion[] | Promise<Suggestion[]>)[]) {
    const suggestionsResponse = await this.suggestionsProcessor.processQueries(queries);
    if (suggestionsResponse.status === QueryProcessResultStatus.Overriden) {
      return null;
    }
    const suggestions = suggestionsResponse.items.sort((a, b) => b.index - a.index);
    this.isExpanded = this.containsSuggestions = suggestions.length > 0;
    const activeSuggestions = this.suggestionsList.displaySuggestions(suggestions);
    if (activeSuggestions) {
      activeSuggestions.forEach(suggestion => $$(suggestion.element).on('click', () => this.selectSuggestion(suggestion)));
    }
    this.clearSearchResultPreviews();
    $$(this.root).trigger(OmniboxEvents.querySuggestRendered);
    return suggestions;
  }

  public blur() {
    this.suggestionsList.blurFocusedSuggestion();
  }

  public getFocusedSuggestion(): ISuggestion {
    return this.suggestionsList.focusedSuggestion;
  }

  private selectSuggestion(suggestion: ISuggestion) {
    $$(suggestion.element).trigger('keyboardSelect');
    this.blur();
    this.isExpanded = false;
  }

  private selectPreview(preview: ISearchResultPreview) {
    $$(preview.element).trigger('keyboardSelect');
    this.resultPreviewsGrid.blurFocusedPreview();
    this.isExpanded = false;
  }

  private fetchSearchResultPreviewsFor(suggestion: ISuggestion) {
    const populateEventArgs: IPopulateSearchResultPreviewsEventArgs = {
      suggestion,
      previewQueries: []
    };
    $$(this.root).trigger(SuggestionsManagerEvents.PopulateSearchResultPreviews, populateEventArgs);
    return populateEventArgs.previewQueries;
  }

  private expandSuggestion(suggestion: ISuggestion, previews: IProvidedSearchResultPreview[]) {
    if (this.lastPreviewedSuggestion) {
      this.lastPreviewedSuggestion.element.classList.remove('magic-box-suggestion-expanded');
    }
    this.lastPreviewedSuggestion = suggestion;
    if (suggestion) {
      this.lastPreviewedSuggestion.element.classList.add('magic-box-suggestion-expanded');
    }
    this.containsPreviews = previews.length > 0;
    this.element.classList.toggle('magic-box-hasPreviews', this.containsPreviews);
    const activePreviews = this.resultPreviewsGrid.displayPreviews(previews);
    if (activePreviews) {
      activePreviews.forEach(preview => $$(preview.element).on('click', () => this.selectPreview(preview)));
    }
    if (suggestion) {
      this.resultPreviewsGrid.setStatusMessage(l('SearchResultPreviewsResultsStatus', suggestion.text));
    } else {
      this.resultPreviewsGrid.clearStatusMessage();
    }
  }

  private async processSearchResultPreviews(
    suggestion: ISuggestion,
    queries: (IProvidedSearchResultPreview[] | Promise<IProvidedSearchResultPreview[]>)[]
  ) {
    this.isLoadingPreviews = true;
    this.resultPreviewsGrid.blurFocusedPreview();
    const previewsResponse = await this.resultPreviewsProcessor.processQueries(queries);
    if (previewsResponse.status === QueryProcessResultStatus.Overriden) {
      return;
    }
    this.isLoadingPreviews = false;
    this.expandSuggestion(suggestion, previewsResponse.items);
  }

  private clearSearchResultPreviews() {
    this.expandSuggestion(null, []);
  }

  private buildFocusablesContainer() {
    this.element.appendChild(
      (this.focusablesContainer = $$('div', {
        className: 'coveo-suggestion-container'
      })).el
    );
  }

  private initializeSuggestionsList() {
    const selectableClass = this.options.selectableSuggestionClass;
    const selectedClass = this.options.selectedSuggestionClass;
    this.suggestionsList = new SuggestionsList(this.focusablesContainer.el, {
      ...(selectableClass && { selectableClass }),
      ...(selectedClass && { selectedClass })
    });
    this.suggestionsList.bindOnSuggestionFocused((_, suggestion) => this.onSuggestionFocused(suggestion));
    this.suggestionsList.bindOnSuggestionBlurred(() => this.onSuggestionBlurred());
    const { timeout } = this.options;
    this.suggestionsProcessor = new QueriesProcessor({
      ...(timeout && { timeout })
    });
  }

  private initializeSearchResultPreviewsGrid() {
    const selectableClass = this.options.selectableResultPreviewClass;
    const selectedClass = this.options.selectedResultPreviewClass;
    this.resultPreviewsGrid = new ResultPreviewsGrid(this.focusablesContainer.el, {
      ...(selectableClass && { selectableClass }),
      ...(selectedClass && { selectedClass })
    });
    this.resultPreviewsGrid.bindOnPreviewFocused((_, preview) => this.onPreviewFocused(preview));
    this.resultPreviewsGrid.bindOnPreviewBlurred(() => this.onPreviewBlurred());
    const { timeout } = this.options;
    this.resultPreviewsProcessor = new QueriesProcessor({
      ...(timeout && { timeout })
    });
  }

  private initializeAccessibilityProperties() {
    const combobox = $$(this.magicBoxContainer);
    const input = $$(this.inputManager.input);

    const ownedFocusablesStr = this.focusablesContainer
      .children()
      .map(focusable => focusable.id)
      .join(' ');

    combobox.setAttribute('role', 'combobox');
    combobox.setAttribute('aria-owns', ownedFocusablesStr);
    combobox.setAttribute('aria-haspopup', 'listbox');

    input.el.removeAttribute('aria-activedescendant');
    input.setAttribute('aria-controls', ownedFocusablesStr);
    input.setAttribute('aria-autocomplete', 'list');
  }

  private moveFocus(direction: Direction): IFocusMovement {
    if (!this.isExpanded) {
      if (!this.hasSuggestions || direction !== Direction.Down) {
        return { handled: false, focusedSuggestion: null };
      }
      this.isExpanded = true;
      return { handled: true, focusedSuggestion: this.getFocusedSuggestion() };
    }
    let handled = false;
    const isPreviewFocused = !!this.resultPreviewsGrid.focusedPreview;
    if (isPreviewFocused) {
      switch (direction) {
        case Direction.Up:
          this.resultPreviewsGrid.focusNextPreview(ResultPreviewsGridDirection.Up);
          break;
        case Direction.Down:
          this.resultPreviewsGrid.focusNextPreview(ResultPreviewsGridDirection.Down);
          break;
        case Direction.Left:
          const oldFocusedPreview = this.resultPreviewsGrid.focusedPreview;
          this.resultPreviewsGrid.focusNextPreview(ResultPreviewsGridDirection.Left);
          if (this.resultPreviewsGrid.focusedPreview === oldFocusedPreview) {
            this.resultPreviewsGrid.blurFocusedPreview();
          }
          break;
        case Direction.Right:
          this.resultPreviewsGrid.focusNextPreview(ResultPreviewsGridDirection.Right);
          break;
      }
      handled = true;
    } else {
      const oldFocusedSuggestion = this.suggestionsList.focusedSuggestion;
      if (oldFocusedSuggestion) {
        switch (direction) {
          case Direction.Up:
            this.suggestionsList.focusNextSuggestion(SuggestionsListDirection.Up);
            if (this.suggestionsList.focusedSuggestion === oldFocusedSuggestion) {
              this.suggestionsList.blurFocusedSuggestion();
            }
            handled = true;
            break;
          case Direction.Down:
            this.suggestionsList.focusNextSuggestion(SuggestionsListDirection.Down);
            if (this.suggestionsList.focusedSuggestion === oldFocusedSuggestion) {
              this.suggestionsList.blurFocusedSuggestion();
            }
            handled = true;
            break;
          case Direction.Left:
            handled = this.containsPreviews;
            break;
          case Direction.Right:
            if ((handled = this.containsPreviews) && oldFocusedSuggestion === this.lastPreviewedSuggestion) {
              this.resultPreviewsGrid.focusFirstPreview();
            }
            break;
        }
      } else {
        if (direction === Direction.Down) {
          this.suggestionsList.focusFirstSuggestion();
          handled = true;
        } else if (direction === Direction.Up) {
          this.suggestionsList.focusLastSuggestion();
          handled = true;
        }
      }
    }
    if (!handled) {
      return { handled: false, focusedSuggestion: null };
    }
    this.isKeyboardControlled = true;
    return {
      handled,
      focusedSuggestion: this.getFocusedSuggestion() || (isPreviewFocused ? this.lastPreviewedSuggestion : null)
    };
  }

  private async onSuggestionFocused(suggestion: ISuggestion) {
    this.isKeyboardControlled = false;
    $$(this.inputManager.input).setAttribute('aria-activedescendant', suggestion.element.id);
    $$(this.root).trigger(OmniboxEvents.querySuggestGetFocus, <IQuerySuggestSelection>{
      suggestion: suggestion.text
    });
    const pending = (this.fetchResultPreviewsPendingPromise = Utils.waitUntil(this.options.querySearchResultPreviewsDelay));
    await pending;
    if (this.fetchResultPreviewsPendingPromise !== pending) {
      return;
    }
    this.resultPreviewsGrid.blurFocusedPreview();
    if (this.lastPreviewedSuggestion !== suggestion) {
      await this.processSearchResultPreviews(suggestion, this.fetchSearchResultPreviewsFor(suggestion));
    } else {
      this.isLoadingPreviews = false;
      this.resultPreviewsProcessor.overrideIfProcessing();
    }
  }

  private onSuggestionBlurred() {
    this.fetchResultPreviewsPendingPromise = null;
    this.isKeyboardControlled = false;
    this.inputManager.input.removeAttribute('aria-activedescendant');
  }

  private onPreviewFocused(preview: ISearchResultPreview) {
    this.isKeyboardControlled = false;
    $$(this.inputManager.input).setAttribute('aria-activedescendant', preview.element.id);
  }

  private onPreviewBlurred() {
    this.isKeyboardControlled = false;
    const focusedSuggestion = this.getFocusedSuggestion();
    if (focusedSuggestion) {
      $$(this.inputManager.input).setAttribute('aria-activedescendant', focusedSuggestion.element.id);
    }
  }
}
