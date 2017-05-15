import { $$ } from '../../utils/Dom';
import { Assert } from '../../misc/Assert';
import { Utils } from '../../utils/Utils';
import * as _ from 'underscore';

export interface IPreferencePanelInputToBuild {
  label: string;
  placeholder?: string;
  tab?: string[];
  expression?: string;
  otherAttribute?: string;
}

export class PreferencesPanelBoxInput {
  public inputs: { [label: string]: HTMLElement } = {};
  constructor(private boxInputToBuild: IPreferencePanelInputToBuild[], private nameOfInput: string, private type: string) {
  }

  public build(): HTMLElement {
    return _.reduce(_.map(this.boxInputToBuild, (toBuild) => {
      let choiceContainer = $$('div', {
        className: 'coveo-choice-container'
      });

      let sectionInput = $$('div', {
        className: 'coveo-section coveo-section-input'
      });

      let input = $$('input', {
        className: `coveo-${toBuild.label}`,
        id: `coveo-${toBuild.label}`,
        type: this.type,
        name: this.nameOfInput,
        value: toBuild.label
      });

      if (toBuild.otherAttribute) {
        input.setAttribute(toBuild.otherAttribute, toBuild.otherAttribute);
      }

      let inputIcon = $$('span', {
        className: 'coveo-input-icon'
      });

      let label = $$('label', {
        className: 'coveo-preferences-panel-item-label',
        'for': `coveo-${toBuild.label}`,
      });
      label.text(toBuild.label);

      sectionInput.append(input.el);
      sectionInput.append(inputIcon.el);
      sectionInput.append(label.el);

      let sectionTab = $$('div', {
        className: 'coveo-section coveo-section-tab'
      });
      if (toBuild.tab) {
        sectionTab.text(toBuild.tab.join(' '));
      }
      let sectionExpression = $$('div', {
        className: 'coveo-section coveo-section-expression'
      });
      sectionExpression.text(toBuild.expression);

      choiceContainer.append(sectionInput.el);
      choiceContainer.append(sectionTab.el);
      choiceContainer.append(sectionExpression.el);
      this.inputs[toBuild.label] = $$('div', undefined, choiceContainer).el;
      return this.inputs[toBuild.label];
    }), (memo: HTMLElement, input: HTMLElement) => {
      memo.appendChild(input);
      return memo;
    }, $$('div').el);
  }

  public select(toSelect: string) {
    Assert.exists(this.inputs[toSelect]);
    var input = <HTMLInputElement>$$(this.inputs[toSelect]).find('input');
    input.checked = true;
    $$($$(this.inputs[toSelect]).find('.coveo-input-icon')).addClass('coveo-selected');
  }

  public unselect(toUnselect: string) {
    Assert.exists(this.inputs[toUnselect]);
    var input = <HTMLInputElement>$$(this.inputs[toUnselect]).find('input');
    input.checked = false;
    $$($$(this.inputs[toUnselect]).find('.coveo-input-icon')).removeClass('coveo-selected');
  }

  public getSelected(): string {
    var checked = _.find(this.inputs, (el: HTMLElement) => {
      var input = <HTMLInputElement>$$(el).find('input');
      return input.checked;
    });
    return (<HTMLInputElement>$$(checked).find('input')).value;
  }

  public getSelecteds(): string[] {
    var checkeds = _.filter(this.inputs, (el: HTMLElement) => {
      var input = <HTMLInputElement>$$(el).find('input');
      return input.checked;
    });

    return _.map(checkeds, (checked) => {
      return (<HTMLInputElement>$$(checked).find('input')).value;
    });
  }
}

/*export class PreferencesPanelRadioInput extends PreferencesPanelBoxInput {
  constructor(private radioElementToBuild: IPreferencePanelInputToBuild[], private name: string) {
    super(radioElementToBuild, name, 'radio');
  }
}*/


export class PreferencesPanelTextInput {
  public inputs: { [label: string]: HTMLElement } = {};

  constructor(public textElementToBuild: IPreferencePanelInputToBuild[], public name: string) {
  }

  public build(): HTMLElement {
    return _.reduce(_.map(this.textElementToBuild, (toBuild) => {
      let choiceContainer = $$('div', {
        className: 'coveo-choice-container'
      });

      let input = $$('input', {
        className: `coveo-${toBuild.label}`,
        id: `coveo-${toBuild.label}`,
        type: 'text',
        name: this.name,
        placeholder: toBuild.label || toBuild.label
      });

      if (toBuild.otherAttribute) {
        input.setAttribute(toBuild.otherAttribute, toBuild.otherAttribute);
      }

      choiceContainer.append(input.el);

      this.inputs[toBuild.label] = $$('div', undefined, choiceContainer).el;
      return this.inputs[toBuild.label];
    }), (memo: HTMLElement, input: HTMLElement) => {
      memo.appendChild(input);
      return memo;
    }, $$('div').el);
  }

  public getValues(): string[] {
    return _.map(this.inputs, (input, key) => {
      return (<HTMLInputElement>this.getInput(key)).value;
    });
  }

  public setValue(input: string, value: string) {
    Assert.exists(this.inputs[input]);
    (<HTMLInputElement>this.getInput(input)).value = value;
  }

  public reset(): void {
    _.each(this.inputs, (input: HTMLElement) => {
      var inputElement: HTMLInputElement | HTMLTextAreaElement = (<HTMLInputElement>$$(input).find('input'));
      if (!inputElement) {
        inputElement = (<HTMLTextAreaElement>$$(input).find('textarea'));
      }
      inputElement.value = '';
    });
  }

  private getInput(input: string): HTMLElement {
    Assert.exists(this.inputs[input]);
    var found = $$(this.inputs[input]).find('input');
    if (!found) {
      found = $$(this.inputs[input]).find('textarea');
    }
    return found;
  }
}

export class PreferencesPanelTextAreaInput extends PreferencesPanelTextInput {

  public build(): HTMLElement {
    return _.reduce(_.map(this.textElementToBuild, (toBuild) => {
      let choiceContainer = $$('div', {
        className: 'coveo-choice-container'
      });

      let textArea = $$('textarea', {
        className: `coveo-${toBuild.label}`,
        name: `coveo-${toBuild.label}`,
        placeholder: toBuild.label || toBuild.label
      });

      if (toBuild.otherAttribute) {
        textArea.setAttribute(toBuild.otherAttribute, toBuild.otherAttribute);
      }
      choiceContainer.append(textArea.el);

      this.inputs[toBuild.label] = $$('div', undefined, choiceContainer).el;
      return this.inputs[toBuild.label];
    }), (memo: HTMLElement, input: HTMLElement) => {
      memo.appendChild(input);
      return memo;
    }, $$('div').el);
  }
}

export class PreferencePanelMultiSelectInput {
  private textInput: PreferencesPanelTextAreaInput;
  private select: HTMLSelectElement;

  constructor(private toBuild: IPreferencePanelInputToBuild, public options: string[], public name: string) {
    this.textInput = new PreferencesPanelTextAreaInput([{ label: toBuild.label, otherAttribute: 'readonly' }], name);
  }

  public build() {
    this.select = <HTMLSelectElement>$$('select').el;
    this.select.setAttribute('multiple', 'multiple');
    _.each(this.options, (option) => {
      var optEl = $$('option', undefined, option).el;
      this.select.appendChild(optEl);
    });
    $$(this.select).on('change', () => {
      var values: string[] = _.chain(<any>this.select.options)
        .filter((opt: HTMLOptionElement) => {
          return opt.selected;
        })
        .map((opt: HTMLOptionElement) => {
          return opt.value;
        })
        .value();

      if (!Utils.isNullOrUndefined(values) && !Utils.isEmptyArray(values)) {
        this.textInput.setValue(this.toBuild.label, values.join(','));
      } else {
        this.reset();
      }
    });
    var el = this.textInput.build();
    el.appendChild(this.select);
    return el;
  }

  public getValues() {
    return this.textInput.getValues()[0].split(',');
  }

  public setValues(values: string[]) {
    this.textInput.setValue(this.toBuild.label, values.join(','));
  }

  public reset() {
    this.textInput.setValue(this.toBuild.label, '');
  }
}