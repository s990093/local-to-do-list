const express = require('express');
const router = express.Router();
const db = require('../database');

// 獲取所有任務
router.get('/tasks', async (req, res) => {
    try {
        const tasks = await db.getTasks();
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 獲取特定日期的任務
router.get('/tasks/date/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const tasks = await db.getTasksByDate(date);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 獲取日期範圍內的任務
router.get('/tasks/date/:startDate/:endDate', async (req, res) => {
    try {
        const { startDate, endDate } = req.params;
        const tasks = await db.getTasksByDateRange(startDate, endDate);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 添加新任務
router.post('/tasks', async (req, res) => {
    try {
        const { text, type, scheduledDate } = req.body;
        const task = await db.addTask(text, type, scheduledDate);
        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 更新任務狀態
router.patch('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { completed } = req.body;
        await db.updateTask(id, completed);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 刪除任務
router.delete('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.deleteTask(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 添加統計數據路由
router.get('/tasks/statistics/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const stats = await db.getTaskStatistics(type);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router; 