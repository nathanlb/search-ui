import { Dom, $$ } from '../utils/Dom';
import { Suggestion } from './SuggestionsManager';
import { Component } from '../ui/Base/Component';

export enum SuggestionsListDirection {
  Up = 'Up',
  Down = 'Down'
}

export interface ISuggestion {
  text: string;
  element: HTMLElement;
}

interface IActiveSuggestion extends ISuggestion {
  deactivate: () => void;
}

export interface ISuggestionsListOptions {
  selectableClass: string;
  selectedClass: string;
}

export enum SuggestionsListEvents {
  SuggestionFocused = 'suggestionFocused',
  SuggestionBlurred = 'suggestionBlurred'
}

export class SuggestionsList {
  private root: HTMLElement;
  private suggestionsContainer: Dom;
  private options: ISuggestionsListOptions;
  private activeSuggestions: IActiveSuggestion[] = [];
  private suggestionIdPrefix = 'magic-box-suggestion-';

  public get focusedSuggestion() {
    if (this.activeSuggestions.length === 0) {
      return null;
    }
    const suggestionId = this.getFocusPosition();
    return this.activeSuggestions[suggestionId] || null;
  }

  constructor(private parentContainer: HTMLElement, options: Partial<ISuggestionsListOptions> = {}) {
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

  public displaySuggestions(suggestions: Suggestion[]) {
    this.clearDisplayedSuggestions();
    if (suggestions.length === 0) {
      this.appendEmptySuggestion();
      return;
    }
    this.activeSuggestions = suggestions.map((suggestion, id) => this.buildSuggestion(suggestion, id));
    this.activeSuggestions.forEach(suggestion => this.suggestionsContainer.append(suggestion.element));
    return this.activeSuggestions as ISuggestion[];
  }

  public focusFirstSuggestion() {
    if (this.activeSuggestions.length === 0) {
      return;
    }
    this.focusAtPosition(0);
  }

  public focusNextSuggestion(direction: SuggestionsListDirection) {
    const currentSelectionId = this.getFocusPosition();
    if (currentSelectionId === null) {
      return;
    }
    const suggestionsLength = this.activeSuggestions.length;
    if (suggestionsLength === 1) {
      return;
    }
    const selectionIdIncrement = direction === SuggestionsListDirection.Down ? 1 : -1;
    this.focusAtPosition((currentSelectionId + selectionIdIncrement) % suggestionsLength);
  }

  public blurFocusedSuggestion() {
    const oldFocusedSuggestion = this.focusedSuggestion;
    if (!oldFocusedSuggestion) {
      return;
    }
    this.blurElement(oldFocusedSuggestion.element);
    $$(this.root).trigger(SuggestionsListEvents.SuggestionBlurred, oldFocusedSuggestion);
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

  private getFocusPosition() {
    const focusedElements = this.suggestionsContainer.findClass(this.options.selectedClass);
    if (focusedElements.length !== 1) {
      return null;
    }
    return this.getSuggestionIdFromElement(focusedElements[0]);
  }

  private focusAtPosition(position: number) {
    this.focusElement(this.activeSuggestions[position].element);
  }

  private focusElement(element: HTMLElement) {
    this.blurFocusedSuggestion();
    element.classList.add(this.options.selectedClass);
    element.setAttribute('aria-selected', 'true');
    $$(this.root).trigger(SuggestionsListEvents.SuggestionFocused, this.activeSuggestions[this.getSuggestionIdFromElement(element)]);
  }

  private blurElement(element: HTMLElement) {
    element.classList.remove(this.options.selectedClass);
    element.setAttribute('aria-selected', 'false');
  }

  private clearDisplayedSuggestions() {
    this.activeSuggestions.forEach(suggestion => suggestion.deactivate());
    this.activeSuggestions = [];
    this.suggestionsContainer.empty();
  }

  private buildSuggestionElement(suggestion: Suggestion): HTMLElement {
    if (suggestion.dom) {
      const newElement = suggestion.dom.cloneNode(true) as HTMLElement;
      this.blurElement(newElement);
      $$(newElement)
        .findClass(this.options.selectableClass)
        .forEach(selectable => this.blurElement(selectable as HTMLElement));
      newElement.classList.add(this.options.selectableClass);
      return newElement;
    }
    const newElement = $$('div', {
      class: `magic-box-suggestion ${this.options.selectableClass}`
    }).el;
    if (suggestion.html) {
      newElement.innerHTML = suggestion.html;
    } else if (suggestion.text) {
      newElement.innerText = suggestion.text;
    }
    return newElement;
  }

  private buildSuggestion(providedSuggestion: Suggestion, id: number): IActiveSuggestion {
    const element = this.buildSuggestionElement(providedSuggestion);
    this.setSuggestionIdOfElement(element, id);
    element.setAttribute('role', 'option');
    element.setAttribute('aria-selected', 'false');
    const text = $$(element).text();
    element.setAttribute('aria-label', text);
    const events: { name: string; funct: (e: Event) => void }[] = [
      {
        name: 'mouseover',
        funct: () => this.focusElement(element)
      },
      {
        name: 'mouseout',
        funct: () => this.blurElement(element)
      },
      {
        name: 'keyboardSelect',
        funct: () => providedSuggestion.onSelect && providedSuggestion.onSelect()
      }
    ];
    events.forEach(event => $$(element).on(event.name, event.funct));
    return {
      element,
      text,
      deactivate: () => events.forEach(event => element.removeEventListener(event.name, event.funct))
    };
  }

  private appendEmptySuggestion() {
    this.suggestionsContainer.append($$('div', { role: 'option' }).el);
  }
}
