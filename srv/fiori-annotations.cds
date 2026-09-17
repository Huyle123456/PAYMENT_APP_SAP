using { PaymentService } from './payment-service';

// ----------------------------------------------------
// PAYMENT REQUESTS - UI ANNOTATIONS
// ----------------------------------------------------

annotate PaymentService.PaymentRequests with @(
    UI: {
        HeaderInfo: {
            TypeName: 'Payment Request',
            TypeNamePlural: 'Payment Requests',
            Title: {
                $Type: 'UI.DataField',
                Value: requestNo
            },
            Description: {
                $Type: 'UI.DataField',
                Value: description
            }
        },
        SelectionFields: [
            requestNo,
            status,
            vendor_code,
            companyCode_code,
            requestDate,
            dueDate
        ],
        LineItem: [
            {
                $Type: 'UI.DataField',
                Value: requestNo,
                Label: 'Request No'
            },
            {
                $Type: 'UI.DataField',
                Value: description,
                Label: 'Description'
            },
            {
                $Type: 'UI.DataField',
                Value: vendor_code,
                Label: 'Vendor'
            },
            {
                $Type: 'UI.DataField',
                Value: companyCode_code,
                Label: 'Company Code'
            },
            {
                $Type: 'UI.DataField',
                Value: totalAmount,
                Label: 'Total Amount'
            },
            {
                $Type: 'UI.DataField',
                Value: currency_code,
                Label: 'Currency'
            },
            {
                $Type: 'UI.DataField',
                Value: status,
                Label: 'Status',
                Criticality: criticality,
                CriticalityRepresentation: #WithoutIcon
            },
            {
                $Type: 'UI.DataField',
                Value: sapSupplierInvoiceNo,
                Label: 'S/4 Doc No'
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'PaymentService.submitForApproval',
                Label: 'Submit for BPA',
                Inline: true
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'PaymentService.approve',
                Label: 'Approve (BPA)',
                Inline: true
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'PaymentService.postToS4HanaThroughCPI',
                Label: 'Post S/4HANA (CPI)',
                Inline: true
            }
        ],
        Identification: [
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'PaymentService.submitForApproval',
                Label: 'Submit for Approval'
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'PaymentService.approve',
                Label: 'Approve (BPA)'
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'PaymentService.reject',
                Label: 'Reject (BPA)'
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'PaymentService.postToS4HanaThroughCPI',
                Label: 'Post to S/4HANA (CPI)'
            }
        ],
        HeaderFacets: [
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.DataPoint#Status',
                Label: 'Status'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.DataPoint#TotalAmount',
                Label: 'Total Amount'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.DataPoint#SAPDoc',
                Label: 'S/4HANA Invoice'
            }
        ],
        DataPoint#Status: {
            Value: status,
            Title: 'Status',
            Criticality: criticality
        },
        DataPoint#TotalAmount: {
            Value: totalAmount,
            Title: 'Total Amount'
        },
        DataPoint#SAPDoc: {
            Value: sapSupplierInvoiceNo,
            Title: 'S/4 Invoice No'
        },
        Facets: [
            {
                $Type: 'UI.CollectionFacet',
                ID: 'GeneralInfoCollection',
                Label: 'General Information',
                Facets: [
                    {
                        $Type: 'UI.ReferenceFacet',
                        Target: '@UI.FieldGroup#GeneralData',
                        Label: 'Basic Details'
                    },
                    {
                        $Type: 'UI.ReferenceFacet',
                        Target: '@UI.FieldGroup#PaymentDetails',
                        Label: 'Payment Details'
                    }
                ]
            },
            {
                $Type: 'UI.ReferenceFacet',
                ID: 'ItemsFacet',
                Target: 'items/@UI.LineItem',
                Label: 'Cost Breakdown (Items)'
            },
            {
                $Type: 'UI.ReferenceFacet',
                ID: 'SAPIntegrationFacet',
                Target: '@UI.FieldGroup#SAPIntegration',
                Label: 'Workflow & S/4HANA Details'
            },
            {
                $Type: 'UI.ReferenceFacet',
                ID: 'EventLogsFacet',
                Target: 'eventLogs/@UI.LineItem',
                Label: 'SAP Event Mesh Logs'
            },
            {
                $Type: 'UI.ReferenceFacet',
                ID: 'IntegrationLogsFacet',
                Target: 'integrationLogs/@UI.LineItem',
                Label: 'SAP Integration Suite (CPI) Logs'
            }
        ],
        FieldGroup#GeneralData: {
            Data: [
                { Value: requestNo, Label: 'Request No' },
                { Value: description, Label: 'Description' },
                { Value: companyCode_code, Label: 'Company Code' },
                { Value: vendor_code, Label: 'Vendor' },
                { Value: requestDate, Label: 'Request Date' },
                { Value: dueDate, Label: 'Due Date' }
            ]
        },
        FieldGroup#PaymentDetails: {
            Data: [
                { Value: paymentMethod_code, Label: 'Payment Method' },
                { Value: totalAmount, Label: 'Total Amount' },
                { Value: currency_code, Label: 'Currency' },
                { Value: status, Label: 'Status', Criticality: criticality },
                { Value: rejectionReason, Label: 'Rejection Reason' }
            ]
        },
        FieldGroup#SAPIntegration: {
            Data: [
                { Value: workflowInstanceId, Label: 'BPA Workflow Instance ID' },
                { Value: sapSupplierInvoiceNo, Label: 'S/4HANA Supplier Invoice Doc' },
                { Value: sapFiscalYear, Label: 'Fiscal Year' },
                { Value: sapPostingDate, Label: 'Posting Date' }
            ]
        }
    }
);

// ----------------------------------------------------
// PAYMENT REQUEST ITEMS - UI ANNOTATIONS
// ----------------------------------------------------

annotate PaymentService.PaymentRequestItems with @(
    UI: {
        LineItem: [
            {
                $Type: 'UI.DataField',
                Value: itemNo,
                Label: 'Item'
            },
            {
                $Type: 'UI.DataField',
                Value: itemDescription,
                Label: 'Description'
            },
            {
                $Type: 'UI.DataField',
                Value: glAccount_code,
                Label: 'G/L Account'
            },
            {
                $Type: 'UI.DataField',
                Value: costCenter_code,
                Label: 'Cost Center'
            },
            {
                $Type: 'UI.DataField',
                Value: amount,
                Label: 'Amount'
            },
            {
                $Type: 'UI.DataField',
                Value: taxCode,
                Label: 'Tax Code'
            },
            {
                $Type: 'UI.DataField',
                Value: taxAmount,
                Label: 'Tax Amount'
            }
        ]
    }
);

// ----------------------------------------------------
// EVENT LOGS - UI ANNOTATIONS
// ----------------------------------------------------

annotate PaymentService.EventLogs with @(
    UI: {
        LineItem: [
            {
                $Type: 'UI.DataField',
                Value: eventName,
                Label: 'Event Name'
            },
            {
                $Type: 'UI.DataField',
                Value: topic,
                Label: 'Topic'
            },
            {
                $Type: 'UI.DataField',
                Value: status,
                Label: 'Status'
            },
            {
                $Type: 'UI.DataField',
                Value: payload,
                Label: 'CloudEvent Payload'
            },
            {
                $Type: 'UI.DataField',
                Value: createdAt,
                Label: 'Timestamp'
            }
        ]
    }
);

// ----------------------------------------------------
// INTEGRATION LOGS - UI ANNOTATIONS
// ----------------------------------------------------

annotate PaymentService.IntegrationLogs with @(
    UI: {
        LineItem: [
            {
                $Type: 'UI.DataField',
                Value: step,
                Label: 'Integration Step'
            },
            {
                $Type: 'UI.DataField',
                Value: endpoint,
                Label: 'CPI Endpoint'
            },
            {
                $Type: 'UI.DataField',
                Value: httpStatus,
                Label: 'HTTP Status'
            },
            {
                $Type: 'UI.DataField',
                Value: status,
                Label: 'Status'
            },
            {
                $Type: 'UI.DataField',
                Value: requestPayload,
                Label: 'S/4HANA Request Payload'
            },
            {
                $Type: 'UI.DataField',
                Value: responsePayload,
                Label: 'CPI / S/4 Response'
            },
            {
                $Type: 'UI.DataField',
                Value: createdAt,
                Label: 'Timestamp'
            }
        ]
    }
);

// ----------------------------------------------------
// VALUE HELPS (F4 & DROPDOWNS)
// ----------------------------------------------------

annotate PaymentService.PaymentRequests with {
    companyCode @(
        Common: {
            Text: companyCode.name,
            TextArrangement: #TextFirst,
            ValueList: {
                Label: 'Company Codes',
                CollectionPath: 'CompanyCodes',
                Parameters: [
                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: companyCode_code, ValueListProperty: 'code' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
                ]
            }
        }
    );

    vendor @(
        Common: {
            Text: vendor.name,
            TextArrangement: #TextFirst,
            ValueList: {
                Label: 'Vendors',
                CollectionPath: 'Vendors',
                Parameters: [
                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: vendor_code, ValueListProperty: 'code' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'bankAccount' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'bankName' }
                ]
            }
        }
    );

    paymentMethod @(
        Common: {
            Text: paymentMethod.name,
            TextArrangement: #TextFirst,
            ValueList: {
                Label: 'Payment Methods',
                CollectionPath: 'PaymentMethods',
                Parameters: [
                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: paymentMethod_code, ValueListProperty: 'code' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
                ]
            }
        }
    );
};

annotate PaymentService.PaymentRequestItems with {
    glAccount @(
        Common: {
            Text: glAccount.name,
            TextArrangement: #TextFirst,
            ValueList: {
                Label: 'G/L Accounts',
                CollectionPath: 'GLAccounts',
                Parameters: [
                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: glAccount_code, ValueListProperty: 'code' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
                ]
            }
        }
    );

    costCenter @(
        Common: {
            Text: costCenter.name,
            TextArrangement: #TextFirst,
            ValueList: {
                Label: 'Cost Centers',
                CollectionPath: 'CostCenters',
                Parameters: [
                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: costCenter_code, ValueListProperty: 'code' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
                ]
            }
        }
    );
};
