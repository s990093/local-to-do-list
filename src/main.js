// 在開發環境中啟用熱重載
// if (process.env.NODE_ENV !== 'production') {
//     require('electron-reload')(__dirname, {
//         electron: require.resolve('electron')
//     });
// }

const { app, BrowserWindow, Notification } = require('electron');
const express = require('express');
const path = require('path');
const taskRoutes = require('./routes/taskRoutes');
const db = require('./database');

// 初始化 Express
const backendApp = express();

// Express 中間件
backendApp.use(express.json());
backendApp.use(express.static(path.join(__dirname, '../public')));
backendApp.use('/api', taskRoutes);

// 發送通知函數
const sendNotification = (title, body) => {
    if (Notification.isSupported()) {
        new Notification({
            title: title,
            body: body
        }).show();
    }
};

// 檢查未完成的 daily tasks 並發送通知
const checkUncompletedDailyTasks = async () => {
    try {
        const tasks = await db.getTasks();
        const uncompletedDailyTasks = tasks.filter(
            task => task.type === 'daily' && !task.completed
        );

        if (uncompletedDailyTasks.length > 0) {
            const tasksList = uncompletedDailyTasks
                .map(task => `• ${task.text}`)
                .join('\n');

            sendNotification(
                '未完成的每日任務',
                `您還有以下每日任務未完成：\n${tasksList}`
            );
        }
    } catch (error) {
        console.error('Error checking uncompleted tasks:', error);
    }
};

// 設定每日下午4點檢查任務並重置
const scheduleTasksCheck = () => {
    const now = new Date();
    const next = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        24, // 設定為下午 4 點 (24小時制)
        0, 0
    );

    // 如果現在時間已經過了今天的下午4點，就設定為明天的下午4點
    if (now.getTime() > next.getTime()) {
        next.setDate(next.getDate() + 1);
    }

    const msToNext = next.getTime() - now.getTime();

    setTimeout(async () => {
        // 先檢查未完成的任務並發送通知
        await checkUncompletedDailyTasks();
        // 然後重置所有 daily tasks
        await db.resetDailyTasks();
        // 設定下一次檢查
        scheduleTasksCheck();
    }, msToNext);
};

// 啟動排程
scheduleTasksCheck();

// 啟動伺服器
const server = backendApp.listen(3000, () => {
    console.log('Backend server running on http://localhost:3000');
});

// Electron 視窗設定
let mainWindow;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        backgroundColor: '#ffffff',
        show: false
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.loadURL('http://localhost:3000');
});

// 清理資源
app.on('window-all-closed', async () => {
    await db.closeDatabase();
    server.close();
    if (process.platform !== 'darwin') {
        app.quit();
    }
}); 