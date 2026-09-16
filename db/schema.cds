namespace sap.payment;

using { cuid, managed, sap.common.Currencies } from '@sap/cds/common';

// ----------------------------------------------------
// TRANSACTIONAL ENTITIES
// ----------------------------------------------------

/**
 * Payment Request Header
 */
entity PaymentRequests : cuid, managed {
    @title: 'Payment Request No.'
    requestNo            : String(20);

    @title: 'Description / Purpose'
    description          : String(255);

    @title: 'Company Code'
    companyCode          : Association to CompanyCodes;

    @title: 'Supplier / Vendor'
    vendor               : Association to Vendors;

    @title: 'Request Date'
    requestDate          : Date;

    @title: 'Due Date'
    dueDate              : Date;

    @title: 'Payment Method'
    paymentMethod        : Association to PaymentMethods;

    @title: 'Currency'
    currency             : Association to Currencies;

    @title: 'Total Amount'
    totalAmount          : Decimal(15, 2) default 0.00;

    @title: 'Status'
    status               : String(20) enum {
        DRAFT       = 'DRAFT';
        SUBMITTED   = 'SUBMITTED';
        IN_APPROVAL = 'IN_APPROVAL';
        APPROVED    = 'APPROVED';
        REJECTED    = 'REJECTED';
        POSTING     = 'POSTING';
        POSTED      = 'POSTED';
        FAILED      = 'FAILED';
    } default 'DRAFT';

    @title: 'Rejection Reason'
    rejectionReason      : String(500);

    @title: 'Workflow Instance ID'
    workflowInstanceId   : String(100);

    @title: 'S/4HANA Supplier Invoice No'
    sapSupplierInvoiceNo : String(10);

    @title: 'S/4HANA Fiscal Year'
    sapFiscalYear        : String(4);

    @title: 'S/4HANA Posting Date'
    sapPostingDate       : Date;

    @title: 'Status Criticality'
    criticality          : Integer default 0;

    @title: 'Line Items'
    items                : Composition of many PaymentRequestItems on items.parent = $self;

    @title: 'Attachments'
    attachments          : Composition of many Attachments on attachments.parent = $self;
}

/**
 * Payment Request Line Items (Cost breakdown)
 */
entity PaymentRequestItems : cuid {
    parent          : Association to PaymentRequests;

    @title: 'Item No.'
    itemNo          : Integer;

    @title: 'G/L Account'
    glAccount       : Association to GLAccounts;

    @title: 'Cost Center'
    costCenter      : Association to CostCenters;

    @title: 'Item Text / Description'
    itemDescription : String(255);

    @title: 'Amount'
    amount          : Decimal(15, 2);

    @title: 'Tax Code'
    taxCode         : String(2);

    @title: 'Tax Amount'
    taxAmount       : Decimal(15, 2) default 0.00;
}

/**
 * Attachments / Invoices
 */
entity Attachments : cuid, managed {
    parent   : Association to PaymentRequests;

    @title: 'File Name'
    fileName : String(255);

    @title: 'MIME Type'
    mimeType : String(100);

    @title: 'File Content'
    @Core.MediaType: mimeType
    content  : LargeBinary;

    @title: 'File Size (Bytes)'
    size     : Integer;
}


// ----------------------------------------------------
// MASTER DATA (Synced / Replicated from S/4HANA)
// ----------------------------------------------------

entity Vendors {
    @title: 'Vendor Code'
    key code        : String(10);

    @title: 'Vendor Name'
    name            : String(100);

    @title: 'Tax ID'
    taxNumber       : String(20);

    @title: 'Bank Account'
    bankAccount     : String(30);

    @title: 'Bank Name'
    bankName        : String(100);

    @title: 'Country'
    country         : String(3);
}

entity CompanyCodes {
    @title: 'Company Code'
    key code        : String(4);

    @title: 'Company Name'
    name            : String(100);

    @title: 'Currency'
    currency_code   : String(3);
}

entity CostCenters {
    @title: 'Cost Center'
    key code        : String(10);

    @title: 'Company Code'
    companyCode     : Association to CompanyCodes;

    @title: 'Cost Center Name'
    name            : String(100);
}

entity GLAccounts {
    @title: 'G/L Account'
    key code        : String(10);

    @title: 'Account Name'
    name            : String(100);

    @title: 'Account Type'
    accountType     : String(20);
}

entity PaymentMethods {
    @title: 'Payment Method'
    key code        : String(2);

    @title: 'Description'
    name            : String(50);
}
