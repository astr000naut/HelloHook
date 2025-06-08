const express = require('express');
const path = require('path');
const fs = require('fs').promises; // Sử dụng fs.promises để làm việc với file bất đồng bộ

const app = express();
const PORT = 3000; // Đặt cổng là 3000 để khớp với cấu hình Synology Chat của bạn
const WEBHOOK_LOG_FILE = path.join(__dirname, 'webhook_log.json'); // Tên file để lưu trữ dữ liệu webhook

// Khởi tạo file log nếu nó chưa tồn tại
async function initializeLogFile() {
    try {
        await fs.access(WEBHOOK_LOG_FILE); // Kiểm tra xem file có tồn tại không
    } catch (error) {
        // Nếu file không tồn tại, tạo nó với một mảng rỗng
        await fs.writeFile(WEBHOOK_LOG_FILE, '[]', 'utf8');
        console.log(`Đã tạo file log webhook: ${WEBHOOK_LOG_FILE}`);
    }
}

// Gọi hàm khởi tạo khi ứng dụng bắt đầu
initializeLogFile();

// Middleware để phân tích cú pháp application/json (nếu có các webhook khác gửi JSON)
app.use(express.json());
// Middleware quan trọng: để phân tích cú pháp application/x-www-form-urlencoded
// Synology Chat Outgoing Webhook gửi dữ liệu theo định dạng này
app.use(express.urlencoded({ extended: true })); // `extended: true` cho phép parsing đối tượng lồng ghép

// Phục vụ các tệp tĩnh từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

// API Webhook
app.post('/webhook', async (req, res) => {
    // Với express.urlencoded(), dữ liệu từ form-urlencoded sẽ nằm trong req.body
    // Nếu có cả JSON và form-urlencoded, req.body sẽ chứa dữ liệu từ loại nào được gửi.
    // Đối với Synology Chat, nó sẽ là form-urlencoded.
    const webhookData = req.body;
    console.log('Webhook nhận được:', webhookData);

    // Bạn có thể truy cập các trường cụ thể như sau:
    // const token = webhookData.token;
    // const text = webhookData.text;
    // const channel_id = webhookData.channel_id;
    // console.log(`Nội dung tin nhắn: ${text}`);

    try {
        // Đọc nội dung hiện có của file log
        const currentLogs = JSON.parse(await fs.readFile(WEBHOOK_LOG_FILE, 'utf8'));

        // Thêm dữ liệu webhook mới vào đầu mảng (mới nhất lên trên)
        const newEntry = {
            timestamp: new Date().toISOString(),
            data: webhookData,
            headers: req.headers // Ghi lại cả headers để debug nếu cần
        };
        currentLogs.unshift(newEntry); // Thêm vào đầu

        // Giới hạn số lượng bản ghi để tránh file quá lớn (ví dụ: 50 bản ghi gần nhất)
        const limitedLogs = currentLogs.slice(0, 50);

        // Ghi lại mảng đã cập nhật vào file
        await fs.writeFile(WEBHOOK_LOG_FILE, JSON.stringify(limitedLogs, null, 2), 'utf8');
        console.log('Đã lưu dữ liệu webhook vào file.');

        // Theo tài liệu Synology Chat, bạn có thể phản hồi lại bằng JSON nếu muốn
        // Ví dụ: gửi lại tin nhắn đã nhận
        res.status(200).json({ text: `Webhook đã nhận tin nhắn của bạn: ${webhookData.text || 'không có nội dung'}` });
        // Hoặc chỉ gửi một thông báo thành công đơn giản nếu không muốn bot phản hồi lại Chat
        // res.status(200).send('Webhook nhận và lưu thành công!');

    } catch (error) {
        console.error('Lỗi khi xử lý hoặc lưu webhook:', error);
        res.status(500).send('Lỗi máy chủ khi xử lý webhook.');
    }
});

// API để lấy nội dung webhook đã lưu
app.get('/api/webhooks', async (req, res) => {
    try {
        const logs = await fs.readFile(WEBHOOK_LOG_FILE, 'utf8');
        res.json(JSON.parse(logs));
    } catch (error) {
        console.error('Lỗi khi đọc file log webhook:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu webhook.' });
    }
});

// API mới: Xóa toàn bộ nội dung của file log
app.get('/clear', async (req, res) => {
    try {
        await fs.writeFile(WEBHOOK_LOG_FILE, '[]', 'utf8');
        console.log('Đã xóa toàn bộ nội dung file log webhook.');
        res.status(200).send('Đã xóa log webhook thành công!');
    } catch (error) {
        console.error('Lỗi khi xóa file log webhook:', error);
        res.status(500).send('Lỗi máy chủ khi xóa log webhook.');
    }
});

app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
    console.log(`Truy cập giao diện: http://localhost:${PORT}`);
    console.log(`Điểm cuối webhook: http://localhost:${PORT}/webhook`);
    console.log(`API lấy dữ liệu: http://localhost:${PORT}/api/webhooks`);
    console.log(`API xóa log: http://localhost:${PORT}/clear`);
});