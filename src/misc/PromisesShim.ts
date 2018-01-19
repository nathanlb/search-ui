declare global {
  interface Window {
    Promise: typeof Promise;
  }
}

/* istanbul ignore next */
export function shim() {
  const doShim = (promiseInstance: typeof Promise) => {
    if (typeof promiseInstance.prototype['finally'] != 'function') {
      promiseInstance.prototype['finally'] = function finallyPolyfill(callback: () => any) {
        let constructor = this.constructor as typeof Promise;
        return this.then(
          function(value: any) {
            return constructor.resolve(callback()).then(function() {
              return value;
            });
          },
          function(reason: any) {
            return constructor.resolve(callback()).then(function() {
              throw reason;
            });
          }
        );
      };
    }

    let rethrowError = (self: Promise<any>) => {
      self.then(null, function(err) {
        setTimeout(function() {
          throw err;
        }, 0);
      });
    };

    if (typeof promiseInstance.prototype['done'] !== 'function') {
      promiseInstance.prototype['done'] = function(onFulfilled: () => any, onRejected: () => any) {
        let self = arguments.length ? this.then.apply(this, arguments) : this;
        rethrowError(self);
        return this;
      };
    }

    if (typeof promiseInstance.prototype['fail'] !== 'function') {
      promiseInstance.prototype['fail'] = function(onFulfilled: () => any, onRejected: () => any) {
        let self = arguments.length ? this.catch.apply(this, arguments) : this;
        rethrowError(self);
        return this;
      };
    }
  };

  const globalPromise = window['Promise'];
  const localPromise = Promise;
  if (globalPromise) {
    doShim(globalPromise);
  }
  if (localPromise) {
    doShim(localPromise);
  }
}
