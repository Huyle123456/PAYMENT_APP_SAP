sap.ui.define([], function () {
    "use strict";

    /**
     * Reusable application constants for Payment Request management
     * Following project coding conventions
     */
    const STATUS = Object.freeze({
        DRAFT: "DRAFT",
        SUBMITTED: "SUBMITTED",
        IN_APPROVAL: "IN_APPROVAL",
        APPROVED: "APPROVED",
        REJECTED: "REJECTED",
        POSTING: "POSTING",
        POSTED: "POSTED",
        FAILED: "FAILED"
    });

    const CRITICALITY = Object.freeze({
        NEUTRAL: 0,
        NEGATIVE: 1, // Error / Rejected (Red)
        CRITICAL: 2, // Warning / In-Progress (Orange)
        POSITIVE: 3  // Success / Posted (Green)
    });

    const PREFIX = Object.freeze({
        PAYMENT_REQUEST: "PR-",
        WORKFLOW: "BPA-WF-",
        INVOICE_DOC: "51056"
    });

    const WORKFLOW_STEPS = Object.freeze({
        MASTER_DATA: "S4_MASTER_DATA",
        CREATE_REQUEST: "CREATE_REQUEST",
        EVENT_MESH: "EVENT_MESH",
        BPA_APPROVAL: "BPA_APPROVAL",
        CPI_INTEGRATION: "CPI_INTEGRATION",
        S4_SUPPLIER_INVOICE: "S4_SUPPLIER_INVOICE",
        CAP_POSTED: "CAP_POSTED"
    });

    return {
        STATUS: STATUS,
        CRITICALITY: CRITICALITY,
        PREFIX: PREFIX,
        WORKFLOW_STEPS: WORKFLOW_STEPS
    };
});
