sap.ui.define([
    "sap/payment/app/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/payment/app/model/formatter",
    "sap/payment/app/model/constants",
    "sap/payment/app/util/WorkflowService",
    "sap/m/MessageBox"
], function (BaseController, JSONModel, Filter, FilterOperator, formatter, constants, WorkflowService, MessageBox) {
    "use strict";

    const { STATUS } = constants;

    return BaseController.extend("sap.payment.app.controller.List", {
        formatter: formatter,

        // ==========================================
        // 1. LIFECYCLE HOOKS
        // ==========================================

        /**
         * Initialize list view and setup event routing listeners
         * @public
         */
        onInit: function () {
            const oListViewModel = new JSONModel({
                busy: false,
                paymentRequests: [],
                stats: {
                    total: 0,
                    inApproval: 0,
                    approved: 0,
                    posted: 0
                },
                selectedStatus: "ALL",
                searchQuery: ""
            });
            this.setModel(oListViewModel, "listView");

            this.getRouter().getRoute("list").attachPatternMatched(this._onRouteMatched, this);
        },

        // ==========================================
        // 2. PUBLIC EVENT HANDLERS / ACTIONS
        // ==========================================

        /**
         * Handle pull-to-refresh or refresh button click
         * @public
         */
        onRefresh: function () {
            this._loadPaymentRequests();
        },

        /**
         * Navigate to Create Payment Request page
         * @public
         */
        onCreatePress: function () {
            this.getRouter().navTo("create");
        },

        /**
         * Navigate to Details of selected Payment Request
         * @public
         * @param {sap.ui.base.Event} oEvent - Item press event
         */
        onItemPress: function (oEvent) {
            const oSource = oEvent.getSource();
            const oBindingContext = oSource.getBindingContext("listView");
            const oData = oBindingContext.getObject();

            this.getRouter().navTo("detail", {
                id: oData.ID
            });
        },

        /**
         * Filter list by search query (requestNo, vendor name, description)
         * @public
         * @param {sap.ui.base.Event} oEvent - Search event
         */
        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            this.getModel("listView").setProperty("/searchQuery", sQuery);
            this._applyCombinedFilter();
        },

        /**
         * Filter list by status tab/segment selection
         * @public
         * @param {sap.ui.base.Event} oEvent - Selection change event
         */
        onStatusFilterSelect: function (oEvent) {
            const sKey = oEvent.getParameter("key") || oEvent.getSource().getSelectedKey();
            this.getModel("listView").setProperty("/selectedStatus", sKey);
            this._applyCombinedFilter();
        },

        /**
         * Quick action: Submit single request for BPA approval
         * @public
         * @param {sap.ui.base.Event} oEvent - Button press event
         */
        onQuickSubmit: function (oEvent) {
            const oItem = oEvent.getSource().getBindingContext("listView").getObject();
            const sConfirmMsg = this.getText("msg.confirm.submit", [oItem.requestNo]);

            MessageBox.confirm(sConfirmMsg, {
                title: this.getText("btn.submitApproval"),
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        try {
                            this.getModel("listView").setProperty("/busy", true);
                            await WorkflowService.callAction("submitForApproval", oItem.ID);
                            this.showSuccess(this.getText("msg.success.submitted", [oItem.requestNo]));
                            await this._loadPaymentRequests();
                        } catch (error) {
                            this.showError(this.getText("msg.error.generic", [error.message]));
                        } finally {
                            this.getModel("listView").setProperty("/busy", false);
                        }
                    }
                }
            });
        },

        /**
         * Quick action: Simulate full workflow end-to-end for a request
         * @public
         * @param {sap.ui.base.Event} oEvent - Button press event
         */
        onQuickSimulate: function (oEvent) {
            const oItem = oEvent.getSource().getBindingContext("listView").getObject();
            const sConfirmMsg = this.getText("msg.confirm.simulate");

            MessageBox.confirm(sConfirmMsg, {
                title: this.getText("btn.simulateFullFlow"),
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        try {
                            this.getModel("listView").setProperty("/busy", true);
                            await WorkflowService.runFullSimulation(oItem.ID);
                            this.showSuccess(this.getText("msg.success.simulated", [oItem.requestNo]));
                            await this._loadPaymentRequests();
                        } catch (error) {
                            this.showError(this.getText("msg.error.generic", [error.message]));
                        } finally {
                            this.getModel("listView").setProperty("/busy", false);
                        }
                    }
                }
            });
        },

        // ==========================================
        // 3. PRIVATE HELPER FUNCTIONS (Prefixed with _)
        // ==========================================

        /**
         * Handler executed when list route is matched
         * @private
         */
        _onRouteMatched: function () {
            this._loadPaymentRequests();
        },

        /**
         * Fetches payment requests from backend and updates statistics
         * @private
         */
        _loadPaymentRequests: async function () {
            const oModel = this.getModel("listView");
            oModel.setProperty("/busy", true);

            try {
                const response = await fetch("/payment/PaymentRequests?$expand=companyCode,vendor,currency&$orderby=createdAt desc", {
                    headers: { "Accept": "application/json" }
                });

                if (!response.ok) {
                    throw new Error(`Failed to load payment requests: ${response.statusText}`);
                }

                const data = await response.json();
                const aRequests = data.value || [];

                oModel.setProperty("/paymentRequests", aRequests);
                this._calculateStatistics(aRequests);
                this._applyCombinedFilter();
            } catch (error) {
                this.showError(this.getText("msg.error.generic", [error.message]));
            } finally {
                oModel.setProperty("/busy", false);
            }
        },

        /**
         * Calculates KPI statistics from request list
         * @private
         * @param {Array<object>} aRequests - List of payment requests
         */
        _calculateStatistics: function (aRequests) {
            const stats = {
                total: aRequests.length,
                inApproval: 0,
                approved: 0,
                posted: 0
            };

            aRequests.forEach(req => {
                if (req.status === STATUS.IN_APPROVAL || req.status === STATUS.SUBMITTED) {
                    stats.inApproval++;
                } else if (req.status === STATUS.APPROVED) {
                    stats.approved++;
                } else if (req.status === STATUS.POSTED) {
                    stats.posted++;
                }
            });

            this.getModel("listView").setProperty("/stats", stats);
        },

        /**
         * Applies both search query and status filter to the table binding
         * @private
         */
        _applyCombinedFilter: function () {
            const oTable = this.byId("paymentRequestsTable");
            if (!oTable) {
                return;
            }

            const oBinding = oTable.getBinding("items");
            if (!oBinding) {
                return;
            }

            const sQuery = this.getModel("listView").getProperty("/searchQuery");
            const sStatus = this.getModel("listView").getProperty("/selectedStatus");
            const aFilters = [];

            // Status filter
            if (sStatus && sStatus !== "ALL") {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }

            // Search filter
            if (sQuery && sQuery.trim().length > 0) {
                const sSearch = sQuery.trim();
                const aSearchFilters = [
                    new Filter("requestNo", FilterOperator.Contains, sSearch),
                    new Filter("description", FilterOperator.Contains, sSearch),
                    new Filter("vendor/name", FilterOperator.Contains, sSearch),
                    new Filter("companyCode/name", FilterOperator.Contains, sSearch),
                    new Filter("sapSupplierInvoiceNo", FilterOperator.Contains, sSearch)
                ];
                aFilters.push(new Filter({
                    filters: aSearchFilters,
                    and: false
                }));
            }

            oBinding.filter(aFilters.length > 0 ? new Filter({ filters: aFilters, and: true }) : []);
        }
    });
});
