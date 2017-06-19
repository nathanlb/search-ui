webpackJsonpCoveo__temporary([45],{

/***/ 324:
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Component_1 = __webpack_require__(8);
var ComponentOptions_1 = __webpack_require__(9);
var InitializationEvents_1 = __webpack_require__(15);
var Dom_1 = __webpack_require__(3);
var PopupUtils_1 = __webpack_require__(47);
var SettingsEvents_1 = __webpack_require__(38);
var Initialization_1 = __webpack_require__(2);
var _ = __webpack_require__(1);
var GlobalExports_1 = __webpack_require__(4);
__webpack_require__(588);
/**
 * The Settings component renders a **Settings** button that the end user can click to access a popup menu from which
 * it is possible to perform several contextual actions. The usual location of the **Settings** button in the page is to
 * the right of the {@link Searchbox}.
 *
 * This component can reference several components to populate its popup menu:
 * - {@link AdvancedSearch}
 * - {@link ExportToExcel}
 * - {@link PreferencesPanel} (see also {@link ResultsFiltersPreferences} and {@link ResultsPreferences})
 * - {@link SearchAlerts} (see also {@link SearchAlertsMessage})
 * - {@link ShareQuery}
 */
var Settings = (function (_super) {
    __extends(Settings, _super);
    /**
     * Creates a new Settings component.
     * @param element The HTMLElement on which to instantiate the component.
     * @param options The options for the Settings component.
     * @param bindings The bindings that the component requires to function normally. If not set, these will be
     * automatically resolved (with a slower execution time).
     */
    function Settings(element, options, bindings) {
        var _this = _super.call(this, element, Settings.ID, bindings) || this;
        _this.element = element;
        _this.options = options;
        _this.isOpened = false;
        _this.options = ComponentOptions_1.ComponentOptions.initComponentOptions(element, Settings, options);
        _this.bind.onRootElement(InitializationEvents_1.InitializationEvents.afterInitialization, function () { return _this.init(); });
        return _this;
    }
    /**
     * Opens the **Settings** popup menu.
     */
    Settings.prototype.open = function () {
        var _this = this;
        this.isOpened = true;
        if (this.menu != null) {
            Dom_1.$$(this.menu).detach();
        }
        this.menu = this.buildMenu();
        Dom_1.$$(this.menu).on('mouseleave', function () { return _this.mouseleave(); });
        Dom_1.$$(this.menu).on('mouseenter', function () { return _this.mouseenter(); });
        PopupUtils_1.PopupUtils.positionPopup(this.menu, this.element, this.root, this.getPopupPositioning(), this.root);
    };
    /**
     * Closes the **Settings** popup menu.
     */
    Settings.prototype.close = function () {
        this.isOpened = false;
        if (this.menu != null) {
            Dom_1.$$(this.menu).detach();
            this.menu = null;
        }
    };
    Settings.prototype.init = function () {
        var _this = this;
        if (this.searchInterface.isNewDesign()) {
            var square = Dom_1.$$('span', { className: 'coveo-settings-square' }).el;
            var squares = Dom_1.$$('span', { className: 'coveo-settings-squares' }).el;
            _.times(3, function () { return squares.appendChild(square.cloneNode()); });
            this.element.appendChild(squares);
        }
        else {
            var icon = Dom_1.$$('span', { className: 'coveo-settings-icon' }).el;
            this.element.appendChild(icon);
        }
        Dom_1.$$(this.element).on('click', function () {
            if (_this.isOpened) {
                _this.close();
            }
            else {
                _this.open();
            }
        });
        Dom_1.$$(this.element).on('mouseleave', function () { return _this.mouseleave(); });
        Dom_1.$$(this.element).on('mouseenter', function () { return _this.mouseenter(); });
    };
    Settings.prototype.buildMenu = function () {
        var _this = this;
        var menu = Dom_1.$$('div', { className: 'coveo-settings-advanced-menu' }).el;
        var settingsPopulateMenuArgs = {
            settings: this,
            menuData: []
        };
        Dom_1.$$(this.root).trigger(SettingsEvents_1.SettingsEvents.settingsPopulateMenu, settingsPopulateMenuArgs);
        _.each(settingsPopulateMenuArgs.menuData, function (menuItem) {
            var menuItemDom = Dom_1.$$('div', {
                className: "coveo-settings-item " + menuItem.className,
                title: _.escape(menuItem.tooltip || '')
            }).el;
            menuItemDom.appendChild(Dom_1.$$('div', { className: 'coveo-icon' }).el);
            menuItemDom.appendChild(Dom_1.$$('div', { className: 'coveo-settings-text' }, _.escape(menuItem.text)).el);
            Dom_1.$$(menuItemDom).on('click', function () {
                _this.close();
                _.each(settingsPopulateMenuArgs.menuData, function (menuItem) {
                    menuItem.onClose && menuItem.onClose();
                });
                menuItem.onOpen();
            });
            menu.appendChild(menuItemDom);
        });
        return menu;
    };
    Settings.prototype.mouseleave = function () {
        var _this = this;
        clearTimeout(this.closeTimeout);
        this.closeTimeout = setTimeout(function () {
            _this.close();
        }, this.options.menuDelay);
    };
    Settings.prototype.mouseenter = function () {
        clearTimeout(this.closeTimeout);
    };
    Settings.prototype.getPopupPositioning = function () {
        return {
            horizontal: PopupUtils_1.HorizontalAlignment.INNERRIGHT,
            vertical: PopupUtils_1.VerticalAlignment.BOTTOM,
            verticalOffset: 8
        };
    };
    return Settings;
}(Component_1.Component));
Settings.ID = 'Settings';
Settings.doExport = function () {
    GlobalExports_1.exportGlobally({
        'Settings': Settings
    });
};
/**
 * The options for Settings
 * @componentOptions
 */
Settings.options = {
    /**
     * Specifies the delay (in milliseconds) before hiding the popup menu when the cursor is not hovering over it.
     *
     * Default value is `300`. Minimum value is `0 `.
     */
    menuDelay: ComponentOptions_1.ComponentOptions.buildNumberOption({ defaultValue: 300, min: 0 })
};
exports.Settings = Settings;
Initialization_1.Initialization.registerAutoCreateComponent(Settings);


/***/ }),

/***/ 588:
/***/ (function(module, exports) {

// removed by extract-text-webpack-plugin

/***/ })

});
//# sourceMappingURL=Settings.js.map