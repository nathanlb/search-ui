var localStorage = window.localStorage;
export class LocalStorageUtils<T> {
  constructor(public id: string) {}

  public save(data: T) {
    try {
      if (localStorage != null) {
        localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(data));
      }
    } catch (error) {}
  }

  public load(): T | null {
    try {
      if (localStorage == null) {
        return null;
      }
      var value = localStorage.getItem(this.getLocalStorageKey());
      return value && JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  public remove(key?: string) {
    try {
      if (localStorage != null) {
        if (key == undefined) {
          localStorage.removeItem(this.getLocalStorageKey());
        } else {
          var oldObj: any = this.load();
          if (oldObj) {
            delete oldObj[key];
            this.save(oldObj);
          }
        }
      }
    } catch (error) {}
  }

  private getLocalStorageKey() {
    return 'coveo-' + this.id;
  }
}
