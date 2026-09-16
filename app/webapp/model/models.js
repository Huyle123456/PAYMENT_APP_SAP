sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * Creates device model
         * @public
         * @returns {sap.ui.model.json.JSONModel} Device JSON model
         */
        createDeviceModel: function () {
            const oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        /**
         * Creates application state model
         * @public
         * @returns {sap.ui.model.json.JSONModel} App state JSON model
         */
        createAppStateModel: function () {
            const oModel = new JSONModel({
                busy: false,
                delay: 0,
                selectedStatusFilter: "ALL",
                searchQuery: "",
                statistics: {
                    total: 0,
                    draft: 0,
                    inApproval: 0,
                    approved: 0,
                    rejected: 0,
                    posted: 0,
                    totalPostedAmount: 0
                },
                activeStepIndex: 0
            });
            return oModel;
        }
    };
});
