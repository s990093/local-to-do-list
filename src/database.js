const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const isDev = process.env.NODE_ENV !== 'production';

// 設定資料庫路徑
const dbPath = isDev
    ? path.join(__dirname, '../tasks.db')  // 開發環境：專案根目錄
    : path.join(process.resourcesPath, 'tasks.db'); // 生產環境

// 確保資料庫目錄存在`
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// 初始化資料庫表
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        type TEXT DEFAULT 'regular',
        completed BOOLEAN DEFAULT 0,
        scheduled_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

const logOperation = (operation, details) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
        `${chalk.gray(`[${timestamp}]`)} ${chalk.blue('DB')} ${chalk.green(operation)} ${chalk.yellow(details)}`
    );
};

const dbOperations = {
    addTask: (task, type = 'regular', scheduledDate = null) => {
        return new Promise((resolve, reject) => {
            logOperation('ADD_TASK', `type: ${type}, text: ${task}, date: ${scheduledDate}`);
            const stmt = db.prepare('INSERT INTO tasks (text, type, scheduled_date) VALUES (?, ?, ?)');
            stmt.run([task, type, scheduledDate], function (err) {
                stmt.finalize();
                if (err) reject(err);
                resolve({
                    id: this.lastID,
                    text: task,
                    type,
                    scheduled_date: scheduledDate,
                    completed: false
                });
            });
        });
    },

    getTasks: () => {
        return new Promise((resolve, reject) => {
            logOperation('GET_TASKS', 'fetching all tasks');
            db.all('SELECT * FROM tasks ORDER BY created_at DESC', [], (err, rows) => {
                if (err) {
                    console.error(chalk.red('Error fetching tasks:'), err);
                    reject(err);
                }
                logOperation('GET_TASKS', `fetched ${rows?.length || 0} tasks`);
                resolve(rows);
            });
        });
    },

    deleteTask: (id) => {
        return new Promise((resolve, reject) => {
            logOperation('DELETE_TASK', `id: ${id}`);
            db.run('DELETE FROM tasks WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    },

    updateTask: (id, completed) => {
        return new Promise((resolve, reject) => {
            logOperation('UPDATE_TASK', `id: ${id}, completed: ${completed}`);
            db.get('SELECT type, text FROM tasks WHERE id = ?', [id], (err, task) => {
                if (err) {
                    reject(err);
                    return;
                }

                db.run('UPDATE tasks SET completed = ? WHERE id = ?', [completed, id], async (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // 如果是完成 daily 任務，則自動添加明天的任務
                    if (completed && task.type === 'daily') {
                        try {
                            logOperation('ADD_NEXT_DAY_TASK', `for task: ${task.text}`);
                            // 添加新的 daily 任務，設定為未完成狀態
                            await dbOperations.addTask(task.text, 'daily');
                        } catch (error) {
                            console.error(chalk.red('Error adding next day task:'), error);
                        }
                    }
                    resolve();
                });
            });
        });
    },

    resetDailyTasks: () => {
        return new Promise((resolve, reject) => {
            logOperation('RESET_DAILY_TASKS', 'resetting all daily tasks');
            db.run('UPDATE tasks SET completed = 0 WHERE type = "daily"', [], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    },

    closeDatabase: () => {
        return new Promise((resolve, reject) => {
            logOperation('CLOSE_DATABASE', 'closing database connection');
            db.close((err) => {
                if (err) reject(err);
                resolve();
            });
        });
    },

    getTasksByDate: (date) => {
        return new Promise((resolve, reject) => {
            logOperation('GET_TASKS_BY_DATE', `date: ${date}`);
            db.all('SELECT * FROM tasks WHERE date(scheduled_date) = date(?) ORDER BY created_at DESC', [date], (err, rows) => {
                if (err) {
                    console.error(chalk.red('Error fetching tasks:'), err);
                    reject(err);
                }
                resolve(rows);
            });
        });
    },

    getTasksByDateRange: (startDate, endDate) => {
        return new Promise((resolve, reject) => {
            logOperation('GET_TASKS_BY_DATE_RANGE', `start: ${startDate}, end: ${endDate}`);
            db.all(
                'SELECT * FROM tasks WHERE date(scheduled_date) BETWEEN date(?) AND date(?) ORDER BY created_at DESC',
                [startDate, endDate],
                (err, rows) => {
                    if (err) {
                        console.error(chalk.red('Error fetching tasks:'), err);
                        reject(err);
                    }
                    resolve(rows);
                }
            );
        });
    },

    getTaskStatistics: (type) => {
        return new Promise((resolve, reject) => {
            let query, labels, interval;
            const now = new Date();

            switch (type) {
                case 'weekly':
                    interval = "'-6 days'";
                    query = `
                        SELECT date(scheduled_date) as date,
                               COUNT(*) as total,
                               SUM(completed) as completed
                        FROM tasks
                        WHERE scheduled_date >= date('now', ${interval})
                        GROUP BY date(scheduled_date)
                        ORDER BY date(scheduled_date)
                    `;
                    labels = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return d.toLocaleDateString();
                    });
                    break;

                case 'monthly':
                    interval = "'-29 days'";
                    query = `
                        SELECT strftime('%Y-%m-%d', scheduled_date) as date,
                               COUNT(*) as total,
                               SUM(completed) as completed
                        FROM tasks
                        WHERE scheduled_date >= date('now', ${interval})
                        GROUP BY date
                        ORDER BY date
                    `;
                    labels = Array.from({ length: 30 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (29 - i));
                        return d.toLocaleDateString();
                    });
                    break;

                case 'yearly':
                    query = `
                        SELECT strftime('%Y-%m', scheduled_date) as month,
                               COUNT(*) as total,
                               SUM(completed) as completed
                        FROM tasks
                        WHERE scheduled_date >= date('now', '-11 months')
                        GROUP BY month
                        ORDER BY month
                    `;
                    labels = Array.from({ length: 12 }, (_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - (11 - i));
                        return d.toLocaleDateString('default', { month: 'short' });
                    });
                    break;
            }

            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const totalTasks = new Array(labels.length).fill(0);
                const completedTasks = new Array(labels.length).fill(0);

                rows.forEach(row => {
                    const index = labels.findIndex(label => {
                        if (type === 'yearly') {
                            return label === new Date(row.month + '-01').toLocaleDateString('default', { month: 'short' });
                        }
                        return label === new Date(row.date).toLocaleDateString();
                    });
                    if (index !== -1) {
                        totalTasks[index] = row.total;
                        completedTasks[index] = row.completed;
                    }
                });

                resolve({
                    labels,
                    totalTasks,
                    completedTasks
                });
            });
        });
    }
};

module.exports = dbOperations; 