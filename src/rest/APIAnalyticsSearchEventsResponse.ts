import { IAPIAnalyticsEventResponse } from './APIAnalyticsEventResponse';

export interface IAPIAnalyticsSearchEventsResponse {
  searchEventResponses: IAPIAnalyticsEventResponse[];
  [propName: string]: any;
}
