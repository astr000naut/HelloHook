const express = require('express');
const path = require('path');
const fs = require('fs').promises; // Sử dụng fs.promises để làm việc với file bất đồng bộ

const app = express();
const PORT = 3000; // Bạn có thể thay đổi cổng này nếu muốn
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

// Để phân tích cú pháp JSON từ webhook
app.use(express.json());
// Phục vụ các tệp tĩnh từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

// API Webhook
app.post('/webhook', async (req, res) => {
    const webhookData = req.body;
    console.log('Webhook nhận được:', webhookData);

    try {
        // Đọc nội dung hiện có của file log
        const currentLogs = JSON.parse(await fs.readFile(WEBHOOK_LOG_FILE, 'utf8'));

        // Thêm dữ liệu webhook mới vào đầu mảng (mới nhất lên trên)
        const newEntry = {
            timestamp: new Date().toISOString(),
            data: webhookData
        };
        currentLogs.unshift(newEntry); // Thêm vào đầu

        // Giới hạn số lượng bản ghi để tránh file quá lớn (ví dụ: 50 bản ghi gần nhất)
        const limitedLogs = currentLogs.slice(0, 50);

        // Ghi lại mảng đã cập nhật vào file
        await fs.writeFile(WEBHOOK_LOG_FILE, JSON.stringify(limitedLogs, null, 2), 'utf8');
        console.log('Đã lưu dữ liệu webhook vào file.');

        res.status(200).send('Webhook nhận và lưu thành công!');
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

app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
    console.log(`Truy cập giao diện: http://localhost:${PORT}`);
    console.log(`Điểm cuối webhook: http://localhost:${PORT}/webhook`);
    console.log(`API lấy dữ liệu: http://localhost:${PORT}/api/webhooks`);
});