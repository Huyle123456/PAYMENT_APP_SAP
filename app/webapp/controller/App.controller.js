sap.ui.define([
    "sap/payment/app/controller/BaseController"
], function (BaseController) {
    "use strict";

    /**
     * Main App root controller
     */
    return BaseController.extend("sap.payment.app.controller.App", {

        // ==========================================
        // 1. LIFECYCLE HOOKS
        // ==========================================

        /**
         * Called when the app controller is initialized.
         * @public
         */
        onInit: function () {
            // Apply content density mode to root view
            this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
        }
    });
});
