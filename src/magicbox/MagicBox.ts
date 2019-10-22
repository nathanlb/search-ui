import { each, find, isUndefined } from 'underscore';
import { KEYBOARD } from '../Core';
import { $$ } from '../utils/Dom';
import { doMagicBoxExport } from './doMagicBoxExport';
import { Grammar } from './Grammar';
import { InputManager } from './InputManager';
import { MagicBoxClear } from './MagicBoxClear';
import { Result } from './Result/Result';
import { Suggestion, SuggestionsManager, FocusableContainerType, IFocusMovement } from './SuggestionsManager';
import { KeyboardUtils } from '../utils/KeyboardUtils';

export interface Options {
  inline?: boolean;
  selectableSuggestionClass?: string;
  selectedSuggestionClass?: string;
  suggestionTimeout?: number;
  querySearchResultPreviewsDelay?: number;
}

export class MagicBoxInstance {
  public onblur: () => void;
  public onfocus: () => void;
  public onchange: () => void;
  public onsuggestions: (suggestions: Suggestion[]) => void;
  public onsubmit: () => void;
  public onselect: (suggestion: Suggestion) => void;
  public onclear: () => void;
  public onmove: () => void;
  public ontabpress: () => void;

  public getSuggestions: () => Array<Promise<Suggestion[]> | Suggestion[]>;

  private inputManager: InputManager;
  private suggestionsManager: SuggestionsManager;
  private magicBoxClear: MagicBoxClear;

  private lastSuggestions: Suggestion[] = [];

  private result: Result;
  private displayedResult: Result;

  constructor(public element: HTMLElement, public grammar: Grammar, public options: Options = {}) {
    if (isUndefined(this.options.inline)) {
      this.options.inline = false;
    }
    $$(element).addClass('magic-box');
    if (this.options.inline) {
      $$(element).addClass('magic-box-inline');
    }

    this.result = this.grammar.parse('');
    this.displayedResult = this.result.clean();

    let inputContainer = $$(element).find('.magic-box-input');
    if (!inputContainer) {
      inputContainer = document.createElement('div');
      inputContainer.className = 'magic-box-input';
      element.appendChild(inputContainer);
    }

    this.inputManager = new InputManager(
      inputContainer,
      (text, wordCompletion) => {
        if (!wordCompletion) {
          this.setText(text);
          this.showSuggestions();
          this.onchange && this.onchange();
        } else {
          this.setText(text);
          this.onselect && this.onselect(this.getFirstSuggestionText());
        }
      },
      this
    );

    this.inputManager.ontabpress = () => {
      this.ontabpress && this.ontabpress();
    };

    const existingValue = this.inputManager.getValue();
    if (existingValue) {
      this.displayedResult.input = existingValue;
    }

    this.inputManager.setResult(this.displayedResult);

    const suggestionsContainer = SuggestionsManager.createContainer();
    this.element.appendChild(suggestionsContainer);

    this.suggestionsManager = new SuggestionsManager(suggestionsContainer, this.element, this.inputManager, {
      selectableSuggestionClass: this.options.selectableSuggestionClass,
      selectedSuggestionClass: this.options.selectedSuggestionClass,
      timeout: this.options.suggestionTimeout,
      querySearchResultPreviewsDelay: this.options.querySearchResultPreviewsDelay
    });

    this.magicBoxClear = new MagicBoxClear(this);
    this.setupHandler();
  }

  public getResult() {
    return this.result;
  }

  public getDisplayedResult() {
    return this.displayedResult;
  }

  public setText(text: string) {
    $$(this.element).toggleClass('magic-box-notEmpty', text.length > 0);
    this.magicBoxClear.toggleTabindexAndAriaHidden(text.length > 0);

    this.result = this.grammar.parse(text);
    this.displayedResult = this.result.clean();

    this.inputManager.setResult(this.displayedResult);
  }

  public setCursor(index: number) {
    this.inputManager.setCursor(index);
  }

  public getCursor() {
    return this.inputManager.getCursor();
  }

  public resultAtCursor(match?: string | { (result: Result): boolean }): Result[] {
    return this.displayedResult.resultAt(this.getCursor(), match);
  }

  private setupHandler() {
    this.inputManager.onblur = () => {
      $$(this.element).removeClass('magic-box-hasFocus');
      this.onblur && this.onblur();
      if (!this.options.inline) {
        this.clearSuggestion();
      }
    };

    this.inputManager.onfocus = () => {
      $$(this.element).addClass('magic-box-hasFocus');
      this.showSuggestions();
      this.onfocus && this.onfocus();
    };

    this.inputManager.onkeydown = (key: number) => {
      if (KeyboardUtils.isArrowKeyPushed(key)) {
        return this.handleKeyboardMovement(key);
      }
      switch (key) {
        case KEYBOARD.ENTER:
          const keyboardSelection = this.suggestionsManager.keyboardSelect();
          if (keyboardSelection.container === FocusableContainerType.None) {
            this.onsubmit && this.onsubmit();
          }
          return false;
        case KEYBOARD.ESCAPE:
          this.clearSuggestion();
          this.blur();
          return true;
        default:
          this.suggestionsManager.blur();
          return true;
      }
    };

    this.inputManager.onkeyup = () => true;

    this.inputManager.onchangecursor = () => {
      this.showSuggestions();
    };
  }

  public async showSuggestions() {
    const suggestions = await this.suggestionsManager.receiveSuggestions(this.getSuggestions != null ? this.getSuggestions() : []);
    if (!suggestions || suggestions.length === 0) {
      return;
    }
    this.updateSuggestions(suggestions);
  }

  public focus() {
    $$(this.element).addClass('magic-box-hasFocus');
    this.inputManager.focus();
  }

  public blur() {
    this.inputManager.blur();
    this.suggestionsManager.isExpanded = false;
  }

  public clearSuggestion() {
    this.inputManager.setWordCompletion(null);
  }

  private handleKeyboardMovement(key: number) {
    if (!this.suggestionsManager.hasSuggestions) {
      return true;
    }
    let movement: IFocusMovement;
    switch (key) {
      case KEYBOARD.UP_ARROW:
        movement = this.suggestionsManager.moveUp();
        break;
      case KEYBOARD.DOWN_ARROW:
        movement = this.suggestionsManager.moveDown();
        break;
      case KEYBOARD.LEFT_ARROW:
        movement = this.suggestionsManager.moveLeft();
        break;
      case KEYBOARD.RIGHT_ARROW:
        movement = this.suggestionsManager.moveRight();
        break;
    }
    if (!movement.handled) {
      return true;
    }
    if (this.onmove) {
      this.onmove();
    }
    this.focusOnSuggestion(movement.focusedSuggestion);
    this.onchange && this.onchange();
    return false;
  }

  private updateSuggestions(suggestions: Suggestion[]) {
    this.lastSuggestions = suggestions;
    const firstSuggestion = this.getFirstSuggestionText();
    this.inputManager.setWordCompletion(firstSuggestion && firstSuggestion.text);
    this.onsuggestions && this.onsuggestions(suggestions);
    each(suggestions, (suggestion: Suggestion) => {
      if (!suggestion.onSelect && suggestion.text) {
        suggestion.onSelect = () => {
          this.setText(suggestion.text);
          this.onselect && this.onselect(suggestion);
        };
      }
    });
  }

  private focusOnSuggestion(suggestion: Suggestion) {
    if (suggestion == null || suggestion.text == null) {
      suggestion = this.getFirstSuggestionText();
      this.inputManager.setResult(this.displayedResult, suggestion && suggestion.text);
    } else {
      this.inputManager.setResult(this.grammar.parse(suggestion.text).clean(), suggestion.text);
    }
  }

  private getFirstSuggestionText(): Suggestion {
    return find(this.lastSuggestions, suggestion => suggestion.text != null);
  }

  public getText() {
    return this.inputManager.getValue();
  }

  public getWordCompletion() {
    return this.inputManager.getWordCompletion();
  }

  public clear() {
    this.setText('');
    this.showSuggestions();
    this.focus();
    this.onclear && this.onclear();
  }

  public hasSuggestions() {
    return this.suggestionsManager.hasSuggestions;
  }
}

export function createMagicBox(element: HTMLElement, grammar: Grammar, options?: Options) {
  return new MagicBoxInstance(element, grammar, options);
}

export function requestAnimationFrame(callback: () => void) {
  if ('requestAnimationFrame' in window) {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(callback);
}

doMagicBoxExport();
