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
      suggestion: ISuggestion;
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
  private lastQueriedSuggestion: ISuggestion;
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

  public get isExpanded() {
    return $$(this.element).hasClass('magic-box-hasSuggestion');
  }

  public set isExpanded(expanded: boolean) {
    $$(this.magicBoxContainer).setAttribute('aria-expanded', expanded.toString());
    this.element.classList.toggle('magic-box-hasSuggestion', expanded);
  }

  public get hasSuggestions() {
    return this.containsSuggestions;
  }

  private get loadingSuggestion() {
    return this.lastQueriedSuggestion;
  }

  private set loadingSuggestion(loadingSuggestion: ISuggestion) {
    this.lastQueriedSuggestion = loadingSuggestion;
    $$(this.focusablesContainer)
      .find('.coveo-preview-results')
      .classList.toggle('coveo-preview-results-loading', !!loadingSuggestion);
  }

  private get expandedSuggestion(): ISuggestion {
    return this.lastPreviewedSuggestion;
  }

  private set expandedSuggestion(newSuggestion: ISuggestion) {
    if (this.lastPreviewedSuggestion) {
      this.lastPreviewedSuggestion.element.classList.remove('magic-box-suggestion-expanded');
    }
    this.lastPreviewedSuggestion = newSuggestion;
    if (newSuggestion) {
      newSuggestion.element.classList.add('magic-box-suggestion-expanded');
    }
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
    this.suggestionsList.displaySuggestions(suggestions);
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

  private moveFocusInPreviews(direction: Direction) {
    const focusedPreview = this.resultPreviewsGrid.focusedPreview;
    switch (direction) {
      case Direction.Up:
        this.resultPreviewsGrid.focusNextPreview(ResultPreviewsGridDirection.Up);
        break;
      case Direction.Down:
        this.resultPreviewsGrid.focusNextPreview(ResultPreviewsGridDirection.Down);
        break;
      case Direction.Left:
        this.resultPreviewsGrid.focusNextPreview(ResultPreviewsGridDirection.Left);
        if (this.resultPreviewsGrid.focusedPreview === focusedPreview) {
          // Go back to SuggestionsList
          this.resultPreviewsGrid.blurFocusedPreview();
        }
        break;
      case Direction.Right:
        this.resultPreviewsGrid.focusNextPreview(ResultPreviewsGridDirection.Right);
        break;
    }
  }

  private focusInitial(direction: Direction) {
    if (direction === Direction.Down) {
      this.suggestionsList.focusFirstSuggestion();
      return true;
    } else if (direction === Direction.Up) {
      this.suggestionsList.focusLastSuggestion();
      return true;
    }
    return false;
  }

  private moveFocusInSuggestions(direction: Direction) {
    const focusedSuggestion = this.suggestionsList.focusedSuggestion;
    let movementIsVertical = false;
    switch (direction) {
      case Direction.Up:
        this.suggestionsList.focusNextSuggestion(SuggestionsListDirection.Up);
        movementIsVertical = true;
        break;
      case Direction.Down:
        this.suggestionsList.focusNextSuggestion(SuggestionsListDirection.Down);
        movementIsVertical = true;
        break;
      case Direction.Left:
        break;
      case Direction.Right:
        if (this.containsPreviews && focusedSuggestion === this.expandedSuggestion) {
          // Go in ResultPreviewsGrid
          this.resultPreviewsGrid.focusFirstPreview();
        }
        break;
    }
    if (movementIsVertical) {
      if (this.suggestionsList.focusedSuggestion === focusedSuggestion) {
        // Limit reached
        this.suggestionsList.blurFocusedSuggestion();
      }
      return true;
    }
    return this.containsPreviews;
  }

  private moveFocus(direction: Direction): IFocusMovement {
    let handled = false;
    let focusedSuggestion = this.getFocusedSuggestion();
    if (this.hasSuggestions) {
      if (!this.isExpanded || !focusedSuggestion) {
        handled = this.focusInitial(direction);
      } else if (this.resultPreviewsGrid.focusedPreview) {
        this.moveFocusInPreviews(direction);
        handled = true;
      } else {
        handled = this.moveFocusInSuggestions(direction);
      }
    }
    if (!handled) {
      return { handled: false, focusedSuggestion: null };
    }
    this.isKeyboardControlled = true;
    return {
      handled,
      focusedSuggestion: this.getFocusedSuggestion() || this.expandedSuggestion
    };
  }

  private getSearchResultPreviewsQueries(suggestion: ISuggestion) {
    const populateEventArgs: IPopulateSearchResultPreviewsEventArgs = {
      suggestion,
      previewQueries: []
    };
    $$(this.root).trigger(SuggestionsManagerEvents.PopulateSearchResultPreviews, populateEventArgs);
    return populateEventArgs.previewQueries;
  }

  private displaySuggestionPreviews(suggestion: ISuggestion, previews: IProvidedSearchResultPreview[]) {
    this.loadingSuggestion = null;
    this.expandedSuggestion = suggestion;
    this.containsPreviews = previews.length > 0;
    this.element.classList.toggle('magic-box-hasPreviews', this.containsPreviews);
    const activePreviews = this.resultPreviewsGrid.displayPreviews(previews);
    if (activePreviews) {
      activePreviews.forEach(preview => $$(preview.element).on('click', () => this.selectPreview(preview)));
    }

    if (suggestion && suggestion.text) {
      this.resultPreviewsGrid.setStatusMessage(l('SearchResultPreviewsResultsStatus', suggestion.text));
    } else {
      this.resultPreviewsGrid.clearStatusMessage();
    }
  }

  private clearSearchResultPreviews() {
    this.displaySuggestionPreviews(null, []);
  }

  private async loadSearchResultPreviews(
    suggestion: ISuggestion,
    queries: (IProvidedSearchResultPreview[] | Promise<IProvidedSearchResultPreview[]>)[]
  ) {
    this.loadingSuggestion = suggestion;
    this.resultPreviewsGrid.blurFocusedPreview();
    const previewsResponse = await this.resultPreviewsProcessor.processQueries(queries);
    if (previewsResponse.status === QueryProcessResultStatus.Overriden) {
      return;
    }
    this.displaySuggestionPreviews(suggestion, previewsResponse.items);
  }

  private async fetchAndDisplaySearchResultPreviews(suggestion: ISuggestion) {
    if (this.expandedSuggestion !== suggestion && this.loadingSuggestion !== suggestion) {
      if (suggestion.text) {
        await this.loadSearchResultPreviews(suggestion, this.getSearchResultPreviewsQueries(suggestion));
      } else {
        this.displaySuggestionPreviews(suggestion, []);
      }
    } else {
      this.resultPreviewsProcessor.overrideIfProcessing();
    }
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
    await this.fetchAndDisplaySearchResultPreviews(suggestion);
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
