const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
    const { PaymentRequests, PaymentRequestItems, EventLogs, IntegrationLogs, Vendors, CompanyCodes } = this.entities;

    // Criticality mapping helper: 0: Neutral, 1: Error/Negative (Red), 2: Warning/In-Progress (Orange), 3: Success/Positive (Green)
    function getCriticality(status) {
        switch (status) {
            case 'POSTED':
            case 'APPROVED':
                return 3;
            case 'IN_APPROVAL':
            case 'SUBMITTED':
            case 'POSTING':
                return 2;
            case 'REJECTED':
            case 'FAILED':
                return 1;
            case 'DRAFT':
            default:
                return 0;
        }
    }

    // Auto-generate Request Number & calculate defaults on CREATE
    this.before('CREATE', 'PaymentRequests', async (req) => {
        if (!req.data.requestNo) {
            const year = new Date().getFullYear();
            const result = await SELECT.one.from(PaymentRequests).columns('max(requestNo) as maxNo');
            let nextIndex = 1;
            if (result && result.maxNo) {
                const match = result.maxNo.match(/PR-\d{4}-(\d+)/);
                if (match) {
                    nextIndex = parseInt(match[1], 10) + 1;
                }
            }
            req.data.requestNo = `PR-${year}-${String(nextIndex).padStart(4, '0')}`;
        }

        if (!req.data.requestDate) {
            req.data.requestDate = new Date().toISOString().split('T')[0];
        }

        req.data.status = req.data.status || 'DRAFT';
        req.data.criticality = getCriticality(req.data.status);
    });

    // Auto calculate Total Amount and item numbers on SAVE (Draft -> Active)
    this.before('SAVE', 'PaymentRequests', async (req) => {
        const header = req.data;
        if (header.items && header.items.length > 0) {
            let total = 0;
            header.items.forEach((item, index) => {
                item.itemNo = index + 1;
                total += Number(item.amount || 0);
            });
            header.totalAmount = total;
        }
        header.criticality = getCriticality(header.status);
    });

    // Helper: log Event Mesh message
    async function logEvent(eventName, topic, reqId, requestNo, payload) {
        try {
            await INSERT.into(EventLogs).entries({
                eventName,
                topic,
                paymentRequest_ID: reqId,
                requestNo,
                payload: JSON.stringify(payload, null, 2),
                status: 'DELIVERED'
            });
        } catch (e) {
            console.error('Failed to log event mesh event:', e);
        }
    }

    // Helper: log Integration Suite message
    async function logIntegration(reqId, requestNo, step, endpoint, reqPayload, resPayload, httpStatus = 200) {
        try {
            await INSERT.into(IntegrationLogs).entries({
                paymentRequest_ID: reqId,
                requestNo,
                step,
                endpoint,
                requestPayload: typeof reqPayload === 'string' ? reqPayload : JSON.stringify(reqPayload, null, 2),
                responsePayload: typeof resPayload === 'string' ? resPayload : JSON.stringify(resPayload, null, 2),
                httpStatus,
                status: httpStatus >= 200 && httpStatus < 300 ? 'SUCCESS' : 'ERROR'
            });
        } catch (e) {
            console.error('Failed to log integration:', e);
        }
    }

    // ACTION: submitForApproval
    this.on('submitForApproval', 'PaymentRequests', async (req) => {
        const id = req.params[0]?.ID || req.params[0];
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });
        if (!request) return req.error(404, 'Payment Request not found');

        if (request.status !== 'DRAFT' && request.status !== 'REJECTED') {
            return req.error(400, `Cannot submit request in status "${request.status}"`);
        }

        const workflowId = `BPA-WF-${Date.now().toString().slice(-6)}`;
        await UPDATE(PaymentRequests).set({
            status: 'IN_APPROVAL',
            workflowInstanceId: workflowId,
            rejectionReason: null,
            criticality: getCriticality('IN_APPROVAL')
        }).where({ ID: id });

        const eventData = {
            requestNo: request.requestNo,
            workflowInstanceId: workflowId,
            companyCode: request.companyCode_code,
            vendorCode: request.vendor_code,
            totalAmount: request.totalAmount,
            currency: request.currency_code,
            dueDate: request.dueDate,
            submittedAt: new Date().toISOString()
        };

        // Emit Event for SAP Event Mesh
        this.emit('PaymentRequestSubmitted', eventData);

        // Record in Event Log
        await logEvent(
            'PaymentRequestSubmitted',
            'sap/payment/v1/PaymentRequest/Submitted',
            id,
            request.requestNo,
            eventData
        );

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    });

    // ACTION: approve
    this.on('approve', 'PaymentRequests', async (req) => {
        const id = req.params[0]?.ID || req.params[0];
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });
        if (!request) return req.error(404, 'Payment Request not found');

        if (request.status !== 'IN_APPROVAL' && request.status !== 'SUBMITTED') {
            return req.error(400, `Cannot approve request with status "${request.status}"`);
        }

        await UPDATE(PaymentRequests).set({
            status: 'APPROVED',
            criticality: getCriticality('APPROVED')
        }).where({ ID: id });

        const approvalData = {
            requestNo: request.requestNo,
            workflowId: request.workflowInstanceId,
            approvedBy: req.user?.id || 'finance_approver_01',
            approvedAt: new Date().toISOString()
        };

        this.emit('PaymentRequestApproved', approvalData);

        await logEvent(
            'PaymentRequestApproved',
            'sap/payment/v1/PaymentRequest/Approved',
            id,
            request.requestNo,
            approvalData
        );

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    });

    // ACTION: reject
    this.on('reject', 'PaymentRequests', async (req) => {
        const id = req.params[0]?.ID || req.params[0];
        const { reason } = req.data;
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });
        if (!request) return req.error(404, 'Payment Request not found');

        if (request.status !== 'IN_APPROVAL' && request.status !== 'SUBMITTED') {
            return req.error(400, `Cannot reject request with status "${request.status}"`);
        }

        const rejectionReason = reason || 'Rejected by finance approver during BPA review';

        await UPDATE(PaymentRequests).set({
            status: 'REJECTED',
            rejectionReason,
            criticality: getCriticality('REJECTED')
        }).where({ ID: id });

        const rejectData = {
            requestNo: request.requestNo,
            rejectedBy: req.user?.id || 'finance_approver_01',
            rejectionReason,
            rejectedAt: new Date().toISOString()
        };

        await logEvent(
            'PaymentRequestRejected',
            'sap/payment/v1/PaymentRequest/Rejected',
            id,
            request.requestNo,
            rejectData
        );

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    });

    // ACTION: postToS4HanaThroughCPI / simulateS4Posting
    const handleS4Posting = async (req) => {
        const id = req.params[0]?.ID || req.params[0];
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });
        if (!request) return req.error(404, 'Payment Request not found');

        if (request.status !== 'APPROVED') {
            return req.error(400, `Only APPROVED payment requests can be posted to S/4HANA (Current status: ${request.status})`);
        }

        // Fetch line items
        const items = await SELECT.from(PaymentRequestItems).where({ parent_ID: id });

        // Generate S/4HANA Supplier Invoice Document Number (Standard format: 51056xxxxx)
        const s4DocNo = `51056${Math.floor(10000 + Math.random() * 90000)}`;
        const fiscalYear = new Date().getFullYear().toString();
        const postingDate = new Date().toISOString().split('T')[0];

        // Format Standard S/4HANA Supplier Invoice OData Payload (API_SUPPLIERINVOICE_PROCESS_SRV / A_SupplierInvoice)
        const s4RequestPayload = {
            "CompanyCode": request.companyCode_code || "1000",
            "DocumentDate": request.requestDate || postingDate,
            "PostingDate": postingDate,
            "InvoicingParty": request.vendor_code || "VEND-1001",
            "DocumentCurrency": request.currency_code || "VND",
            "InvoiceGrossAmount": Number(request.totalAmount || 0),
            "AccountingDocumentHeaderText": `PR-${request.requestNo}`,
            "SupplierInvoiceIDByInvcgParty": `INV-${request.requestNo}`,
            "to_SuplrInvcItemGLAcct": items.map((item, idx) => ({
                "SupplierInvoiceItem": String(idx + 1),
                "CostCenter": item.costCenter_code || "CC-IT01",
                "GLAccount": item.glAccount_code || "642100",
                "SupplierInvoiceItemAmount": Number(item.amount || 0),
                "TaxCode": item.taxCode || "V0",
                "SupplierInvoiceItemText": item.itemDescription || request.description
            }))
        };

        const s4ResponsePayload = {
            "d": {
                "SupplierInvoice": s4DocNo,
                "FiscalYear": fiscalYear,
                "CompanyCode": request.companyCode_code || "1000",
                "PostingDate": `/Date(${Date.now()})/`,
                "DocumentStatus": "5", // 5 = Posted
                "InvoiceGrossAmount": String(request.totalAmount),
                "DocumentCurrency": request.currency_code || "VND",
                "Message": `Supplier Invoice ${s4DocNo}/${fiscalYear} successfully created and posted in S/4HANA`
            }
        };

        // Record CPI iFlow Outbound/Inbound Log
        await logIntegration(
            id,
            request.requestNo,
            'CPI_TO_S4HANA_POSTING',
            'https://cpi.cfapps.ap10.hana.ondemand.com/http/s4hana/supplierinvoice/create',
            s4RequestPayload,
            s4ResponsePayload,
            201
        );

        // Update Payment Request status to POSTED
        await UPDATE(PaymentRequests).set({
            status: 'POSTED',
            sapSupplierInvoiceNo: s4DocNo,
            sapFiscalYear: fiscalYear,
            sapPostingDate: postingDate,
            criticality: getCriticality('POSTED')
        }).where({ ID: id });

        // Emit Event Mesh event
        const postedEvent = {
            requestNo: request.requestNo,
            sapSupplierInvoiceNo: s4DocNo,
            sapFiscalYear: fiscalYear,
            sapPostingDate: postingDate,
            totalAmount: request.totalAmount,
            currency: request.currency_code
        };

        this.emit('PaymentRequestPosted', postedEvent);

        await logEvent(
            'PaymentRequestPosted',
            'sap/payment/v1/PaymentRequest/Posted',
            id,
            request.requestNo,
            postedEvent
        );

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    };

    this.on('simulateS4Posting', 'PaymentRequests', handleS4Posting);
    this.on('postToS4HanaThroughCPI', 'PaymentRequests', handleS4Posting);

    // ACTION: updatePostedStatus (Callback endpoint)
    this.on('updatePostedStatus', 'PaymentRequests', async (req) => {
        const id = req.params[0]?.ID || req.params[0];
        const { sapSupplierInvoiceNo, sapFiscalYear, sapPostingDate } = req.data;
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });
        if (!request) return req.error(404, 'Payment Request not found');

        await UPDATE(PaymentRequests).set({
            status: 'POSTED',
            sapSupplierInvoiceNo,
            sapFiscalYear: sapFiscalYear || new Date().getFullYear().toString(),
            sapPostingDate: sapPostingDate || new Date().toISOString().split('T')[0],
            criticality: getCriticality('POSTED')
        }).where({ ID: id });

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    });

    // ACTION: runFullWorkflowSimulation
    this.on('runFullWorkflowSimulation', async (req) => {
        const { paymentRequestId } = req.data;
        let request = await SELECT.one.from(PaymentRequests).where({ ID: paymentRequestId });
        if (!request) return req.error(404, 'Payment Request not found');

        // Step 1: Reset to DRAFT if already processed
        if (request.status !== 'DRAFT') {
            await UPDATE(PaymentRequests).set({
                status: 'DRAFT',
                workflowInstanceId: null,
                rejectionReason: null,
                sapSupplierInvoiceNo: null,
                sapFiscalYear: null,
                sapPostingDate: null,
                criticality: getCriticality('DRAFT')
            }).where({ ID: paymentRequestId });
        }

        // Step 2: Submit
        const workflowId = `BPA-WF-${Date.now().toString().slice(-6)}`;
        await UPDATE(PaymentRequests).set({
            status: 'IN_APPROVAL',
            workflowInstanceId: workflowId,
            criticality: getCriticality('IN_APPROVAL')
        }).where({ ID: paymentRequestId });

        await logEvent(
            'PaymentRequestSubmitted',
            'sap/payment/v1/PaymentRequest/Submitted',
            paymentRequestId,
            request.requestNo,
            { requestNo: request.requestNo, workflowId, amount: request.totalAmount }
        );

        // Step 3: Approve
        await UPDATE(PaymentRequests).set({
            status: 'APPROVED',
            criticality: getCriticality('APPROVED')
        }).where({ ID: paymentRequestId });

        await logEvent(
            'PaymentRequestApproved',
            'sap/payment/v1/PaymentRequest/Approved',
            paymentRequestId,
            request.requestNo,
            { requestNo: request.requestNo, workflowId, approvedBy: 'auto_bpa_simulator' }
        );

        // Step 4: Post to S/4HANA via CPI
        const s4DocNo = `51056${Math.floor(10000 + Math.random() * 90000)}`;
        const fiscalYear = new Date().getFullYear().toString();
        const postingDate = new Date().toISOString().split('T')[0];

        const items = await SELECT.from(PaymentRequestItems).where({ parent_ID: paymentRequestId });

        await logIntegration(
            paymentRequestId,
            request.requestNo,
            'CPI_TO_S4HANA_POSTING',
            'https://cpi.cfapps.ap10.hana.ondemand.com/http/s4hana/supplierinvoice/create',
            {
                CompanyCode: request.companyCode_code || "1000",
                DocumentDate: request.requestDate || postingDate,
                PostingDate: postingDate,
                InvoicingParty: request.vendor_code || "VEND-1001",
                InvoiceGrossAmount: request.totalAmount,
                ItemsCount: items.length
            },
            {
                SupplierInvoice: s4DocNo,
                FiscalYear: fiscalYear,
                Status: "POSTED_SUCCESS"
            },
            201
        );

        await UPDATE(PaymentRequests).set({
            status: 'POSTED',
            sapSupplierInvoiceNo: s4DocNo,
            sapFiscalYear: fiscalYear,
            sapPostingDate: postingDate,
            criticality: getCriticality('POSTED')
        }).where({ ID: paymentRequestId });

        await logEvent(
            'PaymentRequestPosted',
            'sap/payment/v1/PaymentRequest/Posted',
            paymentRequestId,
            request.requestNo,
            { requestNo: request.requestNo, sapSupplierInvoiceNo: s4DocNo, fiscalYear }
        );

        return await SELECT.one.from(PaymentRequests).where({ ID: paymentRequestId });
    });
});
