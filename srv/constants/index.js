/**
 * Payment Application Constants
 */

/**
 * Trạng thái của Payment Request
 */
const STATUS = Object.freeze({
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    IN_APPROVAL: 'IN_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    POSTING: 'POSTING',
    POSTED: 'POSTED',
    FAILED: 'FAILED'
});

/**
 * Màu sắc hiển thị trạng thái trên SAP Fiori (Criticality)
 * 0: Neutral (Xám), 1: Negative/Error (Đỏ), 2: Critical/Warning (Vàng/Cam), 3: Positive/Success (Xanh lá)
 */
const CRITICALITY = Object.freeze({
    NEUTRAL: 0,
    NEGATIVE: 1,
    CRITICAL: 2,
    POSITIVE: 3
});

/**
 * Tiền tố mã định danh
 */
const PREFIX = Object.freeze({
    REQUEST_NO: 'PR-',
    WORKFLOW_INSTANCE: 'BPA-WF-',
    SAP_INVOICE_DOC: '51056'
});

/**
 * Tên các Topic Event Mesh
 */
const EVENTS = Object.freeze({
    PAYMENT_REQUEST_SUBMITTED: 'PaymentRequestSubmitted',
    PAYMENT_REQUEST_POSTED: 'PaymentRequestPosted'
});

module.exports = {
    STATUS,
    CRITICALITY,
    PREFIX,
    EVENTS
};
