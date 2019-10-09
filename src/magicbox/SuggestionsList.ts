import { defaults } from 'underscore';
import { Dom, $$ } from '../utils/Dom';
import { Suggestion, ISelectableItemsContainer } from './SuggestionsManager';

export enum SuggestionsListDirection {
  Up = 'Up',
  Down = 'Down'
}

interface IActiveSuggestion extends Suggestion {
  deactivate: () => void;
}

export interface ISuggestionsListOptions {
  selectableClass?: string;
  selectedClass?: string;
}

export interface ISuggestionHoveredEventArgs {
  suggestion: Suggestion;
}

export enum SuggestionsListEvents {
  SuggestionHovered = 'suggestionHovered'
}

export class SuggestionsList implements ISelectableItemsContainer<Suggestion, SuggestionsListDirection> {
  public static SuggestionIdPrefix = 'magic-box-suggestion-';

  private static setItemIdOfElement(element: HTMLElement, id: number) {
    element.id = this.SuggestionIdPrefix + id.toString();
  }

  private static getItemIdFromElement(element: HTMLElement) {
    const strId = element.id.substr(this.SuggestionIdPrefix.length);
    return strId ? parseInt(strId, 10) : null;
  }

  private root: HTMLElement;
  private suggestionsContainer?: {
    results: Dom;
  } = null;
  private options: ISuggestionsListOptions;
  private activeSuggestions: IActiveSuggestion[] = [];
  private keyboardSelectionMode = false;

  constructor(private parentContainer: HTMLElement, options: ISuggestionsListOptions = {}) {
    this.options = defaults(options, <ISuggestionsListOptions>{
      selectableClass: 'magic-box-suggestion',
      selectedClass: 'magic-box-selected',
      timeout: 500
    });
    this.buildSuggestionsListContainer();
  }

  public isHoverKeyboardControlled() {
    return this.keyboardSelectionMode;
  }

  public setDisplayedItems(suggestions: Suggestion[]) {
    this.clearDisplayedItems();
    suggestions.forEach(suggestion =>
      this.appendSuggestion({
        ...suggestion,
        dom: suggestion.dom ? this.modifyDOMFromExistingSuggestion(suggestion) : this.createDOMFromSuggestion(suggestion)
      })
    );
  }

  public getHoveredItem() {
    if (this.activeSuggestions.length === 0) {
      return null;
    }
    const suggestionId = this.getHoveredItemId();
    return this.activeSuggestions[suggestionId] || null;
  }

  public tryHoverOnFirstItem() {
    if (this.activeSuggestions.length === 0) {
      return (this.keyboardSelectionMode = false);
    }
    this.setHoveredItemFromId(0);
    return (this.keyboardSelectionMode = true);
  }

  public tryHoverOnNextItem(direction: SuggestionsListDirection) {
    const currentSelectionId = this.getHoveredItemId();
    if (currentSelectionId === null) {
      return false;
    }
    if (direction === SuggestionsListDirection.Down) {
      if (currentSelectionId === this.activeSuggestions.length - 1) {
        return false;
      }
      this.setHoveredItemFromId(currentSelectionId + 1);
      this.keyboardSelectionMode = true;
      return true;
    } else {
      if (currentSelectionId === 0) {
        return false;
      }
      this.setHoveredItemFromId(currentSelectionId - 1);
      this.keyboardSelectionMode = true;
      return true;
    }
  }

  public clearHover() {
    const currentSelection = this.getHoveredItemElement();
    if (!currentSelection) {
      return;
    }
    this.deselectElement(currentSelection);
    $$(this.root).trigger(SuggestionsListEvents.SuggestionHovered, <ISuggestionHoveredEventArgs>{
      suggestion: null
    });
  }

  public keyboardSelect() {
    if (!this.keyboardSelectionMode) {
      return null;
    }
    const selection = this.getHoveredItem();
    if (!selection) {
      return null;
    }
    this.clearHover();
    $$(selection.dom).trigger('keyboardSelect');
    return selection as Suggestion;
  }

  private buildSuggestionsListContainer() {
    const results = $$('div', {
      className: 'coveo-magicbox-suggestions',
      id: 'coveo-magicbox-suggestions',
      role: 'listbox'
    });
    this.suggestionsContainer = {
      results
    };
    this.parentContainer.appendChild(results.el);
  }

  private getHoveredItemElement() {
    const selectedElements = this.suggestionsContainer.results.findClass(this.options.selectedClass);
    if (selectedElements.length !== 1) {
      return null;
    }
    return selectedElements[0];
  }

  private setHoveredItemFromElement(element: HTMLElement) {
    this.clearHover();
    if (!element) {
      return;
    }
    element.classList.add(this.options.selectedClass);
    $$(this.root).trigger(SuggestionsListEvents.SuggestionHovered, <ISuggestionHoveredEventArgs>{
      suggestion: this.activeSuggestions[SuggestionsList.getItemIdFromElement(element)]
    });
  }

  private getHoveredItemId() {
    const element = this.getHoveredItemElement();
    if (!element) {
      return null;
    }
    return SuggestionsList.getItemIdFromElement(element);
  }

  private setHoveredItemFromId(id: number) {
    this.setHoveredItemFromElement(this.activeSuggestions[id].dom);
  }

  private deselectElement(element: HTMLElement) {
    this.keyboardSelectionMode = false;
    element.classList.remove(this.options.selectedClass);
  }

  private clearDisplayedItems() {
    this.keyboardSelectionMode = false;
    if (this.activeSuggestions) {
      this.activeSuggestions.forEach(preview => preview.deactivate());
    }
    this.activeSuggestions = [];
    if (this.suggestionsContainer) {
      this.suggestionsContainer.results.empty();
    }
  }

  private createDOMFromSuggestion(suggestion: Suggestion): HTMLElement {
    const dom = $$('div', {
      classList: ['magic-box-suggestion', this.options.selectableClass]
    }).el;
    if (suggestion.html) {
      dom.innerHTML = suggestion.html;
      return dom;
    }
    if (suggestion.text) {
      dom.innerText = suggestion.text;
    }
    return dom;
  }

  private modifyDOMFromExistingSuggestion(suggestion: Suggestion): HTMLElement {
    const dom = suggestion.dom.cloneNode(true) as HTMLElement;
    this.deselectElement(dom);
    $$(dom)
      .findClass(this.options.selectableClass)
      .forEach(selectable => this.deselectElement(selectable as HTMLElement));
    return dom;
  }

  private appendSuggestion(suggestion: Suggestion) {
    SuggestionsList.setItemIdOfElement(suggestion.dom, this.activeSuggestions.length);
    suggestion.dom.setAttribute('role', 'option');
    const events: { name: string; funct: (e: Event) => void }[] = [
      {
        name: 'mouseover',
        funct: () => {
          this.keyboardSelectionMode = false;
          this.setHoveredItemFromElement(suggestion.dom);
        }
      },
      {
        name: 'mouseout',
        funct: () => {
          this.deselectElement(suggestion.dom);
        }
      },
      {
        name: 'keyboardSelect',
        funct: () => suggestion.onSelect && suggestion.onSelect()
      }
    ];
    events.forEach(event => $$(suggestion.dom).on(event.name, event.funct));
    const activeSuggestion: IActiveSuggestion = {
      ...suggestion,
      deactivate: () => events.forEach(event => suggestion.dom.removeEventListener(event.name, event.funct))
    };
    if (suggestion.separator) {
      suggestion.dom.classList.add('magic-box-suggestion-seperator');
      const suggestionLabel = $$(
        'div',
        {
          className: 'magic-box-suggestion-seperator-label'
        },
        suggestion.separator
      );
      suggestion.dom.appendChild(suggestionLabel.el);
    }
    this.activeSuggestions.push(activeSuggestion);
    this.suggestionsContainer.results.append(suggestion.dom);
  }
}
