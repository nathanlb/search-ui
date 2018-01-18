import { IEndpointError } from './EndpointError';
import { IErrorResponse } from './EndpointCaller';
import { Assert } from '../misc/Assert';

export class QueryError implements IEndpointError {
  public status: number;
  public message: string;
  public type: string;
  public queryExecutionReport: any;
  public name: string;

  constructor(errorResponse: IErrorResponse) {
    const nonNullData = {
      message: 'NoMessage',
      type: 'NoType',
      executionReport: '',
      ...errorResponse.data
    };

    this.status = errorResponse.statusCode;
    this.message = nonNullData.message;
    this.name = nonNullData.type;
    this.queryExecutionReport = nonNullData.executionReport;

    Assert.isNumber(this.status);
    Assert.isNonEmptyString(this.message);
    Assert.isNonEmptyString(this.type);
  }
}
