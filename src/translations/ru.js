export default {
  // Navigation
  nav: {
    timeClock: 'Табель учёта рабочего времени',
    dashboard: 'Панель управления',
    employees: 'Сотрудники',
    recruitment: 'Найм персонала',
    timeTracking: 'Отслеживание времени',
    performance: 'Оценка эффективности',
    reports: 'Отчёты',
    notifications: 'Уведомления',
    settings: 'Настройки',
    workload: 'Рабочая нагрузка'
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
    continueWithGithub: 'Продолжить с GitHub',
    redirecting: 'Перенаправление на GitHub...',
    githubError: 'Не удалось войти через GitHub',
    noEntries: 'Нет записей. Добавьте первую!',
    time: 'Время',
    hours: 'Часы',
    type: 'Тип',
    status: 'Статус',
    actions: 'Действия',
    history: 'История учёта времени',
    delete: 'Удалить',
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
      invalidFileType: 'Разрешены только файлы JPG, PNG и PDF',
      submitFailed: 'Не удалось отправить запись времени. Пожалуйста, попробуйте ещё раз.',
      deleteFailed: 'Не удалось удалить запись времени. Пожалуйста, попробуйте ещё раз.'
    }
  },  

  // Time Tracking
  timeTracking: {
    title: 'Панель отслеживания времени',
    summary: 'Сводка',
    quickActions: 'Быстрые действия',
    workDays: 'Рабочие дни',
    leaveDays: 'Дни отпуска',
    leaveSuccess: 'Заявка на отпуск успешно отправлена!',
    leaveError: 'Ошибка при отправке заявки на отпуск',
    overtime: 'Сверхурочные часы',
    overtimeSuccess: 'Сверхурочные успешно зарегистрированы!',
    overtimeError: 'Ошибка при регистрации сверхурочных',
    holidayOvertime: 'Праздничные сверхурочные',
    exportSuccess: 'Отчет успешно экспортирован!',
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
    quickStats: 'Быстрая Статистика',
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
    inactive: 'Неактивный',
    namePlaceholder: 'Имя',
    emailPlaceholder: 'Эл. почта',
    phonePlaceholder: 'Телефон',
    dobPlaceholder: 'Дата рождения',
    addressPlaceholder: 'Адрес',
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
  },

  employeePosition: {
    general_manager: 'Генеральный директор',
    senior_developer: 'Старший разработчик',
    hr_specialist: 'Специалист по кадрам',
    accountant: 'Главный бухгалтер',
    contract_manager: 'Менеджер по контрактам',
    managing_director: 'Исполнительный директор',
    support_staff: 'Вспомогательный персонал',
  }, 

  // Notifications
  notifications: {
    title: 'Уведомления',
    employeeAdded: 'Добавлен сотрудник',
    addedTo: 'добавлен в',
    unreadCount: '{0} непрочитанных',
    allCaughtUp: 'Все прочитано!',
    filters: 'Фильтры',
    markAllRead: 'Отметить все как прочитанные',
    deleteAll: 'Удалить все',
    confirmDeleteAll: 'Вы уверены, что хотите удалить все уведомления?',
    total: 'Всего',
    unread: 'Непрочитанные',
    errors: 'Ошибки',
    warnings: 'Предупреждения',
    filterBy: 'Фильтровать по',
    status: 'Статус',
    type: 'Тип',
    category: 'Категория',
    allNotifications: 'Все уведомления',
    unreadOnly: 'Только непрочитанные',
    readOnly: 'Только прочитанные',
    allTypes: 'Все типы',
    info: 'Инфо',
    success: 'Успех',
    warning: 'Предупреждение',
    error: 'Ошибка',
    allCategories: 'Все категории',
    general: 'Общие',
    timeTracking: 'Учет времени',
    performance: 'Производительность',
    employee: 'Сотрудник',
    recruitment: 'Набор персонала',
    system: 'Система',
    noNotifications: 'Нет уведомлений',
    noNotificationsFilter: 'Нет уведомлений, соответствующих фильтрам',
    noNotificationsYet: 'У вас пока нет уведомлений',
    justNow: 'Только что',
    minutesAgo: '{0} мин. назад',
    hoursAgo: '{0} ч. назад',
    daysAgo: '{0} дн. назад',
    markAsRead: 'Отметить как прочитанное',
    delete: 'Удалить'
  },

  // Settings
  settings: {
    title: 'Настройки',
    subtitle: 'Управление предпочтениями и настройками аккаунта',
    saved: 'Сохранено!',
    export: 'Экспорт',
    import: 'Импорт',
    reset: 'Сброс',
    saveChanges: 'Сохранить изменения',
    confirmReset: 'Вы уверены, что хотите сбросить все настройки на значения по умолчанию?',
    importSuccess: 'Настройки успешно импортированы!',
    importError: 'Не удалось импортировать настройки',
    
    notifications: 'Уведомления',
    appearance: 'Внешний вид',
    language: 'Язык',
    privacy: 'Конфиденциальность',
    work: 'Рабочие предпочтения',
    
    notificationPreferences: 'Настройки уведомлений',
    emailNotifications: 'Email уведомления',
    emailNotificationsDesc: 'Получать уведомления по электронной почте',
    pushNotifications: 'Push уведомления',
    pushNotificationsDesc: 'Получать push-уведомления в приложении',
    desktopNotifications: 'Уведомления на рабочем столе',
    desktopNotificationsDesc: 'Показывать уведомления браузера на рабочем столе',
    notificationFrequency: 'Частота уведомлений',
    realtime: 'В реальном времени',
    daily: 'Ежедневная сводка',
    weekly: 'Еженедельная сводка',
    notifyMeAbout: 'Уведомлять меня о',
    timeTrackingNotifications: 'Отслеживание времени',
    performanceNotifications: 'Оценка эффективности',
    employeeNotifications: 'Обновления сотрудников',
    recruitmentNotifications: 'Найм персонала',
    systemNotifications: 'Системные обновления',
    
    appearanceSettings: 'Настройки внешнего вида',
    theme: 'Тема',
    dateFormat: 'Формат даты',
    timeFormat: 'Формат времени',
    itemsPerPage: 'Элементов на странице',
    
    languageRegion: 'Язык и регион',
    timezone: 'Часовой пояс',
    timezoneNote: 'Отображаются первые 50 часовых поясов',
    
    privacySettings: 'Настройки конфиденциальности',
    profileVisibility: 'Видимость профиля',
    visibilityAll: 'Все',
    visibilityTeam: 'Моя команда',
    visibilityManagers: 'Только менеджеры',
    visibilityPrivate: 'Приватно',
    contactVisibility: 'Видимость контактной информации',
    showEmail: 'Показать адрес электронной почты',
    showPhone: 'Показать номер телефона',
    
    workPreferences: 'Рабочие предпочтения',
    defaultDashboard: 'Панель управления по умолчанию',
    overviewView: 'Обзор',
    detailedView: 'Подробно',
    compactView: 'Компактно',
    autoClockOut: 'Автовыход',
    autoClockOutDesc: 'Автоматически отмечаться на выходе в определенное время',
    autoClockOutTime: 'Время автовыхода',
    weeklyReport: 'Еженедельный отчет',
    weeklyReportDesc: 'Получать еженедельную сводку рабочих активностей'
  },

  // Workload Management
  workload: {
    title: 'Управление рабочей нагрузкой',
    individual: 'Индивидуальный',
    organization: 'Организация',
    totalTasks: 'Всего задач',
    completed: 'Завершено',
    progress: 'Прогресс',
    avgQuality: 'Сред. качество',
    avgProgress: 'Сред. прогресс',
    myTasks: 'Мои задачи',
    addTask: 'Добавить задачу',
    editTask: 'Редактировать задачу',
    taskTitle: 'Название задачи',
    description: 'Описание',
    priority: 'Приоритет',
    status: 'Статус',
    selfAssessment: 'Самооценка',
    selfAssessmentPlaceholder: 'Как вы выполнили эту задачу?',
    qualityRating: 'Оценка качества',
    noTasks: 'Задач пока нет. Добавьте свою первую задачу!',
    employeeProgress: 'Прогресс сотрудников',
    confirmDelete: 'Вы уверены, что хотите удалить эту задачу?'
  },

  // Performance Appraisal Translation
  performanceAppraisalPage: {
    title: 'Оценка Эффективности',
    overallPerformance: 'Общая Эффективность',
    goalsAchieved: 'Достигнутые Цели',
    reviewsThisPeriod: 'Отзывы За Этот Период',
    avgSkillRating: 'Средняя Оценка Навыков',
    currentGoals: 'Текущие Цели',
    addGoal: 'Добавить Цель',
    // Tabs
    overview: 'Обзор',
    goals: 'Цели',
    reviews: 'Отзывы',
  },

  // Employee Details Tabs
  employeeDetailTabs: {
    basicInformation: 'Основная Информация',
    contact: 'Контакт',
    documents: 'Документы',
  },

  // Employee Edit Form
  employeeEditForm: {
    editEmployee: 'Редактировать Сотрудника',
    contactInformation: 'Контактная Информация',
    employmentDetails: 'Подробности Занятости',
    email: 'Электронная Почта',
    phone: 'Телефон',
    telephone: 'Номер Телефона',
    address: 'Адрес',
    department: 'Отдел',
    abteilung: 'Отдел',
    startDate: 'Дата Начала',
    startdatum: 'Дата Начала',
    dateOfBirth: 'Дата Рождения',
    performance: 'Эффективность',
    leistung: 'Эффективность',
    cancel: 'Отмена',
    abbrechen: 'Отмена',
    save: 'Сохранить',
    speichern: 'Сохранить',
  },

  // Department Names
  departments: {
    engineering: 'Инженерия',
    technology: 'Технологии',
    hr: 'Кадры',
    finance: 'Финансы',
    marketing: 'Маркетинг',
    sales: 'Продажи',
    operations: 'Операции',
    support: 'Поддержка',
  },
};
