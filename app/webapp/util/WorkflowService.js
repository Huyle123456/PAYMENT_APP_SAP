sap.ui.define([], function () {
    "use strict";

    /**
     * Workflow and API helper service for Payment Request processing
     */
    return {
        /**
         * Base service URL for payment service
         */
        SERVICE_URL: "/payment",

        /**
         * Executes an OData V4 action for a Payment Request entity
         * @public
         * @param {string} sActionName - Name of the action (e.g. 'submitForApproval', 'approve', 'reject', 'postToS4HanaThroughCPI')
         * @param {string} sPaymentRequestId - UUID of Payment Request
         * @param {object} [oPayload={}] - Action payload
         * @returns {Promise<object>} Action execution response
         */
        callAction: async function (sActionName, sPaymentRequestId, oPayload = {}) {
            const sUrl = `${this.SERVICE_URL}/PaymentRequests(${sPaymentRequestId})/PaymentService.${sActionName}`;
            const response = await fetch(sUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(oPayload)
            });

            if (!response.ok) {
                let errorMsg = `Action ${sActionName} failed: ${response.statusText}`;
                try {
                    const errData = await response.json();
                    errorMsg = errData.error?.message || errorMsg;
                } catch (e) {
                    // Ignore JSON parse error
                }
                throw new Error(errorMsg);
            }

            return await response.json();
        },

        /**
         * Runs end-to-end full workflow simulation
         * @public
         * @param {string} sPaymentRequestId - UUID of Payment Request
         * @returns {Promise<object>} Simulation response
         */
        runFullSimulation: async function (sPaymentRequestId) {
            const sUrl = `${this.SERVICE_URL}/runFullWorkflowSimulation`;
            const response = await fetch(sUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ paymentRequestId: sPaymentRequestId })
            });

            if (!response.ok) {
                let errorMsg = `Workflow simulation failed: ${response.statusText}`;
                try {
                    const errData = await response.json();
                    errorMsg = errData.error?.message || errorMsg;
                } catch (e) {
                    // Ignore JSON parse error
                }
                throw new Error(errorMsg);
            }

            return await response.json();
        },

        /**
         * Creates a new Payment Request with line items
         * @public
         * @param {object} oData - Payment Request data with items
         * @returns {Promise<object>} Created Payment Request
         */
        createPaymentRequest: async function (oData) {
            const sUrl = `${this.SERVICE_URL}/PaymentRequests`;
            const response = await fetch(sUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(oData)
            });

            if (!response.ok) {
                let errorMsg = `Create Payment Request failed: ${response.statusText}`;
                try {
                    const errData = await response.json();
                    errorMsg = errData.error?.message || errorMsg;
                } catch (e) {
                    // Ignore JSON parse error
                }
                throw new Error(errorMsg);
            }

            return await response.json();
        },

        /**
         * Fetches full payment request details by ID including items, attachments, event logs, integration logs
         * @public
         * @param {string} sId - Payment Request ID
         * @returns {Promise<object>} Payment Request entity with expanded relations
         */
        getPaymentRequestDetails: async function (sId) {
            const sUrl = `${this.SERVICE_URL}/PaymentRequests(${sId})?$expand=companyCode,vendor,paymentMethod,currency,items($expand=glAccount,costCenter),attachments`;
            const response = await fetch(sUrl, {
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) {
                throw new Error(`Failed to load payment request ${sId}: ${response.statusText}`);
            }

            return await response.json();
        },

        /**
         * Fetches Event Mesh logs for a payment request
         * @public
         * @param {string} sId - Payment Request ID
         * @returns {Promise<Array>} List of event logs
         */
        getEventLogs: async function (sId) {
            const sUrl = `${this.SERVICE_URL}/EventLogs?$filter=paymentRequest_ID eq '${sId}'&$orderby=createdAt desc`;
            const response = await fetch(sUrl, {
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) {
                return [];
            }
            const data = await response.json();
            return data.value || [];
        },

        /**
         * Fetches Integration Suite / CPI logs for a payment request
         * @public
         * @param {string} sId - Payment Request ID
         * @returns {Promise<Array>} List of integration logs
         */
        getIntegrationLogs: async function (sId) {
            const sUrl = `${this.SERVICE_URL}/IntegrationLogs?$filter=paymentRequest_ID eq '${sId}'&$orderby=createdAt desc`;
            const response = await fetch(sUrl, {
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) {
                return [];
            }
            const data = await response.json();
            return data.value || [];
        },

        /**
         * Loads Master Data entities from SAP CAP (replicated from S/4HANA)
         * @public
         * @returns {Promise<object>} Object containing arrays for master data
         */
        loadMasterData: async function () {
            const [oVendors, oCompanyCodes, oCostCenters, oGLAccounts, oPaymentMethods] = await Promise.all([
                fetch(`${this.SERVICE_URL}/Vendors`).then(r => r.json()).catch(() => ({ value: [] })),
                fetch(`${this.SERVICE_URL}/CompanyCodes`).then(r => r.json()).catch(() => ({ value: [] })),
                fetch(`${this.SERVICE_URL}/CostCenters`).then(r => r.json()).catch(() => ({ value: [] })),
                fetch(`${this.SERVICE_URL}/GLAccounts`).then(r => r.json()).catch(() => ({ value: [] })),
                fetch(`${this.SERVICE_URL}/PaymentMethods`).then(r => r.json()).catch(() => ({ value: [] }))
            ]);

            return {
                vendors: oVendors.value || [],
                companyCodes: oCompanyCodes.value || [],
                costCenters: oCostCenters.value || [],
                glAccounts: oGLAccounts.value || [],
                paymentMethods: oPaymentMethods.value || []
            };
        }
    };
});
