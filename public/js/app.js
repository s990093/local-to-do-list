class TodoApp {
    constructor() {
        this.taskInput = document.getElementById('task-input');
        this.taskType = document.getElementById('task-type');
        this.regularTaskList = document.getElementById('regular-task-list');
        this.dailyTaskList = document.getElementById('daily-task-list');
        this.addTaskBtn = document.getElementById('add-task-btn');
        this.chartType = document.getElementById('chart-type');
        this.chart = null;

        this.selectedDate = new Date(); // 預設為今天

        this.initializeEventListeners();
        this.loadTasks();
        this.calendar = new Calendar(this);
        this.initializeChart();
    }

    initializeEventListeners() {
        this.addTaskBtn.addEventListener('click', () => this.addTask());
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        this.chartType.addEventListener('change', () => this.updateChart());
    }

    async loadTasks() {
        try {
            const date = this.selectedDate.toISOString().split('T')[0];
            const response = await fetch(`/api/tasks/date/${date}`);
            const tasks = await response.json();

            this.regularTaskList.innerHTML = '';
            this.dailyTaskList.innerHTML = '';

            tasks.forEach(task => {
                const targetList = task.type === 'daily' ? this.dailyTaskList : this.regularTaskList;
                this.createTaskElement(task, targetList);
            });
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    async addTask(text = null, type = 'regular', scheduledDate = null) {
        // 如果沒有提供文字，使用輸入框的值
        const taskText = text || this.taskInput.value.trim();
        if (!taskText) return;

        // 如果沒有提供日期，使用選中的日期
        const date = scheduledDate || this.selectedDate.toISOString().split('T')[0];

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: taskText,
                    type: type || this.taskType.value,
                    scheduledDate: date
                }),
            });

            if (response.ok) {
                const task = await response.json();
                this.loadTasks();
                this.calendar.loadTasksForMonth(); // 重新載入月曆上的任務
                this.taskInput.value = ''; // 清空輸入框
            }
        } catch (error) {
            console.error('Error adding task:', error);
        }
    }

    createTaskElement(task, targetList) {
        const li = document.createElement('li');
        li.className = 'bg-gray-800 text-white p-4 rounded-lg shadow-lg flex justify-between items-center fade-in task-item';
        li.dataset.id = task.id;

        const leftSection = document.createElement('div');
        leftSection.className = 'flex items-center gap-3';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.className = 'form-checkbox h-5 w-5 text-purple-600';
        checkbox.addEventListener('change', () => this.toggleTaskComplete(task.id, checkbox.checked));

        const taskText = document.createElement('span');
        taskText.textContent = task.text;
        taskText.className = task.completed ? 'text-lg completed' : 'text-lg';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-red-500 hover:text-red-700 transition duration-300';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => this.deleteTask(task.id, li));

        leftSection.appendChild(checkbox);
        leftSection.appendChild(taskText);
        li.appendChild(leftSection);
        li.appendChild(deleteBtn);
        targetList.appendChild(li);
    }

    async toggleTaskComplete(taskId, completed) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ completed }),
            });

            if (!response.ok) {
                throw new Error('Failed to update task');
            }
        } catch (error) {
            console.error('Error updating task:', error);
        }
    }

    async deleteTask(taskId, element) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                element.classList.add('removing');
                setTimeout(() => element.remove(), 500);
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }

    showAddTaskModal(date) {
        const text = prompt('Enter task for ' + date.toLocaleDateString());
        if (text) {
            this.addTask(text, 'regular', date.toISOString().split('T')[0]);
        }
    }

    updateSelectedDate(date) {
        this.selectedDate = date;
        this.taskInput.placeholder = `Add a task for ${date.toLocaleDateString()}...`;
        this.loadTasks(); // 重新載入選中日期的任務
    }

    async initializeChart() {
        const ctx = document.getElementById('taskChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Completed Tasks',
                        backgroundColor: 'rgba(167, 139, 250, 0.5)',
                        borderColor: 'rgb(167, 139, 250)',
                        borderWidth: 1,
                        data: []
                    },
                    {
                        label: 'Total Tasks',
                        backgroundColor: 'rgba(236, 72, 153, 0.5)',
                        borderColor: 'rgb(236, 72, 153)',
                        borderWidth: 1,
                        data: []
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        });
        this.updateChart();
    }

    async updateChart() {
        const type = this.chartType.value;
        try {
            const response = await fetch(`/api/tasks/statistics/${type}`);
            const stats = await response.json();

            this.chart.data.labels = stats.labels;
            this.chart.data.datasets[0].data = stats.completedTasks;
            this.chart.data.datasets[1].data = stats.totalTasks;
            this.chart.update();
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }
}

class Calendar {
    constructor(todoApp) {
        this.todoApp = todoApp;
        this.currentDate = new Date();
        this.selectedDate = null;
        this.monthTasks = [];

        this.calendarHeader = document.getElementById('calendar-header');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.prevMonthBtn = document.getElementById('prev-month');
        this.nextMonthBtn = document.getElementById('next-month');

        this.initializeEventListeners();
        this.render();
        this.loadTasksForMonth();
    }

    initializeEventListeners() {
        this.prevMonthBtn.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.render();
            this.loadTasksForMonth();
        });

        this.nextMonthBtn.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.render();
            this.loadTasksForMonth();
        });
    }

    render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        this.calendarHeader.textContent = new Date(year, month).toLocaleString('default', {
            month: 'long',
            year: 'numeric'
        });

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        this.calendarGrid.innerHTML = '';

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            this.addDayCell('');
        }

        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            this.addDayCell(day);
        }
    }

    async loadTasksForMonth() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        try {
            const response = await fetch(`/api/tasks/date/${firstDay.toISOString().split('T')[0]}/${lastDay.toISOString().split('T')[0]}`);
            const tasks = await response.json();
            this.monthTasks = tasks;
            this.render();
        } catch (error) {
            console.error('Error loading month tasks:', error);
        }
    }

    addDayCell(day) {
        const cell = document.createElement('div');

        if (day) {
            const currentDate = new Date(
                this.currentDate.getFullYear(),
                this.currentDate.getMonth(),
                day
            );

            // 檢查是否為過去的日期
            const isPastDate = currentDate < new Date().setHours(0, 0, 0, 0);
            const isSelected = this.selectedDate &&
                currentDate.toDateString() === this.selectedDate.toDateString();
            const isToday = currentDate.toDateString() === new Date().toDateString();

            cell.className = `
                h-24 border border-gray-700/50 rounded-lg p-2 overflow-auto
                ${isSelected ? 'bg-purple-900/50' : 'bg-gray-800/30'} 
                ${isToday ? 'border-purple-500/50' : ''}
                ${isPastDate ? 'opacity-50' : 'hover:bg-purple-800/30 cursor-pointer'}
                transition-all duration-300
            `;

            // 修改：只獲取 regular 類型的任務
            const dayTasks = this.monthTasks.filter(task => {
                const taskDate = new Date(task.scheduled_date);
                return taskDate.getDate() === day &&
                    taskDate.getMonth() === this.currentDate.getMonth() &&
                    taskDate.getFullYear() === this.currentDate.getFullYear() &&
                    task.type === 'regular'; // 只顯示 regular 任務
            });

            cell.innerHTML = `
                <div class="flex justify-between">
                    <span class="text-sm ${isSelected ? 'text-purple-300' : ''}">${day}</span>
                    ${!isPastDate ? `<button class="add-task-btn text-xs text-purple-400 hover:text-purple-300">+</button>` : ''}
                </div>
                <div class="tasks-container text-xs mt-1 space-y-1">
                    ${dayTasks.map(task => `
                        <div class="task-item truncate ${task.completed ? 'line-through opacity-50' : ''} text-purple-300">
                            • ${task.text}
                        </div>
                    `).join('')}
                </div>
            `;

            cell.addEventListener('click', (e) => {
                if (!isPastDate && !e.target.classList.contains('add-task-btn')) {
                    this.selectDate(currentDate);
                }
            });

            const addBtn = cell.querySelector('.add-task-btn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!isPastDate) {
                        this.selectDate(currentDate);
                        this.todoApp.showAddTaskModal(currentDate);
                    }
                });
            }
        } else {
            cell.className = 'h-24 border border-gray-700/50 rounded-lg p-2 bg-gray-800/10';
        }

        this.calendarGrid.appendChild(cell);
    }

    selectDate(date) {
        // 檢查是否為過去的日期
        const isPastDate = date < new Date().setHours(0, 0, 0, 0);
        if (!isPastDate) {
            this.selectedDate = date;
            this.todoApp.updateSelectedDate(date);
            this.render();
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new TodoApp();
}); 