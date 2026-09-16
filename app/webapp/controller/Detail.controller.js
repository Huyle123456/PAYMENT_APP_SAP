sap.ui.define([
    "sap/payment/app/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/payment/app/model/formatter",
    "sap/payment/app/model/constants",
    "sap/payment/app/util/WorkflowService",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/TextArea",
    "sap/m/Text",
    "sap/m/VBox"
], function (BaseController, JSONModel, formatter, constants, WorkflowService, MessageBox, Dialog, Button, TextArea, Text, VBox) {
    "use strict";

    const { STATUS } = constants;

    return BaseController.extend("sap.payment.app.controller.Detail", {
        formatter: formatter,

        // ==========================================
        // 1. LIFECYCLE HOOKS
        // ==========================================

        /**
         * Initialize detail controller and setup route matching
         * @public
         */
        onInit: function () {
            const oDetailViewModel = new JSONModel({
                busy: false,
                id: null,
                data: {},
                items: [],
                attachments: [],
                eventLogs: [],
                integrationLogs: [],
                currentStepIndex: 1
            });
            this.setModel(oDetailViewModel, "detailView");

            this.getRouter().getRoute("detail").attachPatternMatched(this._onRouteMatched, this);
        },

        // ==========================================
        // 2. PUBLIC EVENT HANDLERS / ACTIONS
        // ==========================================

        /**
         * Refresh detail data and audit logs
         * @public
         */
        onRefresh: function () {
            const sId = this.getModel("detailView").getProperty("/id");
            if (sId) {
                this._loadDetails(sId);
            }
        },

        /**
         * Action: Submit Payment Request for BPA Approval via Event Mesh
         * @public
         */
        onSubmitApprovalPress: function () {
            const oData = this.getModel("detailView").getProperty("/data");
            const sConfirmMsg = this.getText("msg.confirm.submit", [oData.requestNo]);

            MessageBox.confirm(sConfirmMsg, {
                title: this.getText("btn.submitApproval"),
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        await this._executeWorkflowAction("submitForApproval", "msg.success.submitted");
                    }
                }
            });
        },

        /**
         * Action: Approve Payment Request (BPA Stage)
         * @public
         */
        onApprovePress: function () {
            const oData = this.getModel("detailView").getProperty("/data");
            const sConfirmMsg = this.getText("msg.confirm.approve", [oData.requestNo]);

            MessageBox.confirm(sConfirmMsg, {
                title: this.getText("btn.approve"),
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        await this._executeWorkflowAction("approve", "msg.success.approved");
                    }
                }
            });
        },

        /**
         * Action: Reject Payment Request (BPA Stage)
         * @public
         */
        onRejectPress: function () {
            this._openRejectDialog();
        },

        /**
         * Action: Post Payment Request to S/4HANA via SAP Integration Suite (CPI)
         * @public
         */
        onPostToS4Press: function () {
            const oData = this.getModel("detailView").getProperty("/data");
            const sConfirmMsg = this.getText("msg.confirm.postS4", [oData.requestNo]);

            MessageBox.confirm(sConfirmMsg, {
                title: this.getText("btn.postToS4Hana"),
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        try {
                            this.getModel("detailView").setProperty("/busy", true);
                            const updated = await WorkflowService.callAction("postToS4HanaThroughCPI", oData.ID);
                            this.showSuccess(this.getText("msg.success.posted", [oData.requestNo, updated.sapSupplierInvoiceNo || "51056XXXXX"]));
                            await this._loadDetails(oData.ID);
                        } catch (error) {
                            this.showError(this.getText("msg.error.generic", [error.message]));
                        } finally {
                            this.getModel("detailView").setProperty("/busy", false);
                        }
                    }
                }
            });
        },

        /**
         * Action: Run full simulation of all architecture steps
         * @public
         */
        onSimulateFullWorkflowPress: function () {
            const oData = this.getModel("detailView").getProperty("/data");
            const sConfirmMsg = this.getText("msg.confirm.simulate");

            MessageBox.confirm(sConfirmMsg, {
                title: this.getText("btn.simulateFullFlow"),
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        try {
                            this.getModel("detailView").setProperty("/busy", true);
                            await WorkflowService.runFullSimulation(oData.ID);
                            this.showSuccess(this.getText("msg.success.simulated", [oData.requestNo]));
                            await this._loadDetails(oData.ID);
                        } catch (error) {
                            this.showError(this.getText("msg.error.generic", [error.message]));
                        } finally {
                            this.getModel("detailView").setProperty("/busy", false);
                        }
                    }
                }
            });
        },

        // ==========================================
        // 3. PRIVATE HELPER FUNCTIONS (Prefixed with _)
        // ==========================================

        /**
         * Route match handler
         * @private
         * @param {sap.ui.base.Event} oEvent - Pattern matched event
         */
        _onRouteMatched: function (oEvent) {
            const sId = oEvent.getParameter("arguments").id;
            this.getModel("detailView").setProperty("/id", sId);
            this._loadDetails(sId);
        },

        /**
         * Loads full details and related audit logs for the request
         * @private
         * @param {string} sId - Request ID
         */
        _loadDetails: async function (sId) {
            const oModel = this.getModel("detailView");
            oModel.setProperty("/busy", true);

            try {
                const [oData, aEventLogs, aIntegrationLogs] = await Promise.all([
                    WorkflowService.getPaymentRequestDetails(sId),
                    WorkflowService.getEventLogs(sId),
                    WorkflowService.getIntegrationLogs(sId)
                ]);

                oModel.setProperty("/data", oData);
                oModel.setProperty("/items", oData.items || []);
                oModel.setProperty("/attachments", oData.attachments || []);
                oModel.setProperty("/eventLogs", aEventLogs);
                oModel.setProperty("/integrationLogs", aIntegrationLogs);

                // Calculate architecture workflow step index
                this._updateWorkflowStep(oData.status);
            } catch (error) {
                this.showError(this.getText("msg.error.generic", [error.message]));
            } finally {
                oModel.setProperty("/busy", false);
            }
        },

        /**
         * Updates the active architecture workflow step indicator
         * @private
         * @param {string} sStatus - Status code
         */
        _updateWorkflowStep: function (sStatus) {
            let stepIndex = 1;
            switch (sStatus) {
                case STATUS.DRAFT:
                    stepIndex = 1; // S4 Master Data & CAP App
                    break;
                case STATUS.IN_APPROVAL:
                case STATUS.SUBMITTED:
                    stepIndex = 3; // Event Mesh -> BPA Approval
                    break;
                case STATUS.APPROVED:
                    stepIndex = 4; // Approved -> Ready for CPI
                    break;
                case STATUS.POSTING:
                    stepIndex = 5; // CPI -> S/4HANA
                    break;
                case STATUS.POSTED:
                    stepIndex = 6; // Supplier Invoice & CAP POSTED
                    break;
                case STATUS.REJECTED:
                    stepIndex = 3; // Rejected at BPA
                    break;
                default:
                    stepIndex = 1;
            }
            this.getModel("detailView").setProperty("/currentStepIndex", stepIndex);
        },

        /**
         * Generic executor for workflow actions
         * @private
         * @param {string} sActionName - Action name
         * @param {string} sSuccessI18nKey - i18n key for success message
         * @param {object} [oPayload={}] - Action payload
         */
        _executeWorkflowAction: async function (sActionName, sSuccessI18nKey, oPayload = {}) {
            const oModel = this.getModel("detailView");
            const sId = oModel.getProperty("/id");
            const sRequestNo = oModel.getProperty("/data/requestNo");

            oModel.setProperty("/busy", true);
            try {
                await WorkflowService.callAction(sActionName, sId, oPayload);
                this.showSuccess(this.getText(sSuccessI18nKey, [sRequestNo]));
                await this._loadDetails(sId);
            } catch (error) {
                this.showError(this.getText("msg.error.generic", [error.message]));
            } finally {
                oModel.setProperty("/busy", false);
            }
        },

        /**
         * Opens rejection reason dialog
         * @private
         */
        _openRejectDialog: function () {
            const oTextArea = new TextArea({
                width: "100%",
                rows: 4,
                placeholder: this.getText("label.paymentRequest.rejectionReason")
            });

            const oDialog = new Dialog({
                title: this.getText("title.dialog.reject"),
                type: "Message",
                content: new VBox({
                    items: [
                        new Text({ text: this.getText("label.paymentRequest.rejectionReason") + ":" }),
                        oTextArea
                    ]
                }),
                beginButton: new Button({
                    text: this.getText("btn.reject"),
                    type: "Reject",
                    press: async () => {
                        const sReason = oTextArea.getValue().trim();
                        if (!sReason) {
                            this.showError(this.getText("msg.error.rejectReasonRequired"));
                            return;
                        }
                        oDialog.close();
                        await this._executeWorkflowAction("reject", "msg.success.rejected", { reason: sReason });
                    }
                }),
                endButton: new Button({
                    text: this.getText("btn.cancel"),
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.open();
        }
    });
});
