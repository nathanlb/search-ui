import { Assert } from '../misc/Assert';
import { IEndpointError } from '../rest/EndpointError';

export class AjaxError implements IEndpointError {
  public type: string;
  public name: string;

  constructor(public message: string, public status: number) {
    Assert.exists(message);
    Assert.exists(status);
    this.name = this.type = 'Ajax Error (status: ' + status + ')';
  }
}
