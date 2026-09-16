const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
    const { PaymentRequests, PaymentRequestItems } = this.entities;

    // Criticality mapping helper: 0: Neutral, 1: Error/Negative (Red), 2: Warning/In-Progress (Orange), 3: Success/Positive (Green)
    function getCriticality(status) {
        switch (status) {
            case 'POSTED':
                return 3;
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

    // Auto calculate Total Amount and validate on SAVE (Draft -> Active)
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
            criticality: getCriticality('IN_APPROVAL')
        }).where({ ID: id });

        // Emit Event for SAP Event Mesh
        this.emit('PaymentRequestSubmitted', {
            requestNo: request.requestNo,
            companyCode: request.companyCode_code,
            vendorCode: request.vendor_code,
            totalAmount: request.totalAmount,
            currency: request.currency_code,
            dueDate: request.dueDate
        });

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

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    });

    // ACTION: reject
    this.on('reject', 'PaymentRequests', async (req) => {
        const id = req.params[0]?.ID || req.params[0];
        const { reason } = req.data;
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });
        if (!request) return req.error(404, 'Payment Request not found');

        await UPDATE(PaymentRequests).set({
            status: 'REJECTED',
            rejectionReason: reason || 'Rejected by approver',
            criticality: getCriticality('REJECTED')
        }).where({ ID: id });

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    });

    // ACTION: updatePostedStatus (Callback from CPI / S4HANA)
    this.on('updatePostedStatus', 'PaymentRequests', async (req) => {
        const id = req.params[0]?.ID || req.params[0];
        const { sapSupplierInvoiceNo, sapFiscalYear, sapPostingDate } = req.data;

        await UPDATE(PaymentRequests).set({
            status: 'POSTED',
            sapSupplierInvoiceNo,
            sapFiscalYear: sapFiscalYear || new Date().getFullYear().toString(),
            sapPostingDate: sapPostingDate || new Date().toISOString().split('T')[0],
            criticality: getCriticality('POSTED')
        }).where({ ID: id });

        this.emit('PaymentRequestPosted', {
            requestNo: req.params[0]?.requestNo,
            sapSupplierInvoiceNo,
            sapFiscalYear,
            sapPostingDate
        });

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    });

    // ACTION: simulateS4Posting (Helper to simulate CPI -> S/4HANA flow)
    this.on('simulateS4Posting', 'PaymentRequests', async (req) => {
        const id = req.params[0]?.ID || req.params[0];
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });
        if (!request) return req.error(404, 'Payment Request not found');

        if (request.status !== 'APPROVED') {
            return req.error(400, 'Only APPROVED payment requests can be posted to S/4HANA');
        }

        // Generate simulated S/4HANA Document No. (Supplier Invoice: 51056xxxxx)
        const docNo = `51056${Math.floor(10000 + Math.random() * 90000)}`;
        const fiscalYear = new Date().getFullYear().toString();
        const postingDate = new Date().toISOString().split('T')[0];

        await UPDATE(PaymentRequests).set({
            status: 'POSTED',
            sapSupplierInvoiceNo: docNo,
            sapFiscalYear: fiscalYear,
            sapPostingDate: postingDate,
            criticality: getCriticality('POSTED')
        }).where({ ID: id });

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    });
});
