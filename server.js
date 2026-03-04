// server.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Thêm thư viện fs để tạo thư mục

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Cho phép web đọc các file trong thư mục public

// Khởi tạo Firebase (Chỉ dùng Firestore, bỏ Cloud Storage)
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const videosCollection = db.collection('videos');

// CẤU HÌNH MULTER: Lưu file thẳng vào máy tính (thư mục public/uploads)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './public/uploads';
    // Nếu chưa có thư mục uploads thì tự động tạo
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Đổi tên file để không bị trùng (Thêm timestamp vào trước tên gốc)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// API 1: Lấy danh sách video
app.get('/api/videos', async (req, res) => {
  try {
    const snapshot = await videosCollection.orderBy('createdAt', 'desc').get();
    const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(videos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API 2: Thêm video mới (có kèm ảnh Thumbnail lưu ở Local)
app.post('/api/videos', upload.single('thumbnail'), async (req, res) => {
  try {
    const { title, platform, script } = req.body;
    let thumbnailUrl = '';

    // Nếu có upload file, tạo đường dẫn cục bộ để lưu vào Database
    if (req.file) {
      thumbnailUrl = `/uploads/${req.file.filename}`;
    }

    const newVideo = {
      title,
      platform,
      script: script || '',
      thumbnailUrl,
      status: 'Ý tưởng', // Mặc định vào cột Ý tưởng
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await videosCollection.add(newVideo);
    res.status(201).json({ id: docRef.id, ...newVideo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API 3: Cập nhật trạng thái (Dùng khi kéo thả Kanban)
app.put('/api/videos/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await videosCollection.doc(id).update({ status });
    res.status(200).json({ message: 'Đã cập nhật trạng thái' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server xịn xò đang chạy tại http://localhost:${PORT}`));