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

export interface IQuerySuggestPreview {
  numberOfPreviewResults?: number;
  resultTemplate?: Template;
  executeQueryDelay: number;
}

export class QuerySuggestPreview extends Component implements IComponentBindings {
  static ID = 'QuerySuggestPreview';

  static doExport = () => {
    exportGlobally({
      QuerySuggestPreview: QuerySuggestPreview
    });
  };

  static wait(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return new Promise(resolve => setTimeout(() => resolve(), ms));
  }

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
    }),
    /**
     *  The amount of focus time (in milliseconds) required on a query suggestion before requesting a preview of its top results.
     *
     * **Default:** `200`
     */
    executeQueryDelay: ComponentOptions.buildNumberOption({ defaultValue: 200 })
  };

  private lastQueriedSuggestion: Suggestion;
  private lastTimer: Promise<void>;
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
      this.logger.warn(
        `Specifying a result template is required for the 'QuerySuggestPreview' component to work properly. See `,
        `https://docs.coveo.com/340/#providing-query-suggestion-result-previews`
      );
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
    const timer = (this.lastTimer = QuerySuggestPreview.wait(this.options.executeQueryDelay));
    await timer;
    if (this.lastTimer !== timer || suggestion.text.length === 0) {
      return [];
    }
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
