/// <reference path="../ui/FacetRange/FacetRange.ts" />

import { FacetQueryController } from './FacetQueryController';
import { FacetRange } from '../ui/FacetRange/FacetRange';
import { Utils } from '../utils/Utils';
import { IGroupByRequest } from '../rest/GroupByRequest';

export class FacetRangeQueryController extends FacetQueryController {
  public graphGroupByQueriesIndex: number;

  constructor(public facet: FacetRange) {
    super(facet);
  }

  protected createBasicGroupByRequest(allowedValues?: string[], addComputedField: boolean = true) {
    var groupByQuery = super.createBasicGroupByRequest(undefined, addComputedField);
    groupByQuery.allowedValues = undefined;
    if (Utils.isNonEmptyArray(this.facet.options.ranges)) {
      groupByQuery = this.buildGroupByQueryForPredefinedRanges(groupByQuery);
    } else {
      groupByQuery = this.buildGroupByQueryForAutomaticRanges(groupByQuery);
    }
    return groupByQuery;
  }

  protected createGroupByAllowedValues(): string[] | undefined {
    return undefined;
  }

  private buildGroupByQueryForAutomaticRanges(groupByQuery: IGroupByRequest) {
    groupByQuery.generateAutomaticRanges = true;
    return groupByQuery;
  }

  private buildGroupByQueryForPredefinedRanges(groupByQuery: IGroupByRequest) {
    groupByQuery.rangeValues = this.facet.options.ranges;
    if (this.facet.options.ranges) {
      groupByQuery.maximumNumberOfValues = this.facet.options.ranges.length;
    } else {
      groupByQuery.maximumNumberOfValues = 5;
    }

    return groupByQuery;
  }
}
