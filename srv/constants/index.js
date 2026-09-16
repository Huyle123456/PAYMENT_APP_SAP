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

const CRITICALITY = Object.freeze({
    NEUTRAL: 0,
    NEGATIVE: 1, // Error / Rejected (Red)
    CRITICAL: 2, // Warning / In-Progress (Orange)
    POSITIVE: 3  // Success / Posted (Green)
});

const PREFIX = Object.freeze({
    PAYMENT_REQUEST: 'PR-',
    WORKFLOW: 'BPA-WF-',
    INVOICE_DOC: '51056'
});

module.exports = {
    STATUS,
    CRITICALITY,
    PREFIX
};
