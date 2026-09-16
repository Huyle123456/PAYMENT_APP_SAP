sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/payment/app/model/models"
], function (UIComponent, Device, models) {
    "use strict";

    return UIComponent.extend("sap.payment.app.Component", {
        metadata: {
            manifest: "json"
        },

        /**
         * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
         * @public
         * @override
         */
        init: function () {
            // Call base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // Set device model
            this.setModel(models.createDeviceModel(), "device");

            // Set app-wide state model
            this.setModel(models.createAppStateModel(), "appView");

            // Enable routing
            this.getRouter().initialize();
        },

        /**
         * Returns the content density CSS class ('sapUiSizeCompact' or 'sapUiSizeCozy')
         * @public
         * @returns {string} CSS class name
         */
        getContentDensityClass: function () {
            if (this._sContentDensityClass === undefined) {
                // Check whether FLP has already set the content density class; do nothing then
                if (document.body.classList.contains("sapUiSizeCozy") || document.body.classList.contains("sapUiSizeCompact")) {
                    this._sContentDensityClass = "";
                } else if (!Device.support.touch) {
                    // Apply compact mode for desktop devices
                    this._sContentDensityClass = "sapUiSizeCompact";
                } else {
                    // Apply cozy mode for touch devices
                    this._sContentDensityClass = "sapUiSizeCozy";
                }
            }
            return this._sContentDensityClass;
        }
    });
});
