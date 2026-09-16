# 📜 TIÊU CHUẨN VÀ NGUYÊN TẮC PHÁT TRIỂN DỰ ÁN (CODING CONVENTIONS)

Tài liệu này định nghĩa các quy chuẩn lập trình bắt buộc áp dụng cho toàn bộ dự án **PAYMENT_APP_CAP** (SAP CAP & SAPUI5 / Fiori). Tất cả thành viên tham gia phát triển phải tuân thủ nghiêm ngặt các nguyên tắc dưới đây.

---

## 1. 🌐 ĐA NGÔN NGỮ BẮT BUỘC (i18n - Internationalization)

* **Không bao giờ hardcode text:** Tuyệt đối không viết cứng chuỗi ký tự hiển thị (tiêu đề, nhãn nút, thông báo lỗi, tooltip, confirm dialog,...) trực tiếp trong code Javascript/XML/CDS.
* **Tất cả văn bản hiển thị phải được định nghĩa trong file `i18n`:**
  * **Frontend (UI5/Fiori):** Lưu tại `webapp/i18n/i18n.properties` (hoặc `i18n_vi.properties`, `i18n_en.properties`).
  * **Backend (SAP CAP):** Sử dụng `_i18n/messages.properties` hoặc `@title: '{i18n>KeyName}'` trong `.cds`.
* **Quy tắc đặt tên key (Naming Convention):**
  * Tiêu đề: `title.<screen>.<component>` (ví dụ: `title.paymentRequest.create`)
  * Nhãn nhãn input/cột: `label.<entity>.<field>` (ví dụ: `label.paymentRequest.vendor`)
  * Nút bấm: `btn.<action>` (ví dụ: `btn.submitApproval`, `btn.cancel`)
  * Thông báo: `msg.<type>.<content>` (ví dụ: `msg.success.submitApproval`, `msg.error.invalidAmount`)

---

## 2. 📦 QUẢN LÝ BIẾN DÙNG LẠI & CONSTANTS (Reusable Constants)

* **Không dùng Magic Strings / Magic Numbers:** Bất kỳ giá trị nào xuất hiện từ 2 lần trở lên hoặc đại diện cho trạng thái, mã cấu hình, type enum phải được đưa vào file hằng số.
* **Cấu trúc thư mục:**
  * **Backend (CAP):** Tạo file `srv/constants/` hoặc `srv/utils/constants.js`.
  * **Frontend (UI5):** Tạo file `webapp/model/constants.js` hoặc `constants/`.
* **Quy tắc đặt tên:**
  * Tên biến constant viết **UPPER_SNAKE_CASE**.
  * Gom nhóm logic theo Object/Enum `Object.freeze({...})`.

#### Ví dụ chuẩn (Backend `srv/constants/index.js`):
```javascript
const STATUS = Object.freeze({
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    IN_APPROVAL: 'IN_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
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
```

---

## 3. 🏗️ CẤU TRÚC CONTROLLER & SERVICE HANDLER (Method Ordering)

Trong tất cả các file Controller (UI5) và Service Handler (CAP Javascript), code phải được sắp xếp theo đúng thứ tự logic từ trên xuống dưới:

### Thứ tự bắt buộc:
1. **Import / Requires & Khởi tạo Constants**
2. **Lifecycle Hooks / Event Handlers công khai (Public Functions / Handlers):**
   * CAP: `this.before()`, `this.on()`, `this.after()`
   * UI5: `onInit()`, `onBeforeRendering()`, `onAfterRendering()`, `onExit()`
3. **Public / Event Handler Methods (Xử lý sự kiện người dùng/Action):**
   * UI5: `onSavePress()`, `onSubmitApproval()`, `onFilterChange()`
   * CAP: Các custom action handlers (`onSubmitForApproval`, `onApprove`, `onReject`)
4. **Private Helper Functions (Hàm nội bộ / phụ trợ):**
   * **Bắt buộc có tiền tố dấu gạch dưới `_`** (ví dụ: `_calculateTotalAmount`, `_validateHeader`, `_formatDate`).
   * Đặt ở cuối file / cuối class.

#### Ví dụ chuẩn cấu trúc Controller / Service:
```javascript
const cds = require('@sap/cds');
const { STATUS, CRITICALITY, PREFIX } = require('./constants');

module.exports = cds.service.impl(async function () {
    const { PaymentRequests } = this.entities;

    // ==========================================
    // 1. LIFECYCLE HOOKS (Public)
    // ==========================================
    this.before('CREATE', 'PaymentRequests', async (req) => {
        await this._setDefaultValues(req);
    });

    this.before('SAVE', 'PaymentRequests', async (req) => {
        this._calculateTotalAndValidate(req);
    });

    // ==========================================
    // 2. PUBLIC ACTIONS / EVENTS
    // ==========================================
    this.on('submitForApproval', 'PaymentRequests', async (req) => {
        return await this._processSubmission(req);
    });

    this.on('approve', 'PaymentRequests', async (req) => {
        return await this._processApproval(req);
    });

    // ==========================================
    // 3. PRIVATE HELPER FUNCTIONS (Prefixed with _)
    // ==========================================

    /**
     * Gán giá trị mặc định và sinh mã yêu cầu thanh toán
     * @private
     * @param {Object} req - Request object từ CAP
     */
    this._setDefaultValues = async function (req) {
        if (!req.data.requestNo) {
            req.data.requestNo = await this._generateNextRequestNo();
        }
        req.data.status = req.data.status || STATUS.DRAFT;
        req.data.criticality = this._mapStatusToCriticality(req.data.status);
    };

    /**
     * Tính tổng tiền và kiểm tra tính hợp lệ của đơn
     * @private
     * @param {Object} req
     */
    this._calculateTotalAndValidate = function (req) {
        const header = req.data;
        if (header.items && header.items.length > 0) {
            header.totalAmount = header.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        }
    };

    /**
     * Ánh xạ trạng thái sang mã màu hiển thị Fiori
     * @private
     * @param {string} status - Trạng thái đơn
     * @returns {number} Mã criticality (0: Xám, 1: Đỏ, 2: Vàng, 3: Xanh)
     */
    this._mapStatusToCriticality = function (status) {
        switch (status) {
            case STATUS.POSTED:
            case STATUS.APPROVED:
                return CRITICALITY.POSITIVE;
            case STATUS.IN_APPROVAL:
            case STATUS.SUBMITTED:
                return CRITICALITY.CRITICAL;
            case STATUS.REJECTED:
            case STATUS.FAILED:
                return CRITICALITY.NEGATIVE;
            default:
                return CRITICALITY.NEUTRAL;
        }
    };
});
```

---

## 4. 📝 NGUYÊN TẮC COMMENT CODE (Comment Standards)

* **Bắt buộc 100% các hàm/method phải có comment chuẩn JSDoc:**
  * Mô tả chức năng hàm.
  * Danh sách tham số `@param` (kèm kiểu dữ liệu).
  * Giá trị trả về `@returns` (kèm kiểu dữ liệu).
  * Các ngoại lệ có thể ném ra `@throws` (nếu có).
* **Inline comment cho logic phức tạp:**
  * Giải thích lý do ("Tại sao lại làm như vậy?") thay vì chỉ mô tả lại code làm gì.
  * Đánh dấu các logic đặc thù tích hợp S/4HANA, CPI, BPA Workflow.
* **Comment trong file CDS / Database:**
  * Sử dụng `@title` và docstring `/** ... */` cho từng Entity và Field.

---

## 5. ✅ BẢNG KIỂM TRA TRƯỚC KHI COMMIT (Checklist)

- [ ] Đã chuyển tất cả chuỗi văn bản hiển thị vào file `i18n`.
- [ ] Không còn Magic Strings/Numbers trong code; đã import từ `constants/`.
- [ ] Các hàm nội bộ/helper đã được đặt tiền tố `_` và nằm ở cuối file/class.
- [ ] Tất cả hàm đã có đầy đủ comment JSDoc mô tả `@param` và `@returns`.
- [ ] Code biên dịch và chạy thử thành công với `npx cds compile` hoặc `npm test`.
