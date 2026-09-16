sap.ui.define([
    "sap/payment/app/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/payment/app/model/formatter",
    "sap/payment/app/model/constants",
    "sap/payment/app/util/WorkflowService"
], function (BaseController, JSONModel, formatter, constants, WorkflowService) {
    "use strict";

    const { STATUS } = constants;

    return BaseController.extend("sap.payment.app.controller.Create", {
        formatter: formatter,

        // ==========================================
        // 1. LIFECYCLE HOOKS
        // ==========================================

        /**
         * Initialize create view and load master data
         * @public
         */
        onInit: function () {
            const oCreateViewModel = new JSONModel({
                busy: false,
                formData: this._getInitialFormData(),
                masterData: {
                    vendors: [],
                    companyCodes: [],
                    costCenters: [],
                    glAccounts: [],
                    paymentMethods: []
                }
            });
            this.setModel(oCreateViewModel, "createView");

            this.getRouter().getRoute("create").attachPatternMatched(this._onRouteMatched, this);
        },

        // ==========================================
        // 2. PUBLIC EVENT HANDLERS / ACTIONS
        // ==========================================

        /**
         * Add a new blank item to the line items table
         * @public
         */
        onAddItemPress: function () {
            const oModel = this.getModel("createView");
            const aItems = oModel.getProperty("/formData/items");
            const oMaster = oModel.getProperty("/masterData");

            const sDefaultGL = oMaster.glAccounts[0]?.code || "642100";
            const sDefaultCC = oMaster.costCenters[0]?.code || "CC-IT01";

            aItems.push({
                itemNo: aItems.length + 1,
                glAccount_code: sDefaultGL,
                costCenter_code: sDefaultCC,
                itemDescription: "",
                amount: 0,
                taxCode: "V0",
                taxAmount: 0
            });

            oModel.setProperty("/formData/items", aItems);
            this._recalculateTotalAmount();
        },

        /**
         * Delete a line item from the table
         * @public
         * @param {sap.ui.base.Event} oEvent - Button press event
         */
        onDeleteItemPress: function (oEvent) {
            const oItemContext = oEvent.getSource().getBindingContext("createView");
            const sPath = oItemContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getModel("createView");
            const aItems = oModel.getProperty("/formData/items");

            if (aItems.length <= 1) {
                this.showError(this.getText("msg.error.validation"));
                return;
            }

            aItems.splice(iIndex, 1);
            // Re-index item numbers
            aItems.forEach((item, idx) => {
                item.itemNo = idx + 1;
            });

            oModel.setProperty("/formData/items", aItems);
            this._recalculateTotalAmount();
        },

        /**
         * Handle line item amount change to recalculate total
         * @public
         */
        onItemAmountChange: function () {
            this._recalculateTotalAmount();
        },

        /**
         * Action: Save Payment Request as DRAFT
         * @public
         */
        onSaveDraftPress: async function () {
            if (!this._validateForm()) {
                return;
            }

            await this._savePaymentRequest(false);
        },

        /**
         * Action: Save and immediately submit for BPA Approval
         * @public
         */
        onSubmitApprovalPress: async function () {
            if (!this._validateForm()) {
                return;
            }

            await this._savePaymentRequest(true);
        },

        /**
         * Cancel creation and navigate back to list
         * @public
         */
        onCancelPress: function () {
            this.onNavBack();
        },

        // ==========================================
        // 3. PRIVATE HELPER FUNCTIONS (Prefixed with _)
        // ==========================================

        /**
         * Route matched handler
         * @private
         */
        _onRouteMatched: async function () {
            this._resetForm();
            await this._loadMasterData();
        },

        /**
         * Resets form to initial empty state with 1 default item
         * @private
         */
        _resetForm: function () {
            const oModel = this.getModel("createView");
            oModel.setProperty("/formData", this._getInitialFormData());
        },

        /**
         * Returns initial form data structure
         * @private
         * @returns {object} Form data object
         */
        _getInitialFormData: function () {
            const today = new Date().toISOString().split("T")[0];
            const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

            return {
                description: "",
                companyCode_code: "1000",
                vendor_code: "VEND-1001",
                requestDate: today,
                dueDate: nextWeek,
                paymentMethod_code: "T",
                currency_code: "VND",
                totalAmount: 0,
                status: STATUS.DRAFT,
                items: [
                    {
                        itemNo: 1,
                        glAccount_code: "642100",
                        costCenter_code: "CC-IT01",
                        itemDescription: "",
                        amount: 0,
                        taxCode: "V0",
                        taxAmount: 0
                    }
                ]
            };
        },

        /**
         * Loads master data from backend service
         * @private
         */
        _loadMasterData: async function () {
            const oModel = this.getModel("createView");
            oModel.setProperty("/busy", true);

            try {
                const oMaster = await WorkflowService.loadMasterData();
                oModel.setProperty("/masterData", oMaster);

                // Set defaults if available
                if (oMaster.companyCodes.length > 0 && !oModel.getProperty("/formData/companyCode_code")) {
                    oModel.setProperty("/formData/companyCode_code", oMaster.companyCodes[0].code);
                }
                if (oMaster.vendors.length > 0 && !oModel.getProperty("/formData/vendor_code")) {
                    oModel.setProperty("/formData/vendor_code", oMaster.vendors[0].code);
                }
            } catch (error) {
                this.showError(this.getText("msg.error.generic", [error.message]));
            } finally {
                oModel.setProperty("/busy", false);
            }
        },

        /**
         * Recalculates total amount based on line items
         * @private
         */
        _recalculateTotalAmount: function () {
            const oModel = this.getModel("createView");
            const aItems = oModel.getProperty("/formData/items") || [];

            let nTotal = 0;
            aItems.forEach(item => {
                const nAmount = Number(item.amount || 0);
                nTotal += nAmount;
            });

            oModel.setProperty("/formData/totalAmount", nTotal);
        },

        /**
         * Validates form inputs
         * @private
         * @returns {boolean} True if form is valid
         */
        _validateForm: function () {
            const oModel = this.getModel("createView");
            const oFormData = oModel.getProperty("/formData");

            if (!oFormData.description || oFormData.description.trim() === "") {
                this.showError(this.getText("msg.error.validation"));
                return false;
            }

            if (!oFormData.companyCode_code || !oFormData.vendor_code || !oFormData.dueDate) {
                this.showError(this.getText("msg.error.validation"));
                return false;
            }

            if (!oFormData.items || oFormData.items.length === 0) {
                this.showError(this.getText("msg.error.validation"));
                return false;
            }

            let bItemValid = true;
            oFormData.items.forEach(item => {
                if (Number(item.amount || 0) <= 0) {
                    bItemValid = false;
                }
            });

            if (!bItemValid) {
                this.showError(this.getText("msg.error.amountInvalid"));
                return false;
            }

            return true;
        },

        /**
         * Saves payment request to backend
         * @private
         * @param {boolean} bSubmitAfter - Whether to trigger BPA submission immediately
         */
        _savePaymentRequest: async function (bSubmitAfter) {
            const oModel = this.getModel("createView");
            const oFormData = oModel.getProperty("/formData");

            oModel.setProperty("/busy", true);

            try {
                // Construct clean payload for CAP
                const oPayload = {
                    description: oFormData.description.trim(),
                    companyCode_code: oFormData.companyCode_code,
                    vendor_code: oFormData.vendor_code,
                    requestDate: oFormData.requestDate,
                    dueDate: oFormData.dueDate,
                    paymentMethod_code: oFormData.paymentMethod_code,
                    currency_code: oFormData.currency_code,
                    totalAmount: Number(oFormData.totalAmount || 0),
                    status: STATUS.DRAFT,
                    items: oFormData.items.map((item, idx) => ({
                        itemNo: idx + 1,
                        glAccount_code: item.glAccount_code,
                        costCenter_code: item.costCenter_code,
                        itemDescription: item.itemDescription || oFormData.description,
                        amount: Number(item.amount || 0),
                        taxCode: item.taxCode || "V0",
                        taxAmount: Number(item.taxAmount || 0)
                    }))
                };

                const createdRequest = await WorkflowService.createPaymentRequest(oPayload);
                this.showSuccess(this.getText("msg.success.created"));

                if (bSubmitAfter && createdRequest.ID) {
                    await WorkflowService.callAction("submitForApproval", createdRequest.ID);
                    this.showSuccess(this.getText("msg.success.submitted", [createdRequest.requestNo]));
                }

                this.getRouter().navTo("detail", {
                    id: createdRequest.ID
                });
            } catch (error) {
                this.showError(this.getText("msg.error.generic", [error.message]));
            } finally {
                oModel.setProperty("/busy", false);
            }
        }
    });
});
