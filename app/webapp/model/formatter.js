sap.ui.define([
    "sap/ui/core/ValueState",
    "sap/payment/app/model/constants"
], function (ValueState, constants) {
    "use strict";

    const { STATUS } = constants;

    return {
        /**
         * Formats status value to ValueState (Color indicator)
         * @public
         * @param {string} sStatus - Status code
         * @returns {sap.ui.core.ValueState} Corresponding ValueState
         */
        statusState: function (sStatus) {
            switch (sStatus) {
                case STATUS.POSTED:
                case STATUS.APPROVED:
                    return ValueState.Success;
                case STATUS.IN_APPROVAL:
                case STATUS.SUBMITTED:
                case STATUS.POSTING:
                    return ValueState.Warning;
                case STATUS.REJECTED:
                case STATUS.FAILED:
                    return ValueState.Error;
                case STATUS.DRAFT:
                default:
                    return ValueState.None;
            }
        },

        /**
         * Formats status value to an icon name
         * @public
         * @param {string} sStatus - Status code
         * @returns {string} SAP icon URI
         */
        statusIcon: function (sStatus) {
            switch (sStatus) {
                case STATUS.POSTED:
                    return "sap-icon://accept";
                case STATUS.APPROVED:
                    return "sap-icon://sys-enter-2";
                case STATUS.IN_APPROVAL:
                case STATUS.SUBMITTED:
                    return "sap-icon://pending";
                case STATUS.POSTING:
                    return "sap-icon://synchronize";
                case STATUS.REJECTED:
                    return "sap-icon://decline";
                case STATUS.FAILED:
                    return "sap-icon://error";
                case STATUS.DRAFT:
                default:
                    return "sap-icon://edit";
            }
        },

        /**
         * Formats status code to localized text
         * @public
         * @param {string} sStatus - Status code
         * @returns {string} i18n text or status code
         */
        statusText: function (sStatus) {
            const oResourceBundle = this.getOwnerComponent()?.getModel("i18n")?.getResourceBundle() ||
                                   this.getModel("i18n")?.getResourceBundle();
            if (!oResourceBundle) {
                return sStatus;
            }
            const sKey = "status." + (sStatus || "DRAFT").toLowerCase();
            return oResourceBundle.hasText(sKey) ? oResourceBundle.getText(sKey) : sStatus;
        },

        /**
         * Formats currency amount to localized currency string
         * @public
         * @param {number|string} nAmount - Amount value
         * @param {string} sCurrency - Currency code (e.g. VND, USD)
         * @returns {string} Formatted currency text
         */
        formatCurrency: function (nAmount, sCurrency) {
            if (nAmount === null || nAmount === undefined || isNaN(Number(nAmount))) {
                return "0 " + (sCurrency || "");
            }
            const num = Number(nAmount);
            return new Intl.NumberFormat("vi-VN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(num) + " " + (sCurrency || "VND");
        },

        /**
         * Formats date to dd/MM/yyyy
         * @public
         * @param {string|Date} vDate - Date object or ISO date string
         * @returns {string} Formatted date string
         */
        formatDate: function (vDate) {
            if (!vDate) {
                return "";
            }
            const oDate = new Date(vDate);
            if (isNaN(oDate.getTime())) {
                return "";
            }
            const sDay = String(oDate.getDate()).padStart(2, "0");
            const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const sYear = oDate.getFullYear();
            return `${sDay}/${sMonth}/${sYear}`;
        },

        /**
         * Formats JSON payload to pretty printed string
         * @public
         * @param {string|object} vPayload - JSON string or object
         * @returns {string} Pretty JSON
         */
        formatJson: function (vPayload) {
            if (!vPayload) {
                return "";
            }
            if (typeof vPayload === "object") {
                return JSON.stringify(vPayload, null, 2);
            }
            try {
                const parsed = JSON.parse(vPayload);
                return JSON.stringify(parsed, null, 2);
            } catch (e) {
                return String(vPayload);
            }
        },

        /**
         * Determines visibility of workflow action buttons based on status
         * @public
         * @param {string} sStatus - Status code
         * @param {string} sAction - Action name ('submit' | 'approve' | 'reject' | 'postS4' | 'edit')
         * @returns {boolean} Visibility
         */
        isActionEnabled: function (sStatus, sAction) {
            switch (sAction) {
                case "submit":
                    return sStatus === STATUS.DRAFT || sStatus === STATUS.REJECTED;
                case "approve":
                case "reject":
                    return sStatus === STATUS.IN_APPROVAL || sStatus === STATUS.SUBMITTED;
                case "postS4":
                    return sStatus === STATUS.APPROVED;
                case "edit":
                    return sStatus === STATUS.DRAFT;
                default:
                    return false;
            }
        }
    };
});
