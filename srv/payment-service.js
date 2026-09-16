/**
 * @file payment-service.js
 * @description Payment Service Implementation Handler
 * Handles CRUD lifecycles, validations, workflow actions (Submit, Approve, Reject)
 * and S/4HANA invoice posting integration callbacks.
 */

const cds = require('@sap/cds');
const { STATUS, CRITICALITY, PREFIX, EVENTS } = require('./constants');

module.exports = cds.service.impl(async function () {
    const { PaymentRequests } = this.entities;

    // =========================================================================
    // 1. PUBLIC LIFECYCLE HANDLERS
    // =========================================================================

    /**
     * Handler chạy trước khi tạo mới Payment Request
     * Tự động sinh mã requestNo và gán các giá trị mặc định
     */
    this.before('CREATE', 'PaymentRequests', async (req) => {
        await this._setDefaultHeaderValues(req);
    });

    /**
     * Handler chạy trước khi lưu (Save Draft -> Active)
     * Tính toán tổng tiền Header từ các Line Items và gán Criticality
     */
    this.before('SAVE', 'PaymentRequests', async (req) => {
        this._calculateTotalAmountAndLineItems(req);
    });

    // =========================================================================
    // 2. PUBLIC ACTIONS & EVENT HANDLERS
    // =========================================================================

    /**
     * Action gửi đơn yêu cầu thanh toán vào quy trình phê duyệt (BPA Workflow)
     * @param {Object} req - CAP Request Object
     * @returns {Promise<Object>} Updated Payment Request
     */
    this.on('submitForApproval', 'PaymentRequests', async (req) => {
        return await this._handleSubmitForApproval(req);
    });

    /**
     * Action phê duyệt đơn thanh toán
     * @param {Object} req - CAP Request Object
     * @returns {Promise<Object>} Updated Payment Request
     */
    this.on('approve', 'PaymentRequests', async (req) => {
        return await this._handleApprove(req);
    });

    /**
     * Action từ chối đơn thanh toán kèm lý do
     * @param {Object} req - CAP Request Object
     * @returns {Promise<Object>} Updated Payment Request
     */
    this.on('reject', 'PaymentRequests', async (req) => {
        return await this._handleReject(req);
    });

    /**
     * Action nhận callback từ SAP CPI sau khi hạch toán thành công vào S/4HANA
     * Cập nhật trạng thái POSTED cùng số hóa đơn (Supplier Invoice Number)
     * @param {Object} req - CAP Request Object
     * @returns {Promise<Object>} Updated Payment Request
     */
    this.on('updatePostedStatus', 'PaymentRequests', async (req) => {
        return await this._handleUpdatePostedStatus(req);
    });

    /**
     * Action giả lập quy trình CPI hạch toán vào S/4HANA (phục vụ test cục bộ)
     * @param {Object} req - CAP Request Object
     * @returns {Promise<Object>} Updated Payment Request
     */
    this.on('simulateS4Posting', 'PaymentRequests', async (req) => {
        return await this._handleSimulateS4Posting(req);
    });

    // =========================================================================
    // 3. PRIVATE HELPER FUNCTIONS (Prefixed with _)
    // =========================================================================

    /**
     * Thiết lập các giá trị mặc định cho Header khi tạo mới
     * @private
     * @param {Object} req - Request object
     */
    this._setDefaultHeaderValues = async function (req) {
        if (!req.data.requestNo) {
            req.data.requestNo = await this._generateNextRequestNo();
        }

        if (!req.data.requestDate) {
            req.data.requestDate = new Date().toISOString().split('T')[0];
        }

        req.data.status = req.data.status || STATUS.DRAFT;
        req.data.criticality = this._mapStatusToCriticality(req.data.status);
    };

    /**
     * Tính toán tổng tiền từ các Line Item và tự động đánh số thứ tự Item No
     * @private
     * @param {Object} req - Request object
     */
    this._calculateTotalAmountAndLineItems = function (req) {
        const header = req.data;
        if (header.items && header.items.length > 0) {
            let total = 0;
            header.items.forEach((item, index) => {
                item.itemNo = index + 1;
                total += Number(item.amount || 0);
            });
            header.totalAmount = total;
        }
        header.criticality = this._mapStatusToCriticality(header.status);
    };

    /**
     * Xử lý nghiệp vụ gửi duyệt
     * @private
     * @param {Object} req - Request object
     * @returns {Promise<Object>}
     */
    this._handleSubmitForApproval = async function (req) {
        const id = req.params[0]?.ID || req.params[0];
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });

        if (!request) {
            return req.error(404, 'msg.error.notFound');
        }

        if (request.status !== STATUS.DRAFT && request.status !== STATUS.REJECTED) {
            return req.error(400, `Cannot submit payment request in status "${request.status}"`);
        }

        const workflowId = `${PREFIX.WORKFLOW_INSTANCE}${Date.now().toString().slice(-6)}`;

        await UPDATE(PaymentRequests).set({
            status: STATUS.IN_APPROVAL,
            workflowInstanceId: workflowId,
            criticality: this._mapStatusToCriticality(STATUS.IN_APPROVAL)
        }).where({ ID: id });

        // Phát sự kiện lên SAP Event Mesh
        this.emit(EVENTS.PAYMENT_REQUEST_SUBMITTED, {
            requestNo: request.requestNo,
            companyCode: request.companyCode_code,
            vendorCode: request.vendor_code,
            totalAmount: request.totalAmount,
            currency: request.currency_code,
            dueDate: request.dueDate
        });

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    };

    /**
     * Xử lý nghiệp vụ phê duyệt đơn
     * @private
     * @param {Object} req - Request object
     * @returns {Promise<Object>}
     */
    this._handleApprove = async function (req) {
        const id = req.params[0]?.ID || req.params[0];
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });

        if (!request) {
            return req.error(404, 'msg.error.notFound');
        }

        if (request.status !== STATUS.IN_APPROVAL && request.status !== STATUS.SUBMITTED) {
            return req.error(400, `Cannot approve payment request with status "${request.status}"`);
        }

        await UPDATE(PaymentRequests).set({
            status: STATUS.APPROVED,
            criticality: this._mapStatusToCriticality(STATUS.APPROVED)
        }).where({ ID: id });

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    };

    /**
     * Xử lý nghiệp vụ từ chối đơn
     * @private
     * @param {Object} req - Request object
     * @returns {Promise<Object>}
     */
    this._handleReject = async function (req) {
        const id = req.params[0]?.ID || req.params[0];
        const { reason } = req.data;
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });

        if (!request) {
            return req.error(404, 'msg.error.notFound');
        }

        await UPDATE(PaymentRequests).set({
            status: STATUS.REJECTED,
            rejectionReason: reason || 'Rejected by approver',
            criticality: this._mapStatusToCriticality(STATUS.REJECTED)
        }).where({ ID: id });

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    };

    /**
     * Xử lý callback cập nhật trạng thái POSTED từ CPI/S4HANA
     * @private
     * @param {Object} req - Request object
     * @returns {Promise<Object>}
     */
    this._handleUpdatePostedStatus = async function (req) {
        const id = req.params[0]?.ID || req.params[0];
        const { sapSupplierInvoiceNo, sapFiscalYear, sapPostingDate } = req.data;

        await UPDATE(PaymentRequests).set({
            status: STATUS.POSTED,
            sapSupplierInvoiceNo,
            sapFiscalYear: sapFiscalYear || new Date().getFullYear().toString(),
            sapPostingDate: sapPostingDate || new Date().toISOString().split('T')[0],
            criticality: this._mapStatusToCriticality(STATUS.POSTED)
        }).where({ ID: id });

        this.emit(EVENTS.PAYMENT_REQUEST_POSTED, {
            requestNo: req.params[0]?.requestNo,
            sapSupplierInvoiceNo,
            sapFiscalYear,
            sapPostingDate
        });

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    };

    /**
     * Giả lập hạch toán S/4HANA (Tạo số hóa đơn 10 chữ số)
     * @private
     * @param {Object} req - Request object
     * @returns {Promise<Object>}
     */
    this._handleSimulateS4Posting = async function (req) {
        const id = req.params[0]?.ID || req.params[0];
        const request = await SELECT.one.from(PaymentRequests).where({ ID: id });

        if (!request) {
            return req.error(404, 'msg.error.notFound');
        }

        if (request.status !== STATUS.APPROVED) {
            return req.error(400, 'Only APPROVED payment requests can be posted to S/4HANA');
        }

        const docNo = `${PREFIX.SAP_INVOICE_DOC}${Math.floor(10000 + Math.random() * 90000)}`;
        const fiscalYear = new Date().getFullYear().toString();
        const postingDate = new Date().toISOString().split('T')[0];

        await UPDATE(PaymentRequests).set({
            status: STATUS.POSTED,
            sapSupplierInvoiceNo: docNo,
            sapFiscalYear: fiscalYear,
            sapPostingDate: postingDate,
            criticality: this._mapStatusToCriticality(STATUS.POSTED)
        }).where({ ID: id });

        return await SELECT.one.from(PaymentRequests).where({ ID: id });
    };

    /**
     * Tự động sinh mã Request No tiếp theo theo năm: PR-YYYY-XXXX
     * @private
     * @returns {Promise<string>} Next request number
     */
    this._generateNextRequestNo = async function () {
        const year = new Date().getFullYear();
        const result = await SELECT.one.from(PaymentRequests).columns('max(requestNo) as maxNo');
        let nextIndex = 1;

        if (result && result.maxNo) {
            const regex = new RegExp(`^${PREFIX.REQUEST_NO}\\d{4}-(\\d+)$`);
            const match = result.maxNo.match(regex);
            if (match) {
                nextIndex = parseInt(match[1], 10) + 1;
            }
        }

        return `${PREFIX.REQUEST_NO}${year}-${String(nextIndex).padStart(4, '0')}`;
    };

    /**
     * Ánh xạ trạng thái sang mã màu hiển thị Fiori
     * @private
     * @param {string} status - Trạng thái đơn
     * @returns {number} Criticality code (0, 1, 2, 3)
     */
    this._mapStatusToCriticality = function (status) {
        switch (status) {
            case STATUS.POSTED:
            case STATUS.APPROVED:
                return CRITICALITY.POSITIVE;
            case STATUS.IN_APPROVAL:
            case STATUS.SUBMITTED:
            case STATUS.POSTING:
                return CRITICALITY.CRITICAL;
            case STATUS.REJECTED:
            case STATUS.FAILED:
                return CRITICALITY.NEGATIVE;
            case STATUS.DRAFT:
            default:
                return CRITICALITY.NEUTRAL;
        }
    };
});
