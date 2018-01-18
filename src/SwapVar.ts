import * as _ from 'underscore';

// Webpack output a library target with a temporary name.
// It does not take care of merging the namespace if the global variable already exists.
// If another piece of code in the page use the Coveo namespace (eg: extension), then they get overwritten
// This code swap the current module to the "real" Coveo variable, without overwriting the whole global var.

declare global {
  interface Window {
    Coveo: any;
    __extends: (child: any, parent: any) => void;
  }
}

export function swapVar(scope: any) {
  if (window.Coveo == undefined) {
    window.Coveo = scope;
  } else {
    _.each(_.keys(scope), k => {
      window.Coveo[k] = scope[k];
    });
  }
  if (window.__extends == undefined) {
    var __extends = function(d: any, b: any) {
      for (var p in b) {
        if (b.hasOwnProperty(p)) {
          d[p] = b[p];
        }
      }
      function __() {
        (<any>this).constructor = d;
      }

      d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
    };
    window.__extends = __extends;
  }
}
