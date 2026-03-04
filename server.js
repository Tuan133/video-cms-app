// server.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Khởi tạo Firebase
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const videosCollection = db.collection('videos');

// Cấu hình Multer (Lưu ảnh local)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './public/uploads';
    if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
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
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// API 2: Thêm video mới
app.post('/api/videos', upload.single('thumbnail'), async (req, res) => {
  try {
    const { title, platform, script } = req.body;
    let thumbnailUrl = req.file ? `/uploads/${req.file.filename}` : '';
    
    const newVideo = {
      title, platform, script: script || '', thumbnailUrl,
      status: 'Ý tưởng',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await videosCollection.add(newVideo);
    res.status(201).json({ id: docRef.id, ...newVideo });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// API 3: Cập nhật trạng thái (Kéo thả)
app.put('/api/videos/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await videosCollection.doc(req.params.id).update({ status });
    res.status(200).json({ message: 'Đã cập nhật trạng thái' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ================= TÍNH NĂNG MỚI =================

// API 4: Xóa video
app.delete('/api/videos/:id', async (req, res) => {
  try {
    await videosCollection.doc(req.params.id).delete();
    res.status(200).json({ message: 'Xóa thành công' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// API 5: Sửa nội dung video (Tiêu đề, kịch bản, ảnh)
app.put('/api/videos/:id/details', upload.single('thumbnail'), async (req, res) => {
    try {
      const { title, platform, script } = req.body;
      const updateData = { title, platform, script: script || '' };
      
      // Nếu có tải ảnh mới lên thì cập nhật ảnh, không thì giữ nguyên ảnh cũ
      if (req.file) {
        updateData.thumbnailUrl = `/uploads/${req.file.filename}`;
      }
      
      await videosCollection.doc(req.params.id).update(updateData);
      res.status(200).json({ message: 'Cập nhật thành công' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));