sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, UIComponent, History, MessageBox, MessageToast) {
    "use strict";

    /**
     * Base Controller providing reusable helper methods across all views
     */
    return Controller.extend("sap.payment.app.controller.BaseController", {

        // ==========================================
        // 1. PUBLIC HELPER METHODS
        // ==========================================

        /**
         * Convenience method for accessing the router
         * @public
         * @returns {sap.ui.core.routing.Router} the router for this component
         */
        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        /**
         * Convenience method for getting the view model by name
         * @public
         * @param {string} [sName] the model name
         * @returns {sap.ui.model.Model} the model instance
         */
        getModel: function (sName) {
            return this.getView().getModel(sName) || this.getOwnerComponent().getModel(sName);
        },

        /**
         * Convenience method for setting the view model
         * @public
         * @param {sap.ui.model.Model} oModel the model instance
         * @param {string} [sName] the model name
         * @returns {sap.ui.core.mvc.View} the view instance
         */
        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        /**
         * Getter for the resource bundle
         * @public
         * @returns {sap.base.i18n.ResourceBundle} the resourceModel of the component
         */
        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /**
         * Get localized text by key with optional placeholders
         * @public
         * @param {string} sKey - i18n key
         * @param {Array} [aArgs] - Array of arguments for formatting
         * @returns {string} Localized text
         */
        getText: function (sKey, aArgs) {
            const oBundle = this.getResourceBundle();
            return oBundle ? oBundle.getText(sKey, aArgs) : sKey;
        },

        /**
         * Navigates back in browser history or to default route
         * @public
         * @param {string} [sDefaultRoute="list"] - Fallback route name
         */
        onNavBack: function (sDefaultRoute = "list") {
            const sPreviousHash = History.getInstance().getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getRouter().navTo(sDefaultRoute, {}, true);
            }
        },

        /**
         * Displays a standardized success message toast
         * @public
         * @param {string} sMessage - Success message text
         */
        showSuccess: function (sMessage) {
            MessageToast.show(sMessage, { duration: 3500 });
        },

        /**
         * Displays a standardized error message box
         * @public
         * @param {string} sMessage - Error message text
         * @param {string} [sTitle] - Dialog title
         */
        showError: function (sMessage, sTitle) {
            MessageBox.error(sMessage, {
                title: sTitle || this.getText("title.app")
            });
        }
    });
});
