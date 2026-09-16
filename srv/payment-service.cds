using { sap.payment as my } from '../db/schema';
using { sap.common.Currencies } from '@sap/cds/common';

@path: '/payment'
service PaymentService {

    @odata.draft.enabled
    entity PaymentRequests as projection on my.PaymentRequests actions {
        @cds.odata.bindingparameter.name: '_it'
        @Common.SideEffects: { TargetEntities: ['_it'] }
        action submitForApproval(comment : String) returns PaymentRequests;

        @cds.odata.bindingparameter.name: '_it'
        @Common.SideEffects: { TargetEntities: ['_it'] }
        action approve(comment : String) returns PaymentRequests;

        @cds.odata.bindingparameter.name: '_it'
        @Common.SideEffects: { TargetEntities: ['_it'] }
        action reject(reason : String) returns PaymentRequests;

        @cds.odata.bindingparameter.name: '_it'
        @Common.SideEffects: { TargetEntities: ['_it'] }
        action updatePostedStatus(
            sapSupplierInvoiceNo : String,
            sapFiscalYear        : String,
            sapPostingDate       : Date
        ) returns PaymentRequests;

        @cds.odata.bindingparameter.name: '_it'
        @Common.SideEffects: { TargetEntities: ['_it'] }
        action simulateS4Posting() returns PaymentRequests;

        @cds.odata.bindingparameter.name: '_it'
        @Common.SideEffects: { TargetEntities: ['_it'] }
        action postToS4HanaThroughCPI() returns PaymentRequests;
    };

    entity PaymentRequestItems as projection on my.PaymentRequestItems;
    entity Attachments as projection on my.Attachments;
    entity EventLogs as projection on my.EventLogs;
    entity IntegrationLogs as projection on my.IntegrationLogs;

    // Master Data Value Helps (Read-Only)
    @readonly entity Vendors as projection on my.Vendors;
    @readonly entity CompanyCodes as projection on my.CompanyCodes;
    @readonly entity CostCenters as projection on my.CostCenters;
    @readonly entity GLAccounts as projection on my.GLAccounts;
    @readonly entity PaymentMethods as projection on my.PaymentMethods;

    // Direct End-to-End Workflow Execution helper for UI simulation
    action runFullWorkflowSimulation(paymentRequestId : UUID) returns PaymentRequests;

    // Event definition for Event Mesh
    event PaymentRequestSubmitted {
        requestNo       : String;
        companyCode     : String;
        vendorCode      : String;
        totalAmount     : Decimal;
        currency        : String;
        dueDate         : Date;
    };

    event PaymentRequestApproved {
        requestNo       : String;
        workflowId      : String;
        approvedBy      : String;
        approvedAt      : Timestamp;
    };

    event PaymentRequestPosted {
        requestNo            : String;
        sapSupplierInvoiceNo : String;
        sapFiscalYear        : String;
        sapPostingDate       : Date;
    };
}

using from './fiori-annotations';

