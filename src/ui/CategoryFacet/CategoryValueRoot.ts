import { CategoryValueParent, CategoryValue } from './CategoryValue';
import { CategoryFacetTemplates } from './CategoryFacetTemplates';
import { Dom } from '../../utils/Dom';
import { CategoryChildrenValueRenderer } from './CategoryValueChildrenRenderer';
import { CategoryFacet } from './CategoryFacet';
import { QueryEvents, IBuildingQueryEventArgs, IQuerySuccessEventArgs } from '../../events/QueryEvents';
import { each, last, find } from 'underscore';
import { ICategoryFacetValue } from '../../rest/CategoryFacetValue';

export class CategoryValueRoot implements CategoryValueParent {
  private positionInQuery: number;
  private activePath: string[] = [];
  public categoryChildrenValueRenderer: CategoryChildrenValueRenderer;

  constructor(element: Dom, categoryFacetTemplates: CategoryFacetTemplates, private categoryFacet: CategoryFacet) {
    this.categoryChildrenValueRenderer = new CategoryChildrenValueRenderer(element, categoryFacetTemplates, this, categoryFacet);
    this.categoryFacet.bind.onRootElement<IBuildingQueryEventArgs>(QueryEvents.buildingQuery, args => this.handleBuildingQuery(args));
    this.categoryFacet.bind.onRootElement<IQuerySuccessEventArgs>(QueryEvents.querySuccess, args => this.handleQuerySuccess(args));
  }

  public setActivePath(path: string[]) {
    this.activePath = path;
  }

  public handleBuildingQuery(args: IBuildingQueryEventArgs) {
    this.positionInQuery = this.categoryFacet.categoryFacetQueryController.putCategoryFacetInQueryBuilder(
      args.queryBuilder,
      this.activePath
    );
  }

  public handleQuerySuccess(args: IQuerySuccessEventArgs) {
    const categoryFacetResult = args.results.categoryFacets[this.positionInQuery];
    if (categoryFacetResult.notImplemented) {
      this.notImplementedError();
    } else if (categoryFacetResult.values.length != 0) {
      const sortedParentValues = this.sortParentValues(categoryFacetResult.parentValues);
      this.categoryFacet.show();
      this.clear();

      let currentParentValue: CategoryValueParent;
      currentParentValue = this;
      each(sortedParentValues, categoryFacetParentValue => {
        currentParentValue = currentParentValue.renderAsParent(categoryFacetParentValue);
      });
      currentParentValue.categoryChildrenValueRenderer.renderChildren(categoryFacetResult.values);
    } else if (categoryFacetResult.parentValues.length != 0) {
      this.clear();
      const sortedParentValues = this.sortParentValues(categoryFacetResult.parentValues);
      let currentParentValue: CategoryValueParent = this;
      each(sortedParentValues.slice(0, sortedParentValues.length - 1), categoryFacetParentValue => {
        currentParentValue = currentParentValue.renderAsParent(categoryFacetParentValue);
      });
      currentParentValue.renderChildren([last(sortedParentValues)]);
    } else {
      this.categoryFacet.hide();
    }
  }

  public renderChildren(values: ICategoryFacetValue[]) {
    this.categoryChildrenValueRenderer.renderChildren(values);
  }

  public renderAsParent(value: ICategoryFacetValue) {
    return this.categoryChildrenValueRenderer.renderAsParent(value);
  }

  public hideChildrenExceptOne(categoryValue: CategoryValue) {
    this.categoryChildrenValueRenderer.clearChildrenExceptOne(categoryValue);
  }

  public getPath(partialPath: string[] = []) {
    return partialPath;
  }

  public getChildren() {
    return this.categoryChildrenValueRenderer.getChildren();
  }

  public clear() {
    this.categoryChildrenValueRenderer.getListOfChildValues().detach();
    this.categoryChildrenValueRenderer.clearChildren();
  }

  private notImplementedError() {
    const errorMessage = 'Category Facets are not supported by your current search endpoint. Disabling this component.';
    this.categoryFacet.logger.error(errorMessage);
    this.categoryFacet.disable();
  }

  private sortParentValues(parentValues: ICategoryFacetValue[]) {
    if (this.activePath.length != parentValues.length) {
      this.categoryFacet.logger.warn(
        'Inconsistent CategoryFacet results: Number of parent values results does not equal length of active path'
      );
      return parentValues;
    }

    const sortedParentvalues = [];
    for (const pathElement of this.activePath) {
      const currentParentValue = find(parentValues, parentValue => parentValue.value == pathElement);
      if (!currentParentValue) {
        this.categoryFacet.logger.warn('Inconsistent CategoryFacet results: path not consistent with parent values results');
        return parentValues;
      }
      sortedParentvalues.push(currentParentValue);
    }
    return sortedParentvalues;
  }
}
