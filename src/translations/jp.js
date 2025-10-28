export default {
  // Navigation
  nav: {
    timeClock: 'タイムクロック',
    dashboard: 'ダッシュボード',
    employees: '従業員',
    recruitment: '採用',
    timeTracking: '勤怠管理',
    performance: '業績評価',
    reports: 'レポート',
    notifications: '通知',
    settings: '設定',
    workload: '作業量',
    controlPanel: 'コントロールパネル',
  }
  ,

  // Header
  header: {
    title: 'HRマネージャー',
    welcome: 'おかえりなさい、HRチーム',
    user: 'HRチーム'
  },

  // Dashboard
  dashboard: {
    title: 'ダッシュボード概要',
    overview: '組織の概要',
    totalEmployees: '従業員総数',
    activeEmployees: '在籍従業員',
    newHires: '今月の新入社員',
    pendingApplications: '保留中の応募',
    avgPerformance: '平均パフォーマンス',
    totalOvertime: '総残業時間',
    totalLeave: '総休暇日数',
    employeePerformance: '従業員のパフォーマンス',
    departmentDist: '部署別構成',
    workLeaveComp: '勤務日と休暇日の比較',
    topPerformers: '優秀な従業員',
    overtime: '残業時間',
    totalWorkDays: '総勤務日数',
    acrossEmployees: '今月の全従業員',
    activeApplications: '進行中の応募',
    pendingReview: 'レビュー待ち',
    pendingRequests: '保留中のリクエスト',
    leaveRequests: '休暇申請（承認待ち）',
    recentActivity: '最近の活動',
    viewAll: 'すべて表示',
    activities: {
      newEmployee: '新入社員が入社しました：ABC',
      interviewScheduled: 'XYZとの面接を予定しています',
      performanceReview: 'Đỗ Bảo Longの業績評価が完了しました'
    },
    timeAgo: {
      twoHours: '2時間前',
      fourHours: '4時間前',
      oneDay: '1日前'
    }
  },

  // Search
  search: {
    placeholder: '従業員を検索...'
  },

  // Departments
  departments: {
    all: 'すべて',
    engineering: 'エンジニアリング',
    sales: '営業',
    marketing: 'マーケティング',
    humanresources: '人事',
    design: 'デザイン',
    finance: '財務'
  },

  // Months
  months: {
    january: '1月',
    february: '2月',
    march: '3月',
    april: '4月',
    may: '5月',
    june: '6月',
    july: '7月',
    august: '8月',
    september: '9月',
    october: '10月',
    november: '11月',
    december: '12月'
  },

  // Recruitment
  recruitment: {
    title: '採用パイプライン',
    postNewJob: '新しい仕事を投稿',
    applications: '応募',
    candidate: '候補者',
    position: 'ポジション',
    department: '部署',
    appliedDate: '応募日',
    experience: '経験',
    status: 'ステータス',
    actions: 'アクション',
    stage: 'ステージ',
    interviewScheduled: '面接予定',
    underReview: '審査中',
    offerExtended: 'オファー提示',
    screening: 'スクリーニング',
    technical: '技術',
    offer: 'オファー',
    years: '年'
  },

  timeClock: {
    title: '勤怠記録',
    subtitle: '勤務時間を記録し、証明書を提出します',
    newEntry: '新しい勤怠入力',
    date: '日付',
    clockIn: '出勤時間',
    clockOut: '退勤時間',
    hourType: '勤務時間の種類',
    proof: '勤怠証明',
    notes: 'メモ',
    optional: '任意',
    submit: '勤怠を送信',
    submitting: '送信中...',
    success: '勤怠記録が正常に送信されました！',
    confirmDelete: 'この記録を削除してもよろしいですか？',
    delete: '削除',
    history: '勤怠履歴',
    noEntries: '記録がありません。最初の記録を送信してください！',
    time: '時間',
    hours: '時間数',
    type: '種類',
    status: 'ステータス',
    actions: '操作',
    weeklySummary: '今週',
    monthlySummary: '今月',
    total: '合計',
    notesPlaceholder: 'メモや追加情報を入力...',
    fileHelp: 'スクリーンショット、写真、またはPDFをアップロード（最大5MB）',
    hourTypes: {
      regular: '通常勤務',
      holiday: '祝日勤務',
      weekend: '週末勤務',
      bonus: '特別勤務'
    },
    errors: {
      dateRequired: '日付を選択してください',
      clockInRequired: '出勤時間を入力してください',
      clockOutRequired: '退勤時間を入力してください',
      clockOutAfterClockIn: '退勤時間は出勤時間の後でなければなりません',
      tooManyHours: '1件の記録で24時間を超えることはできません',
      overlapping: 'この時間帯は同日の他の記録と重複しています',
      fileTooLarge: 'ファイルサイズは5MB未満である必要があります',
      invalidFileType: 'JPG、PNG、PDFファイルのみアップロード可能です',
      submitFailed: '時間記録の送信に失敗しました。もう一度お試しください。',
      deleteFailed: '時間記録の削除に失敗しました。もう一度お試しください。'
    }
  },
  
  // Time Tracking
  timeTracking: {
    title: '時間追跡ダッシュボード',
    summary: '概要',
    quickActions: 'クイックアクション',
    workDays: '勤務日',
    leaveDays: '休暇日',
    overtime: '残業時間',
    holidayOvertime: '休日残業',
    hours: '時間',
    days: '日',
    thisMonth: '今月',
    totalHours: '総時間',
    regularHours: '通常時間',
    overtimeHours: '残業時間',
    hrs: '時間',
    attendanceRate: '出勤率'
  },

  // Employees
  employees: {
    title: '従業員管理',
    directory: 'ディレクトリ',
    addNew: '新規追加',
    searchPlaceholder: '従業員を検索...',
    quickStats: 'クイック統計',
    addEmployee: '従業員を追加',
    name: '名前',
    position: '役職',
    department: '部署',
    email: 'メール',
    phone: '電話',
    startDate: '開始日',
    salary: '給与',
    status: 'ステータス',
    location: '勤務地',
    performance: 'パフォーマンス',
    actions: 'アクション',
    view: '表示',
    edit: '編集',
    delete: '削除',
    active: 'アクティブ',
    inactive: '非アクティブ',
    namePlaceholder: '氏名',
    emailPlaceholder: 'Eメール',
    phonePlaceholder: '電話番号',
    dobPlaceholder: '生年月日',
    addressPlaceholder: '住所',
  },

  // Recruitment
  recruitment: {
    title: '採用パイプライン',
    applications: '応募',
    candidate: '候補者',
    appliedDate: '応募日',
    experience: '経験',
    stage: 'ステージ',
    interviewScheduled: '面接予定',
    underReview: '審査中',
    offerExtended: 'オファー提示',
    screening: 'スクリーニング',
    technical: '技術面接',
    offer: 'オファー',
    years: '年'
  },

  // Performance Appraisal
  performance: {
    title: 'パフォーマンス評価',
    overallRating: '総合評価',
    reviewPeriod: '評価期間',
    goals: '目標・目的',
    achievements: '主な成果',
    areasForImprovement: '改善領域',
    skillsAssessment: 'スキル評価',
    technical: '技術スキル',
    communication: 'コミュニケーション',
    leadership: 'リーダーシップ',
    teamwork: 'チームワーク',
    problemSolving: '問題解決',
    rating: '評価',
    excellent: '優秀',
    good: '良好',
    average: '平均',
    needsImprovement: '要改善',
    comments: 'コメント',
    save: '評価を保存',
    lastReview: '前回のレビュー',
    nextReview: '次回レビュー予定',
    q1_2024: '2024年Q1',
    q2_2024: '2024年Q2',
    q3_2024: '2024年Q3',
    q4_2024: '2024年Q4',
    overallPerformance: '総合パフォーマンス',
    goalsCompleted: '達成目標',
    reviewsThisPeriod: '今期のレビュー',
    avgSkillRating: '平均スキル評価',
    completed: '完了',
    inProgress: '進行中',
    pending: '保留中',
    // Tabs
    overview: '概要',
    goalsTab: '目標',
    reviewsTab: 'レビュー',
    // Goals section
    currentGoals: '現在の目標',
    addGoal: '目標追加',
    addNewGoal: '新しい目標を追加',
    performanceGoals: 'パフォーマンス目標',
    progress: '進捗',
    deadline: '期限',
    due: '期日',
    complete: '完了',
    viewDetails: '詳細を見る',
    // Reviews section
    performanceReviews: 'パフォーマンスレビュー',
    newReview: '新しいレビュー',
    by: 'による',
    viewFullReview: '完全なレビューを見る',
    // General
    status: 'ステータス',
    actions: 'アクション',
    edit: '編集',
    view: '表示'
  },

  // Reports
  reports: {
    title: 'レポート・分析',
    employeeGrowth: '従業員成長',
    departmentDistribution: '部署別分布',
    performanceMetrics: 'パフォーマンス指標',
    recruitmentMetrics: '採用指標',
    attendanceReport: '出勤レポート',
    salaryReport: '給与レポート',
    generateReport: 'レポート生成',
    exportPDF: 'PDF出力',
    exportExcel: 'Excel出力',
    filterBy: 'フィルター',
    dateRange: '期間',
    department: '部署',
    all: 'すべて',
    // Navigation
    overview: '概要',
    detailedReports: '詳細レポート',
    filters: 'フィルター',
    exportAll: 'すべて出力',
    // Charts
    departmentOverview: '部署概要',
    attendanceOverview: '出勤概要',
    recruitmentFunnel: '採用ファネル',
    performanceTrend: 'パフォーマンス傾向',
    // Stats
    totalEmployees: '総従業員数',
    newHires: '新規採用',
    thisQuarter: '今四半期',
    turnoverRate: '離職率',
    annualRate: '年率',
    avgSalary: '平均給与',
    satisfaction: '満足度',
    productivity: '生産性',
    // Attendance
    present: '出勤',
    onLeave: '休暇中',
    absent: '欠勤',
    // Recruitment labels
    totalApplications: '総応募数',
    interviewed: '面接済み',
    hired: '採用',
    rejected: '不採用',
    employees: '従業員',
    // Report generation
    generateCustomReport: 'カスタムレポート生成',
    reportType: 'レポートタイプ',
    employeePerformance: '従業員パフォーマンス',
    salaryAnalysis: '給与分析',
    attendanceReport: '出勤レポート',
    recruitmentMetrics: '採用指標',
    departmentComparison: '部署比較',
    exportToPDF: 'PDFに出力',
    exportToExcel: 'Excelに出力',
    prebuiltReports: '事前構築レポート',
    // Pre-built report names
    monthlyPerformanceReview: '月次パフォーマンスレビュー',
    comprehensivePerformanceAnalysis: '包括的パフォーマンス分析',
    salaryBenchmarking: '給与ベンチマーキング',
    compareSalariesAcrossDepartments: '部署間の給与比較',
    attendanceAnalytics: '出勤分析',
    trackAttendancePatterns: '出勤パターンと傾向の追跡',
    recruitmentPipeline: '採用パイプライン',
    monitorHiringProcess: '採用プロセスの効率性監視',
    employeeTurnover: '従業員離職',
    analyzeRetentionRates: '定着率と離職率の分析',
    trainingEffectiveness: '研修効果',
    measureTrainingSuccess: '研修プログラムの成功測定',
    generate: '生成 →',
    fromLastPeriod: '前期から',
    lastWeek:	'先週 (Senshū)',
    lastMonth:	'先月 (Sengetsu)',
    lastQuarter:	'前四半期 (Zen shihanki)',
    lastYear:	'昨年 (Sakunen)',
    customRange:	'カスタム範囲',
  },

  // Common
  common: {
    search: '検索',
    filter: 'フィルター',
    sort: 'ソート',
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    edit: '編集',
    view: '表示',
    add: '追加',
    close: '閉じる',
    loading: '読み込み中...',
    continueWithGithub: 'GitHubで続ける',
    redirecting: 'GitHubにリダイレクト中...',
    githubError: 'GitHubログインに失敗しました',
    success: '操作が成功しました',
    confirm: '本当によろしいですか？',
    yes: 'はい',
    no: 'いいえ'
  },

  // Theme
  theme: {
    light: 'ライトモード',
    dark: 'ダークモード',
    toggle: 'テーマ切り替え'
  },

  // Language
  language: {
    select: '言語選択',
    current: '現在の言語'
  },

  // Time Tracking Actions
  timeTrackingActions: {
    recordTime: '時間記録',
    leaveSuccess: '休暇申請が正常に送信されました！',
    leaveError: '休暇申請の送信中にエラーが発生しました',
    overtimeSuccess: '残業が正常に記録されました！',
    overtimeError: '残業の記録中にエラーが発生しました',
    exportSuccess: 'レポートが正常にエクスポートされました！',
    requestLeave: '休暇申請',
    logOvertime: '残業記録',
    exportReport: 'レポート出力',
    includesPending: '*保留中を含む',
    totalRegularHours: '通常勤務時間合計（全従業員）',
    regularHoursChart: '従業員別通常勤務時間',
    overtimeHoursChart: '従業員別残業時間',
    overviewTitle: '会社概要',
    regularHoursLegend: '通常勤務時間',
    totalOvertimeLegend: '残業時間合計',
    employee: '従業員',
    daysWorked: '出勤日数',
    totalHoursLabel: '総勤務時間'
  },

  // Admin Time Entry
  adminTimeEntry: {
    title: '管理者勤怠入力',
    description: '従業員の勤怠を入力（管理者/マネージャーのみ）',
    selectEmployee: '従業員を選択',
    searchEmployees: '従業員を検索...',
    noEmployees: '従業員が見つかりません',
    date: '日付',
    clockIn: '出勤',
    clockOut: '退勤',
    hourType: '時間タイプ',
    regularHours: '通常勤務',
    weekendOvertime: '週末/残業',
    holiday: '祝日',
    bonusHours: 'ボーナス時間',
    notes: 'メモ',
    notesPlaceholder: 'この勤怠入力についてのメモを追加...',
    submitButton: '勤怠入力を送信',
    submitting: '送信中...',
    accessDenied: 'アクセス拒否：他の従業員の勤怠入力を管理する権限がありません。',
    errorLoadEmployees: '従業員の読み込みに失敗しました',
    success: '勤怠入力が正常に追加されました',
    error: '勤怠入力の作成に失敗しました'
  },

  // Time Clock Entry
  timeClock: {
    title: '新しい勤怠入力',
    selectDate: '日付を選択',
    clockIn: '出勤',
    clockOut: '退勤',
    hourType: '時間タイプ',
    proof: '作業証明',
    optional: 'オプション',
    notes: 'メモ',
    notesPlaceholder: '作業についてのメモを追加...',
    submit: '勤怠入力を送信',
    submitting: '送信中...',
    success: '勤怠入力が正常に送信されました！',
    confirmDelete: 'この勤怠入力を削除してもよろしいですか？',
    deleteSuccess: '勤怠入力が正常に削除されました',
    requestLeave: '休暇申請',
    weeklySummary: '今週',
    monthlySummary: '今月',
    leaveDays: '休暇日数',
    thisWeek: '今週',
    thisMonth: '今月',
    total: '合計',
    includesPending: '* 保留中と承認済みを含む',
    hourTypes: {
      regular: '通常勤務',
      holiday: '祝日',
      weekend: '週末/残業',
      bonus: 'ボーナス時間'
    },
    errors: {
      dateRequired: '日付は必須です',
      clockInRequired: '出勤時間は必須です',
      clockOutRequired: '退勤時間は必須です',
      clockOutAfterClockIn: '退勤時間は出勤時間より後でなければなりません',
      submitFailed: '勤怠入力の送信に失敗しました',
      deleteFailed: '勤怠入力の削除に失敗しました'
    }
  },

  // Recruitment Actions
  recruitmentActions: {
    view: '表示',
    schedule: 'スケジュール',
    reject: '拒否'
  },

  // Employee Status
  employeeStatus: {
    active: 'アクティブ',
    inactive: '非アクティブ',
    onLeave: '休暇中',
    pending: '保留中'
  },

  // Recruitment Status
  recruitmentStatus: {
    active: 'アクティブ',
    interviewScheduled: '面接予定',
    underReview: '審査中',
    offerExtended: 'オファー提示',
    rejected: '拒否',
    screening: 'スクリーニング',
    technical: '技術面接',
    offer: 'オファー'
  },

  // Performance Goals
  goals: {
    completeReactProject: 'Reactプロジェクト完了',
    improveCodeQuality: 'コード品質向上',
    mentoringJuniorDevelopers: 'ジュニア開発者指導',
    apiDevelopment: 'API開発',
    databaseOptimization: 'データベース最適化',
    backendDevelopment: 'バックエンド開発',
    teamCollaboration: 'チーム協力'
  },

  // Review Types
  reviewTypes: {
    quarterlyReview: '四半期評価',
    midYearReview: '中間評価',
    annualReview: '年次評価'
  },

  // Skill Categories
  skillCategories: {
    technical: '技術的',
    soft: 'ソフトスキル',
    leadership: 'リーダーシップ',
    communication: 'コミュニケーション'
  },

  employeePosition: {
    general_manager: 'ゼネラルマネージャー',
    senior_developer: 'シニア開発者',
    hr_specialist: '人事スペシャリスト',
    accountant: '主任会計士',
    contract_manager: '契約管理者',
    managing_director: '所長 / 院長',
    support_staff: 'サポートスタッフ',
  }, 

  // Notifications
  notifications: {
    title: '通知',
    employeeAdded: '従業員が追加されました',
    addedTo: 'に追加されました',
    unreadCount: '{0}件の未読',
    allCaughtUp: 'すべて確認済みです！',
    filters: 'フィルター',
    markAllRead: 'すべて既読にする',
    deleteAll: 'すべて削除',
    confirmDeleteAll: 'すべての通知を削除してもよろしいですか？',
    total: '合計',
    unread: '未読',
    errors: 'エラー',
    warnings: '警告',
    filterBy: 'フィルター条件',
    status: 'ステータス',
    type: 'タイプ',
    category: 'カテゴリ',
    allNotifications: 'すべての通知',
    unreadOnly: '未読のみ',
    readOnly: '既読のみ',
    allTypes: 'すべてのタイプ',
    info: '情報',
    success: '成功',
    warning: '警告',
    error: 'エラー',
    allCategories: 'すべてのカテゴリ',
    general: '一般',
    timeTracking: '勤怠管理',
    performance: 'パフォーマンス',
    employee: '従業員',
    recruitment: '採用',
    system: 'システム',
    noNotifications: '通知なし',
    noNotificationsFilter: 'フィルター条件に一致する通知がありません',
    noNotificationsYet: 'まだ通知がありません',
    justNow: 'たった今',
    minutesAgo: '{0}分前',
    hoursAgo: '{0}時間前',
    daysAgo: '{0}日前',
    markAsRead: '既読にする',
    delete: '削除'
  },

  // Settings
  settings: {
    title: '設定',
    subtitle: '環境設定とアカウント設定を管理',
    saved: '保存しました！',
    export: 'エクスポート',
    import: 'インポート',
    reset: 'リセット',
    saveChanges: '変更を保存',
    confirmReset: 'すべての設定をデフォルトにリセットしてもよろしいですか？',
    importSuccess: '設定を正常にインポートしました！',
    importError: '設定のインポートに失敗しました',
    
    notifications: '通知',
    appearance: '外観',
    language: '言語',
    privacy: 'プライバシー',
    work: '作業設定',
    
    notificationPreferences: '通知設定',
    emailNotifications: 'メール通知',
    emailNotificationsDesc: 'メールで通知を受け取る',
    pushNotifications: 'プッシュ通知',
    pushNotificationsDesc: 'アプリ内でプッシュ通知を受け取る',
    desktopNotifications: 'デスクトップ通知',
    desktopNotificationsDesc: 'デスクトップにブラウザ通知を表示',
    notificationFrequency: '通知頻度',
    realtime: 'リアルタイム',
    daily: '日次まとめ',
    weekly: '週次まとめ',
    notifyMeAbout: '次の項目について通知',
    timeTrackingNotifications: '勤怠管理',
    performanceNotifications: '業績評価',
    employeeNotifications: '従業員の更新',
    recruitmentNotifications: '採用',
    systemNotifications: 'システム更新',
    
    appearanceSettings: '外観設定',
    theme: 'テーマ',
    dateFormat: '日付形式',
    timeFormat: '時刻形式',
    itemsPerPage: 'ページあたりのアイテム数',
    
    languageRegion: '言語と地域',
    timezone: 'タイムゾーン',
    timezoneNote: '現在、最初の50のタイムゾーンを表示しています',
    
    privacySettings: 'プライバシー設定',
    profileVisibility: 'プロフィールの公開範囲',
    visibilityAll: 'すべてのユーザー',
    visibilityTeam: '自分のチーム',
    visibilityManagers: 'マネージャーのみ',
    visibilityPrivate: '非公開',
    contactVisibility: '連絡先情報の公開範囲',
    showEmail: 'メールアドレスを表示',
    showPhone: '電話番号を表示',
    
    workPreferences: '作業設定',
    defaultDashboard: 'デフォルトのダッシュボード表示',
    overviewView: '概要',
    detailedView: '詳細',
    compactView: 'コンパクト',
    autoClockOut: '自動退勤',
    autoClockOutDesc: '指定した時間に自動的に退勤する',
    autoClockOutTime: '自動退勤時間',
    weeklyReport: '週次レポート',
    weeklyReportDesc: '作業活動の週次まとめを受け取る'
  },

  // Workload Management
  workload: {
    title: '仕事量管理',
    individual: '個人',
    organization: '組織',
    totalTasks: '総タスク数',
    completed: '完了',
    progress: '進捗',
    avgQuality: '平均品質',
    avgProgress: '平均進捗',
    myTasks: 'マイタスク',
    addTask: 'タスクを追加',
    editTask: 'タスクを編集',
    taskTitle: 'タスクタイトル',
    description: '説明',
    priority: '優先度',
    status: 'ステータス',
    selfAssessment: '自己評価',
    selfAssessmentPlaceholder: 'このタスクをどのように実行しましたか？',
    qualityRating: '品質評価',
    noTasks: 'タスクがありません。最初のタスクを追加しましょう！',
    employeeProgress: '従業員の進捗',
    confirmDelete: 'このタスクを削除してもよろしいですか？'
  },

  // Performance Appraisal Translation
  performanceAppraisalPage: {
    title: '業績評価',
    overallPerformance: '総合パフォーマンス',
    goalsAchieved: '達成目標',
    reviewsThisPeriod: '今期のレビュー',
    avgSkillRating: '平均スキル評価',
    currentGoals: '現在の目標',
    addGoal: '目標を追加',
    // Tabs
    overview: '概要',
    goals: '目標',
    reviews: 'レビュー',
  },

  // Employee Details Tabs
  employeeDetailTabs: {
    basicInformation: '基本情報',
    contact: '連絡先',
    documents: '書類',
  },

  // Employee Edit Form
  employeeEditForm: {
    editEmployee: '従業員編集',
    contactInformation: '連絡先情報',
    employmentDetails: '雇用詳細',
    email: 'メール',
    phone: '電話',
    telephone: '電話番号',
    address: '住所',
    department: '部門',
    abteilung: '部門',
    startDate: '開始日',
    startdatum: '開始日',
    dateOfBirth: '生年月日',
    performance: 'パフォーマンス',
    leistung: 'パフォーマンス',
    cancel: 'キャンセル',
    abbrechen: 'キャンセル',
    save: '保存',
    speichern: '保存',
  },

  // Department Names
  departments: {
    engineering: 'エンジニアリング',
    technology: 'テクノロジー',
    hr: '人事',
    finance: '財務',
    marketing: 'マーケティング',
    sales: '営業',
    operations: '運営',
    support: 'サポート',
  },
};
