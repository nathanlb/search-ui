import { IComponentBindings } from '../Base/ComponentBindings';
import { exportGlobally } from '../../GlobalExports';
import { ComponentOptions, Initialization, $$, Component } from '../../Core';
import { IQueryResults } from '../../rest/QueryResults';
import { Template } from '../Templates/Template';
import { TemplateComponentOptions } from '../Base/TemplateComponentOptions';
import { ITemplateToHtml, TemplateToHtml } from '../Templates/TemplateToHtml';
import { ResultLink } from '../ResultLink/ResultLink';
import { OmniboxAnalytics } from '../Omnibox/OmniboxAnalytics';
import {
  IAnalyticsOmniboxSuggestionMeta,
  analyticsActionCauseList,
  IAnalyticsClickQuerySuggestPreviewMeta
} from '../Analytics/AnalyticsActionListMeta';
import { SuggestionsManagerEvents, IPopulateSearchResultPreviewsEventArgs, Suggestion } from '../../magicbox/SuggestionsManager';
import { IProvidedSearchResultPreview } from '../../magicbox/ResultPreviewsGrid';
import { HtmlTemplate } from '../Templates/HtmlTemplate';

export interface IQuerySuggestPreview {
  numberOfPreviewResults?: number;
  resultTemplate?: Template;
}

export function createDefaultSearchResultPreviewTemplate() {
  return HtmlTemplate.create(
    $$(
      'script',
      { className: 'result-template', type: 'text/html' },
      $$(
        'div',
        { className: 'coveo-result-frame coveo-default-result-preview' },
        $$('div', { className: 'CoveoImageFieldValue', 'data-field': '@ccimage' }),
        $$('a', { className: 'CoveoResultLink' })
      )
    ).el
  );
}

export class QuerySuggestPreview extends Component implements IComponentBindings {
  static ID = 'QuerySuggestPreview';

  static doExport = () => {
    exportGlobally({
      QuerySuggestPreview: QuerySuggestPreview
    });
  };

  static options: IQuerySuggestPreview = {
    resultTemplate: TemplateComponentOptions.buildTemplateOption(),
    /**
     * The maximum number of query results to render in the preview.
     *
     * **Minimum:** `1`
     * **Maximum:** `6`
     * **Default:** `3`
     */
    numberOfPreviewResults: ComponentOptions.buildNumberOption({
      defaultValue: 3,
      min: 1,
      max: 6
    })
  };

  private lastQueriedSuggestion: Suggestion;
  private omniboxAnalytics: OmniboxAnalytics;

  /**
   * Creates a new QuerySuggestPreview component.
   * @param element The HTMLElement on which to instantiate the component.
   * @param options The options for the QuerySuggestPreview component.
   * @param bindings The bindings that the component requires to function normally. If not set, these will be
   * automatically resolved (with a slower execution time).
   */
  constructor(public element: HTMLElement, public options?: IQuerySuggestPreview, public bindings?: IComponentBindings) {
    super(element, QuerySuggestPreview.ID, bindings);

    this.options = ComponentOptions.initComponentOptions(element, QuerySuggestPreview, options);

    if (!this.options.resultTemplate) {
      this.options.resultTemplate = createDefaultSearchResultPreviewTemplate();
    }

    this.bind.onRootElement(SuggestionsManagerEvents.PopulateSearchResultPreviews, (args: IPopulateSearchResultPreviewsEventArgs) =>
      this.populateSearchResultPreviews(args)
    );

    this.omniboxAnalytics = this.searchInterface.getOmniboxAnalytics();
  }

  private get templateToHtml() {
    const templateToHtmlArgs: ITemplateToHtml = {
      searchInterface: this.searchInterface,
      queryStateModel: this.queryStateModel,
      resultTemplate: this.options.resultTemplate
    };
    return new TemplateToHtml(templateToHtmlArgs);
  }

  private populateSearchResultPreviews(args: IPopulateSearchResultPreviewsEventArgs) {
    args.previewQueries.push(this.fetchSearchResultPreviews(args.suggestion));
  }

  private async fetchSearchResultPreviews(suggestion: Suggestion) {
    this.lastQueriedSuggestion = suggestion;
    const previousQueryOptions = this.queryController.getLastQuery();
    previousQueryOptions.q = this.lastQueriedSuggestion.text;
    previousQueryOptions.numberOfResults = this.options.numberOfPreviewResults;
    this.logShowQuerySuggestPreview();
    const results = await this.queryController.getEndpoint().search(previousQueryOptions);
    if (!results) {
      return [];
    }
    return this.buildResultsPreviews(results);
  }

  private async buildResultsPreviews(results: IQueryResults) {
    const previewElements = await this.templateToHtml.buildResults(results, 'preview', []);
    if (previewElements.length === 0) {
      return [];
    }
    return previewElements.map((element, index) => this.buildSearchResultPreview(element, index));
  }

  private buildSearchResultPreview(element: HTMLElement, rank: number): IProvidedSearchResultPreview {
    $$(element).addClass('coveo-preview-selectable');
    return {
      inactiveElement: element,
      onSelect: () => this.handleSelect(element, rank)
    };
  }

  private handleSelect(element: HTMLElement, rank: number) {
    this.logClickQuerySuggestPreview(rank, element);
    const link = $$(element).find(Component.computeSelectorForType('ResultLink'));
    if (link) {
      const resultLink = <ResultLink>Component.get(link);
      resultLink.openLink();
    } else {
      element.click();
    }
  }

  private logShowQuerySuggestPreview() {
    this.usageAnalytics.logSearchEvent<IAnalyticsOmniboxSuggestionMeta>(
      analyticsActionCauseList.showQuerySuggestPreview,
      this.omniboxAnalytics.buildCustomDataForPartialQueries()
    );
  }

  private logClickQuerySuggestPreview(displayedRank: number, element: HTMLElement) {
    this.usageAnalytics.logCustomEvent<IAnalyticsClickQuerySuggestPreviewMeta>(
      analyticsActionCauseList.clickQuerySuggestPreview,
      {
        suggestion: this.lastQueriedSuggestion.text,
        displayedRank
      },
      element
    );
  }
}

Initialization.registerAutoCreateComponent(QuerySuggestPreview);
