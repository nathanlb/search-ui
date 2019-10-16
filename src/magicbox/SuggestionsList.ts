import { Dom, $$ } from '../utils/Dom';
import { Suggestion } from './SuggestionsManager';
import { Component } from '../ui/Base/Component';

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

export enum SuggestionsListEvents {
  SuggestionFocused = 'suggestionFocused',
  SuggestionBlurred = 'suggestionBlurred'
}

export class SuggestionsList {
  private root: HTMLElement;
  private suggestionsContainer: Dom;
  private options: ISuggestionsListOptions;
  private displayedSuggestions: IActiveSuggestion[] = [];
  private keyboardSelectionMode = false;
  private suggestionIdPrefix = 'magic-box-suggestion-';

  public get isFocusKeyboardControlled() {
    return this.keyboardSelectionMode;
  }

  public get focusedSuggestion() {
    if (this.displayedSuggestions.length === 0) {
      return null;
    }
    const suggestionId = this.getFocusedSuggestionPosition();
    return this.displayedSuggestions[suggestionId] || null;
  }

  constructor(private parentContainer: HTMLElement, options: ISuggestionsListOptions = {}) {
    this.root = Component.resolveRoot(parentContainer);
    this.options = {
      selectableClass: 'magic-box-suggestion',
      selectedClass: 'magic-box-selected',
      ...options
    };
    this.buildSuggestionsListContainer();
    this.appendEmptySuggestion();
  }

  public bindOnSuggestionFocused(binding: (e: Event, focusedSuggestion: Suggestion) => void) {
    $$(this.root).on(SuggestionsListEvents.SuggestionFocused, binding);
  }

  public bindOnSuggestionBlurred(binding: (e: Event, oldFocusedSuggestion: Suggestion) => void) {
    $$(this.root).on(SuggestionsListEvents.SuggestionBlurred, binding);
  }

  public setDisplayedSuggestions(suggestions: Suggestion[]) {
    this.clearDisplayedSuggestions();
    if (suggestions.length === 0) {
      this.appendEmptySuggestion();
      return;
    }
    suggestions.forEach(suggestion =>
      this.appendSuggestion({
        ...suggestion,
        dom: suggestion.dom ? this.modifyDOMFromExistingSuggestion(suggestion) : this.createDOMFromSuggestion(suggestion)
      })
    );
  }

  public focusFirstSuggestion() {
    if (this.displayedSuggestions.length === 0) {
      return;
    }
    this.setFocusedSuggestionFromPosition(0);
    this.keyboardSelectionMode = true;
  }

  public focusNextSuggestion(direction: SuggestionsListDirection) {
    const currentSelectionId = this.getFocusedSuggestionPosition();
    if (currentSelectionId === null) {
      return;
    }
    const suggestionsLength = this.displayedSuggestions.length;
    if (suggestionsLength === 1) {
      return;
    }
    const selectionIdIncrement = direction === SuggestionsListDirection.Down ? 1 : -1;
    this.setFocusedSuggestionFromPosition((currentSelectionId + selectionIdIncrement) % suggestionsLength);
    this.keyboardSelectionMode = true;
  }

  public blurFocusedSuggestion() {
    const oldFocusedSuggestion = this.focusedSuggestion;
    if (!oldFocusedSuggestion) {
      return;
    }
    this.blurElement(oldFocusedSuggestion.dom);
    $$(this.root).trigger(SuggestionsListEvents.SuggestionBlurred, oldFocusedSuggestion);
  }

  public selectKeyboardFocusedSuggestion() {
    if (!this.keyboardSelectionMode) {
      return null;
    }
    const selection = this.focusedSuggestion;
    if (!selection) {
      return null;
    }
    this.blurFocusedSuggestion();
    $$(selection.dom).trigger('keyboardSelect');
    return selection as Suggestion;
  }

  private buildSuggestionsListContainer() {
    this.suggestionsContainer = $$('div', {
      className: 'coveo-magicbox-suggestions',
      id: 'coveo-magicbox-suggestions',
      role: 'listbox'
    });
    this.parentContainer.appendChild(this.suggestionsContainer.el);
  }

  private setSuggestionIdOfElement(element: HTMLElement, id: number) {
    element.id = this.suggestionIdPrefix + id.toString();
  }

  private getSuggestionIdFromElement(element: HTMLElement) {
    const strId = element.id.substr(this.suggestionIdPrefix.length);
    return strId ? parseInt(strId, 10) : null;
  }

  private setFocusedSuggestionFromElement(element: HTMLElement) {
    this.blurFocusedSuggestion();
    element.classList.add(this.options.selectedClass);
    $$(this.root).trigger(SuggestionsListEvents.SuggestionFocused, this.displayedSuggestions[this.getSuggestionIdFromElement(element)]);
  }

  private getFocusedSuggestionPosition() {
    const focusedElements = this.suggestionsContainer.findClass(this.options.selectedClass);
    if (focusedElements.length !== 1) {
      return null;
    }
    return this.getSuggestionIdFromElement(focusedElements[0]);
  }

  private setFocusedSuggestionFromPosition(id: number) {
    this.setFocusedSuggestionFromElement(this.displayedSuggestions[id].dom);
  }

  private blurElement(element: HTMLElement) {
    this.keyboardSelectionMode = false;
    element.classList.remove(this.options.selectedClass);
  }

  private clearDisplayedSuggestions() {
    this.keyboardSelectionMode = false;
    this.displayedSuggestions.forEach(suggestion => suggestion.deactivate());
    this.displayedSuggestions = [];
    this.suggestionsContainer.empty();
  }

  private createDOMFromSuggestion(suggestion: Suggestion): HTMLElement {
    const dom = $$('div', {
      class: `magic-box-suggestion ${this.options.selectableClass}`
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
    this.blurElement(dom);
    $$(dom)
      .findClass(this.options.selectableClass)
      .forEach(selectable => this.blurElement(selectable as HTMLElement));
    dom.classList.add(this.options.selectableClass);
    return dom;
  }

  private appendSuggestion(suggestion: Suggestion) {
    this.setSuggestionIdOfElement(suggestion.dom, this.displayedSuggestions.length);
    suggestion.dom.setAttribute('role', 'option');
    const events: { name: string; funct: (e: Event) => void }[] = [
      {
        name: 'mouseover',
        funct: () => {
          this.keyboardSelectionMode = false;
          this.setFocusedSuggestionFromElement(suggestion.dom);
        }
      },
      {
        name: 'mouseout',
        funct: () => {
          this.blurElement(suggestion.dom);
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
    this.displayedSuggestions.push(activeSuggestion);
    this.suggestionsContainer.append(suggestion.dom);
  }

  private appendEmptySuggestion() {
    this.suggestionsContainer.append($$('div', { role: 'option' }).el);
  }
}
