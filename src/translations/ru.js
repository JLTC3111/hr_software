export default {
  // Navigation
  nav: {
    timeClock: 'Табель учёта рабочего времени',
    dashboard: 'Панель управления',
    employees: 'Сотрудники',
    recruitment: 'Найм персонала',
    timeTracking: 'Отслеживание времени',
    performance: 'Оценка эффективности',
    reports: 'Отчёты'
  },

  // Header
  header: {
    title: 'HR Менеджер',
    welcome: 'Добро пожаловать, HR команда',
    user: 'HR команда'
  },

  // Dashboard
  dashboard: {
    title: 'Обзор Панели Управления',
    totalEmployees: 'Всего Сотрудников',
    activeEmployees: 'Активные Сотрудники',
    newHires: 'Новые Сотрудники в Этом Месяце',
    pendingApplications: 'Заявки в Ожидании',
    avgPerformance: 'Средняя Эффективность',
    totalOvertime: 'Общее Количество Сверхурочных',
    totalLeave: 'Всего Отпускных Дней',
    employeePerformance: 'Производительность Сотрудников',
    departmentDist: 'Распределение по Отделам',
    workLeaveComp: 'Сравнение Рабочих и Выходных Дней',
    topPerformers: 'Лучшие Сотрудники',
    overtime: 'Сверхурочная Работа',
    totalWorkDays: 'Общее Количество Рабочих Дней',
    acrossEmployees: 'Среди Всех Сотрудников за Месяц',
    activeApplications: 'Активные Заявки',
    pendingReview: 'Ожидает Проверки',
    pendingRequests: 'Ожидающие Запросы',
    leaveRequests: 'Заявки на Отпуск в Ожидании',
    recentActivity: 'Недавняя Активность',
    quickStats: 'Быстрая Статистика',
    viewAll: 'Посмотреть Все',
    activities: {
      newEmployee: 'Новый сотрудник принят: ABC',
      interviewScheduled: 'Назначено интервью с: XYZ',
      performanceReview: 'Оценка эффективности завершена для: Đỗ Bảo Long'
    },
    timeAgo: {
      twoHours: '2 часа назад',
      fourHours: '4 часа назад',
      oneDay: '1 день назад'
    }
  },

  // Search
  search: {
    placeholder: 'Поиск сотрудников...'
  },

  // Departments
  departments: {
    all: 'Все',
    engineering: 'Инженерия',
    sales: 'Продажи',
    marketing: 'Маркетинг',
    humanresources: 'Кадры',
    design: 'Дизайн',
    finance: 'Финансы'
  },

  // Months
  months: {
    january: 'Январь',
    february: 'Февраль',
    march: 'Март',
    april: 'Апрель',
    may: 'Май',
    june: 'Июнь',
    july: 'Июль',
    august: 'Август',
    september: 'Сентябрь',
    october: 'Октябрь',
    november: 'Ноябрь',
    december: 'Декабрь'
  },

  // Recruitment
  recruitment: {
    title: 'Конвейер найма',
    postNewJob: 'Разместить новую вакансию',
    applications: 'Заявки',
    candidate: 'Кандидат',
    position: 'Должность',
    department: 'Отдел',
    appliedDate: 'Дата подачи заявки',
    experience: 'Опыт',
    status: 'Статус',
    actions: 'Действия',
    stage: 'Этап',
    interviewScheduled: 'Собеседование запланировано',
    underReview: 'На рассмотрении',
    offerExtended: 'Предложение сделано',
    screening: 'Отбор',
    technical: 'Техническое',
    offer: 'Предложение',
    years: 'лет'
  },

  timeClock: {
    title: 'Учёт рабочего времени',
    subtitle: 'Записывайте рабочие часы и отправляйте подтверждения',
    newEntry: 'Новая запись времени',
    date: 'Дата',
    clockIn: 'Время начала',
    clockOut: 'Время окончания',
    hourType: 'Тип часов',
    proof: 'Подтверждение присутствия',
    notes: 'Заметки',
    optional: 'Необязательно',
    submit: 'Отправить запись времени',
    submitting: 'Отправка...',
    success: 'Запись времени успешно отправлена!',
    confirmDelete: 'Вы уверены, что хотите удалить эту запись?',
    delete: 'Удалить',
    history: 'История учёта времени',
    noEntries: 'Нет записей. Добавьте первую!',
    time: 'Время',
    hours: 'Часы',
    type: 'Тип',
    status: 'Статус',
    actions: 'Действия',
    weeklySummary: 'На этой неделе',
    monthlySummary: 'В этом месяце',
    total: 'Итого',
    notesPlaceholder: 'Добавьте заметки или дополнительную информацию...',
    fileHelp: 'Загрузите скриншот, фото или PDF (до 5 МБ)',
    hourTypes: {
      regular: 'Обычные часы',
      holiday: 'Праздничные дни',
      weekend: 'Выходные',
      bonus: 'Дополнительные часы'
    },
    errors: {
      dateRequired: 'Пожалуйста, выберите дату',
      clockInRequired: 'Введите время начала',
      clockOutRequired: 'Введите время окончания',
      clockOutAfterClockIn: 'Время окончания должно быть позже начала',
      tooManyHours: 'Нельзя указать более 24 часов в одной записи',
      overlapping: 'Этот период пересекается с другой записью за тот же день',
      fileTooLarge: 'Размер файла должен быть меньше 5 МБ',
      invalidFileType: 'Разрешены только файлы JPG, PNG и PDF'
    }
  },  

  // Time Tracking
  timeTracking: {
    title: 'Панель отслеживания времени',
    summary: 'Сводка',
    quickActions: 'Быстрые действия',
    workDays: 'Рабочие дни',
    leaveDays: 'Дни отпуска',
    overtime: 'Сверхурочные часы',
    holidayOvertime: 'Праздничные сверхурочные',
    hours: 'часы',
    days: 'дни',
    thisMonth: 'В этом месяце',
    totalHours: 'Общее количество часов',
    regularHours: 'Обычные часы',
    overtimeHours: 'Сверхурочные часы',
    hrs: 'ч',
    attendanceRate: 'Посещаемость'
  },

  // Employees
  employees: {
    title: 'Управление сотрудниками',
    searchPlaceholder: 'Поиск сотрудников...',
    addEmployee: 'Добавить сотрудника',
    name: 'Имя',
    position: 'Должность',
    department: 'Отдел',
    email: 'Электронная почта',
    phone: 'Телефон',
    startDate: 'Дата начала',
    salary: 'Зарплата',
    status: 'Статус',
    location: 'Местоположение',
    performance: 'Производительность',
    actions: 'Действия',
    view: 'Просмотр',
    edit: 'Редактировать',
    delete: 'Удалить',
    active: 'Активный',
    inactive: 'Неактивный'
  },

  // Recruitment
  recruitment: {
    title: 'Воронка набора персонала',
    applications: 'Заявки',
    candidate: 'Кандидат',
    appliedDate: 'Дата подачи заявки',
    experience: 'Опыт',
    stage: 'Этап',
    interviewScheduled: 'Собеседование запланировано',
    underReview: 'На рассмотрении',
    offerExtended: 'Предложение сделано',
    screening: 'Отбор',
    technical: 'Техническое',
    offer: 'Предложение',
    years: 'лет'
  },

  // Performance Appraisal
  performance: {
    title: 'Оценка производительности',
    overallRating: 'Общая оценка',
    reviewPeriod: 'Период оценки',
    goals: 'Цели и задачи',
    achievements: 'Ключевые достижения',
    areasForImprovement: 'Области для улучшения',
    skillsAssessment: 'Оценка навыков',
    technical: 'Технические навыки',
    communication: 'Коммуникация',
    leadership: 'Лидерство',
    teamwork: 'Командная работа',
    problemSolving: 'Решение проблем',
    rating: 'Оценка',
    excellent: 'Отлично',
    good: 'Хорошо',
    average: 'Средне',
    needsImprovement: 'Требует улучшения',
    comments: 'Комментарии',
    save: 'Сохранить оценку',
    lastReview: 'Последняя оценка',
    nextReview: 'Следующая оценка',
    q1_2024: 'Q1 2024',
    q2_2024: 'Q2 2024',
    q3_2024: 'Q3 2024',
    q4_2024: 'Q4 2024',
    overallPerformance: 'Общая производительность',
    goalsCompleted: 'Выполненные цели',
    reviewsThisPeriod: 'Оценки за период',
    avgSkillRating: 'Средняя оценка навыков',
    completed: 'Завершено',
    inProgress: 'В процессе',
    pending: 'Ожидание',
    // Tabs
    overview: 'Обзор',
    goalsTab: 'Цели',
    reviewsTab: 'Оценки',
    // Goals section
    currentGoals: 'Текущие цели',
    addGoal: 'Добавить цель',
    addNewGoal: 'Добавить новую цель',
    performanceGoals: 'Цели производительности',
    progress: 'Прогресс',
    deadline: 'Крайний срок',
    due: 'Срок',
    complete: 'завершено',
    viewDetails: 'Посмотреть детали',
    // Reviews section
    performanceReviews: 'Оценки производительности',
    newReview: 'Новая оценка',
    by: 'от',
    viewFullReview: 'Посмотреть полную оценку',
    // General
    status: 'Статус',
    actions: 'Действия',
    edit: 'Редактировать',
    view: 'Просмотр'
  },

  // Reports
  reports: {
    title: 'Отчёты и аналитика',
    employeeGrowth: 'Рост количества сотрудников',
    departmentDistribution: 'Распределение по отделам',
    performanceMetrics: 'Метрики производительности',
    recruitmentMetrics: 'Метрики набора персонала',
    attendanceReport: 'Отчёт о посещаемости',
    salaryReport: 'Отчёт о зарплатах',
    generateReport: 'Создать отчёт',
    exportPDF: 'Экспорт в PDF',
    exportExcel: 'Экспорт в Excel',
    filterBy: 'Фильтр по',
    dateRange: 'Диапазон дат',
    department: 'Отдел',
    all: 'Все',
    // Navigation
    overview: 'Обзор',
    detailedReports: 'Подробные отчёты',
    filters: 'Фильтры',
    exportAll: 'Экспортировать всё',
    // Charts
    departmentOverview: 'Обзор отделов',
    attendanceOverview: 'Обзор посещаемости',
    recruitmentFunnel: 'Воронка набора',
    performanceTrend: 'Тренд производительности',
    // Stats
    totalEmployees: 'Всего сотрудников',
    newHires: 'Новые сотрудники',
    thisQuarter: 'Этот квартал',
    turnoverRate: 'Текучесть кадров',
    annualRate: 'Годовая ставка',
    avgSalary: 'Средняя зарплата',
    satisfaction: 'Удовлетворённость',
    productivity: 'Продуктивность',
    // Attendance
    present: 'Присутствует',
    onLeave: 'В отпуске',
    absent: 'Отсутствует',
    // Recruitment labels
    totalApplications: 'Всего заявок',
    interviewed: 'Проинтервьюированы',
    hired: 'Наняты',
    rejected: 'Отклонены',
    employees: 'сотрудники',
    // Report generation
    generateCustomReport: 'Создать пользовательский отчёт',
    reportType: 'Тип отчёта',
    employeePerformance: 'Производительность сотрудников',
    salaryAnalysis: 'Анализ зарплат',
    attendanceReport: 'Отчёт о посещаемости',
    recruitmentMetrics: 'Метрики набора персонала',
    departmentComparison: 'Сравнение отделов',
    exportToPDF: 'Экспорт в PDF',
    exportToExcel: 'Экспорт в Excel',
    prebuiltReports: 'Готовые отчёты',
    // Pre-built report names
    monthlyPerformanceReview: 'Ежемесячная оценка производительности',
    comprehensivePerformanceAnalysis: 'Комплексный анализ производительности',
    salaryBenchmarking: 'Бенчмаркинг зарплат',
    compareSalariesAcrossDepartments: 'Сравнение зарплат между отделами',
    attendanceAnalytics: 'Аналитика посещаемости',
    trackAttendancePatterns: 'Отслеживание паттернов и трендов посещаемости',
    recruitmentPipeline: 'Пайплайн набора персонала',
    monitorHiringProcess: 'Мониторинг эффективности процесса найма',
    employeeTurnover: 'Текучесть кадров',
    analyzeRetentionRates: 'Анализ удержания и текучести кадров',
    trainingEffectiveness: 'Эффективность обучения',
    measureTrainingSuccess: 'Измерение успеха программы обучения',
    generate: 'Создать →',
    fromLastPeriod: 'с прошлого периода',
    lastWeek:	'Прошлая неделя (Proshlaya nedelya)',	
    lastMonth:	'Прошлый месяц (Proshlyy mesyats)',
    lastQuarter:	'Прошлый квартал (Proshlyy kvartal)',
    lastYear:	'Прошлый год (Proshlyy god)',
    customRange:	'Пользовательский диапазон',	
  },

  // Common
  common: {
    search: 'Поиск',
    filter: 'Фильтр',
    sort: 'Сортировка',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    view: 'Просмотр',
    add: 'Добавить',
    close: 'Закрыть',
    loading: 'Загрузка...',
    noData: 'Нет данных',
    error: 'Произошла ошибка',
    success: 'Операция успешна',
    confirm: 'Вы уверены?',
    yes: 'Да',
    no: 'Нет'
  },

  // Theme
  theme: {
    light: 'Светлая тема',
    dark: 'Тёмная тема',
    toggle: 'Переключить тему'
  },

  // Language
  language: {
    select: 'Выбрать язык',
    current: 'Текущий язык'
  },

  // Time Tracking Actions
  timeTrackingActions: {
    recordTime: 'Записать время',
    requestLeave: 'Запросить отпуск',
    logOvertime: 'Записать сверхурочные',
    exportReport: 'Экспортировать отчёт'
  },

  // Recruitment Actions
  recruitmentActions: {
    view: 'Просмотр',
    schedule: 'Запланировать',
    reject: 'Отклонить'
  },

  // Employee Status
  employeeStatus: {
    active: 'Активный',
    inactive: 'Неактивный',
    onLeave: 'В отпуске',
    pending: 'В ожидании'
  },

  // Recruitment Status
  recruitmentStatus: {
    active: 'Активный',
    interviewScheduled: 'Собеседование запланировано',
    underReview: 'На рассмотрении',
    offerExtended: 'Предложение сделано',
    rejected: 'Отклонён',
    screening: 'Отбор',
    technical: 'Техническое',
    offer: 'Предложение'
  },

  // Performance Goals
  goals: {
    completeReactProject: 'Завершить React проект',
    improveCodeQuality: 'Улучшить качество кода',
    mentoringJuniorDevelopers: 'Наставничество младших разработчиков',
    apiDevelopment: 'Разработка API',
    databaseOptimization: 'Оптимизация базы данных',
    backendDevelopment: 'Backend разработка',
    teamCollaboration: 'Командная работа'
  },

  // Review Types
  reviewTypes: {
    quarterlyReview: 'Квартальная оценка',
    midYearReview: 'Полугодовая оценка',
    annualReview: 'Годовая оценка'
  },

  // Skill Categories
  skillCategories: {
    technical: 'Технические',
    soft: 'Мягкие навыки',
    leadership: 'Лидерство',
    communication: 'Коммуникация'
  }
};
