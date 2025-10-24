export default {
  // Navigation
  nav: {
    timeClock: 'Pointage',
    dashboard: 'Tableau de bord',
    employees: 'Employés',
    recruitment: 'Recrutement',
    timeTracking: 'Suivi du temps',
    performance: 'Évaluation des performances',
    reports: 'Rapports',
    continueWithGithub: 'Continuer avec GitHub',
    redirecting: 'Redirection vers GitHub...',
    githubError: 'Échec de la connexion avec GitHub',
    notifications: 'Notifications',
    settings: 'Paramètres',
  },
  
  // Header
  header: {
    title: 'Gestionnaire RH',
    welcome: 'Bon retour, équipe RH',
    user: 'Équipe RH'
  },

  // Dashboard
  dashboard: {
    title: 'Vue d’Ensemble du Tableau de Bord',
    totalEmployees: 'Nombre Total d’Employés',
    activeEmployees: 'Employés Actifs',
    newHires: 'Nouvelles Recrues Ce Mois-ci',
    pendingApplications: 'Candidatures en Attente',
    avgPerformance: 'Performance Moyenne',
    totalOvertime: 'Heures Supplémentaires Totales',
    totalLeave: 'Jours de Congé Totaux',
    employeePerformance: 'Performance des Employés',
    departmentDist: 'Répartition par Département',
    workLeaveComp: 'Comparaison Travail / Congés',
    topPerformers: 'Meilleurs Employés',
    overtime: 'Heures Supplémentaires',
    totalWorkDays: 'Jours de Travail Totaux',
    acrossEmployees: 'Tous les Employés du Mois',
    activeApplications: 'Candidatures Actives',
    pendingReview: 'En Attente de Révision',
    pendingRequests: 'Demandes en Attente',
    leaveRequests: 'Demandes de Congé en Attente',
    recentActivity: 'Activité Récente',
    quickStats: 'Statistiques Rapides',
    viewAll: 'Voir Tout',
    activities: {
      newEmployee: 'Nouvel employé embauché : ABC',
      interviewScheduled: 'Entretien prévu avec : XYZ',
      performanceReview: 'Évaluation terminée pour : Đỗ Bảo Long'
    },
    timeAgo: {
      twoHours: 'Il y a 2 heures',
      fourHours: 'Il y a 4 heures',
      oneDay: 'Il y a 1 jour'
    }
  },  

  // Search
  search: {
    placeholder: 'Rechercher des employés...'
  },

  // Departments
  departments: {
    all: 'Tous',
    engineering: 'Ingénierie',
    sales: 'Ventes',
    marketing: 'Marketing',
    humanresources: 'Ressources humaines',
    design: 'Design',
    finance: 'Finance'
  },

  // Months
  months: {
    january: 'Janvier',
    february: 'Février',
    march: 'Mars',
    april: 'Avril',
    may: 'Mai',
    june: 'Juin',
    july: 'Juillet',
    august: 'Août',
    september: 'Septembre',
    october: 'Octobre',
    november: 'Novembre',
    december: 'Décembre'
  },

  // Recruitment
  recruitment: {
    title: 'Pipeline de recrutement',
    postNewJob: 'Publier un nouvel emploi',
    applications: 'Candidatures',
    candidate: 'Candidat',
    position: 'Poste',
    department: 'Département',
    appliedDate: 'Date de candidature',
    experience: 'Expérience',
    status: 'Statut',
    actions: 'Actions',
    stage: 'Étape',
    interviewScheduled: 'Entretien programmé',
    underReview: 'En cours d\'examen',
    offerExtended: 'Offre proposée',
    screening: 'Sélection',
    technical: 'Technique',
    offer: 'Offre',
    years: 'ans'
  },

  timeClock: {
    title: 'Pointage',
    subtitle: 'Enregistrez vos heures de travail et soumettez une preuve',
    newEntry: 'Nouvelle saisie de temps',
    date: 'Date',
    clockIn: 'Heure d’entrée',
    clockOut: 'Heure de sortie',
    hourType: 'Type d’heure',
    proof: 'Preuve de présence',
    notes: 'Notes',
    optional: 'Optionnel',
    submit: 'Soumettre le temps',
    submitting: 'Soumission...',
    success: 'Heures enregistrées avec succès !',
    confirmDelete: 'Voulez-vous vraiment supprimer cet enregistrement ?',
    delete: 'Supprimer',
    history: 'Historique de pointage',
    noEntries: 'Aucun enregistrement pour le moment. Soumettez-en un premier !',
    time: 'Heure',
    hours: 'heures',
    type: 'Type',
    status: 'Statut',
    actions: 'Actions',
    weeklySummary: 'Cette semaine',
    monthlySummary: 'Ce mois-ci',
    total: 'Total',
    notesPlaceholder: 'Ajoutez des notes ou un contexte supplémentaire...',
    fileHelp: 'Téléversez une capture, une photo ou un PDF (max 5 Mo)',
    hourTypes: {
      regular: 'Heures normales',
      holiday: 'Jour férié',
      weekend: 'Week-end',
      bonus: 'Heures supplémentaires'
    },
    errors: {
      dateRequired: 'Veuillez sélectionner une date',
      clockInRequired: 'Veuillez saisir l’heure d’entrée',
      clockOutRequired: 'Veuillez saisir l’heure de sortie',
      clockOutAfterClockIn: 'L’heure de sortie doit être après l’entrée',
      tooManyHours: 'Impossible de dépasser 24 heures par enregistrement',
      overlapping: 'Cet horaire chevauche un autre enregistrement',
      fileTooLarge: 'Le fichier doit être inférieur à 5 Mo',
      invalidFileType: 'Seuls les fichiers JPG, PNG et PDF sont autorisés',
      submitFailed: 'Échec de la soumission. Veuillez réessayer.',
      deleteFailed: 'Échec de la suppression. Veuillez réessayer.'
    }
  },

  // Time Tracking
  timeTracking: {
    title: 'Tableau de bord de suivi du temps',
    summary: 'Résumé',
    quickActions: 'Actions rapides',
    workDays: 'Jours de travail',
    leaveDays: 'Jours de congé',
    overtime: 'Heures supplémentaires',
    holidayOvertime: 'Heures supplémentaires de vacances',
    hours: 'heures',
    days: 'jours',
    thisMonth: 'Ce mois-ci',
    totalHours: 'Heures totales',
    regularHours: 'Heures régulières',
    overtimeHours: 'Heures supplémentaires',
    hrs: 'h',
    attendanceRate: 'Taux de présence',
    leaveSuccess: 'Demande de congé soumise avec succès!',
    leaveError: 'Erreur lors de la soumission de la demande de congé',
    overtimeSuccess: 'Heures supplémentaires enregistrées avec succès!',
    overtimeError: 'Erreur lors de l\'enregistrement des heures supplémentaires',
    exportSuccess: 'Rapport exporté avec succès!'
  },

  // Employees
  employees: {
    title: 'Gestion des employés',
    searchPlaceholder: 'Rechercher des employés...',
    addEmployee: 'Ajouter un employé',
    name: 'Nom',
    position: 'Poste',
    department: 'Département',
    email: 'E-mail',
    phone: 'Téléphone',
    startDate: 'Date de début',
    salary: 'Salaire',
    status: 'Statut',
    location: 'Lieu',
    performance: 'Performance',
    actions: 'Actions',
    view: 'Voir',
    edit: 'Modifier',
    delete: 'Supprimer',
    active: 'Actif',
    inactive: 'Inactif',
    onLeave: 'En congé',
    namePlaceholder: 'Nom',
    emailPlaceholder: 'E-mail',
    phonePlaceholder: 'Numéro de téléphone',
    dobPlaceholder: 'Date de naissance',
    addressPlaceholder: 'Adresse',
  },

  // Search
  search: {
    placeholder: 'Rechercher des employés...'
  },

  // Departments
  departments: {
    all: 'Tous',
    engineering: 'Ingénierie',
    sales: 'Ventes',
    marketing: 'Marketing',
    humanresources: 'Ressources Humaines',
    design: 'Design',
    finance: 'Finance'
  },

  // Months
  months: {
    january: 'Janvier',
    february: 'Février',
    march: 'Mars',
    april: 'Avril',
    may: 'Mai',
    june: 'Juin',
    july: 'Juillet',
    august: 'Août',
    september: 'Septembre',
    october: 'Octobre',
    november: 'Novembre',
    december: 'Décembre'
  },

  // Recruitment
  recruitment: {
    title: 'Pipeline de recrutement',
    postNewJob: 'Publier un nouveau poste',
    applications: 'Candidatures',
    candidate: 'Candidat',
    position: 'Poste',
    department: 'Département',
    appliedDate: 'Date de candidature',
    experience: 'Expérience',
    status: 'Statut',
    actions: 'Actions',
    stage: 'Étape',
    interviewScheduled: 'Entretien programmé',
    underReview: 'En cours d\'examen',
    offerExtended: 'Offre étendue',
    screening: 'Sélection',
    technical: 'Technique',
    offer: 'Offre',
    years: 'années'
  },

  // Performance Appraisal
  performance: {
    title: 'Évaluation des performances',
    overallRating: 'Note globale',
    reviewPeriod: 'Période d\'examen',
    goals: 'Objectifs et buts',
    achievements: 'Réalisations clés',
    areasForImprovement: 'Domaines d\'amélioration',
    skillsAssessment: 'Évaluation des compétences',
    technical: 'Compétences techniques',
    communication: 'Communication',
    leadership: 'Leadership',
    teamwork: 'Travail d\'équipe',
    problemSolving: 'Résolution de problèmes',
    rating: 'Note',
    excellent: 'Excellent',
    good: 'Bon',
    average: 'Moyen',
    needsImprovement: 'À améliorer',
    comments: 'Commentaires',
    save: 'Sauvegarder l\'évaluation',
    lastReview: 'Dernier examen',
    nextReview: 'Prochain examen dû',
    q1_2024: 'T1 2024',
    q2_2024: 'T2 2024',
    q3_2024: 'T3 2024',
    q4_2024: 'T4 2024',
    overallPerformance: 'Performance globale',
    goalsCompleted: 'Objectifs atteints',
    reviewsThisPeriod: 'Évaluations cette période',
    avgSkillRating: 'Note moyenne des compétences',
    completed: 'Terminé',
    inProgress: 'En cours',
    pending: 'En attente',
    // Tabs
    overview: 'Aperçu',
    goalsTab: 'Objectifs',
    reviewsTab: 'Évaluations',
    // Goals section
    currentGoals: 'Objectifs actuels',
    addGoal: 'Ajouter un objectif',
    addNewGoal: 'Ajouter un nouvel objectif',
    performanceGoals: 'Objectifs de performance',
    progress: 'Progrès',
    deadline: 'Date limite',
    due: 'Échéance',
    complete: 'terminé',
    viewDetails: 'Voir les détails',
    // Reviews section
    performanceReviews: 'Évaluations de performance',
    newReview: 'Nouvelle évaluation',
    by: 'par',
    viewFullReview: 'Voir l\'évaluation complète',
    // General
    status: 'Statut',
    actions: 'Actions',
    edit: 'Modifier',
    view: 'Voir'
  },

  // Reports
  reports: {
    title: 'Rapports et analyses',
    employeeGrowth: 'Croissance des employés',
    departmentDistribution: 'Répartition par département',
    performanceMetrics: 'Métriques de performance',
    recruitmentMetrics: 'Métriques de recrutement',
    attendanceReport: 'Rapport de présence',
    salaryReport: 'Rapport de salaires',
    generateReport: 'Générer un rapport',
    exportPDF: 'Exporter en PDF',
    exportExcel: 'Exporter en Excel',
    filterBy: 'Filtrer par',
    dateRange: 'Plage de dates',
    department: 'Département',
    all: 'Tous',
    // Navigation
    overview: 'Aperçu',
    detailedReports: 'Rapports détaillés',
    filters: 'Filtres',
    exportAll: 'Exporter tout',
    // Charts
    departmentOverview: 'Aperçu des départements',
    attendanceOverview: 'Aperçu de la présence',
    recruitmentFunnel: 'Entonnoir de recrutement',
    performanceTrend: 'Tendance de performance',
    // Stats
    totalEmployees: 'Total des employés',
    newHires: 'Nouvelles embauches',
    thisQuarter: 'Ce trimestre',
    turnoverRate: 'Taux de rotation',
    annualRate: 'Taux annuel',
    avgSalary: 'Salaire moyen',
    satisfaction: 'Satisfaction',
    productivity: 'Productivité',
    // Attendance
    present: 'Présent',
    onLeave: 'En congé',
    absent: 'Absent',
    // Recruitment labels
    totalApplications: 'Total des candidatures',
    interviewed: 'Entretiens',
    hired: 'Embauchés',
    rejected: 'Rejetés',
    employees: 'employés',
    // Report generation
    generateCustomReport: 'Générer un rapport personnalisé',
    reportType: 'Type de rapport',
    employeePerformance: 'Performance des employés',
    salaryAnalysis: 'Analyse des salaires',
    attendanceReport: 'Rapport de présence',
    recruitmentMetrics: 'Métriques de recrutement',
    departmentComparison: 'Comparaison des départements',
    exportToPDF: 'Exporter en PDF',
    exportToExcel: 'Exporter en Excel',
    prebuiltReports: 'Rapports prédéfinis',
    // Pre-built report names
    monthlyPerformanceReview: 'Évaluation de performance mensuelle',
    comprehensivePerformanceAnalysis: 'Analyse complète des performances',
    salaryBenchmarking: 'Benchmark des salaires',
    compareSalariesAcrossDepartments: 'Comparer les salaires entre départements',
    attendanceAnalytics: 'Analyses de présence',
    trackAttendancePatterns: 'Suivre les modèles et tendances de présence',
    recruitmentPipeline: 'Pipeline de recrutement',
    monitorHiringProcess: 'Surveiller l\'efficacité du processus d\'embauche',
    employeeTurnover: 'Rotation des employés',
    analyzeRetentionRates: 'Analyser les taux de rétention et de rotation',
    trainingEffectiveness: 'Efficacité de la formation',
    measureTrainingSuccess: 'Mesurer le succès du programme de formation',
    generate: 'Générer →',
    fromLastPeriod: 'de la période précédente',
    lastWeek:	'La semaine dernière',
    lastMonth:	'Le mois dernier',
    lastQuarter:	'Le trimestre dernier',
    lastYear:	'Lannée dernière',
    customRange:	'Plage personnalisée',
  },

  // Common
  common: {
    search: 'Rechercher',
    filter: 'Filtrer',
    sort: 'Trier',
    save: 'Sauvegarder',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    view: 'Voir',
    add: 'Ajouter',
    close: 'Fermer',
    loading: 'Chargement...',
    noData: 'Aucune donnée disponible',
    error: 'Une erreur s\'est produite',
    success: 'Opération réussie',
    confirm: 'Êtes-vous sûr?',
    yes: 'Oui',
    no: 'Non'
  },

  // Theme
  theme: {
    light: 'Mode clair',
    dark: 'Mode sombre',
    toggle: 'Basculer le thème'
  },

  // Language
  language: {
    select: 'Sélectionner la langue',
    current: 'Langue actuelle'
  },

  // Time Tracking Actions
  timeTrackingActions: {
    recordTime: 'Enregistrer le temps',
    requestLeave: 'Demander un congé',
    logOvertime: 'Enregistrer les heures supplémentaires',
    exportReport: 'Exporter le rapport'
  },

  // Recruitment Actions
  recruitmentActions: {
    view: 'Voir',
    schedule: 'Planifier',
    reject: 'Rejeter'
  },

  // Employee Status
  employeeStatus: {
    active: 'Actif',
    inactive: 'Inactif',
    onLeave: 'En congé',
    pending: 'En attente'
  },

  // Recruitment Status
  recruitmentStatus: {
    active: 'Actif',
    interviewScheduled: 'Entretien programmé',
    underReview: 'En cours d\'examen',
    offerExtended: 'Offre étendue',
    rejected: 'Rejeté',
    screening: 'Présélection',
    technical: 'Technique',
    offer: 'Offre'
  },

  // Performance Goals
  goals: {
    completeReactProject: 'Terminer le projet React',
    improveCodeQuality: 'Améliorer la qualité du code',
    mentoringJuniorDevelopers: 'Encadrer les développeurs juniors',
    apiDevelopment: 'Développement d\'API',
    databaseOptimization: 'Optimisation de base de données',
    backendDevelopment: 'Développement backend',
    teamCollaboration: 'Collaboration d\'équipe'
  },

  // Review Types
  reviewTypes: {
    quarterlyReview: 'Évaluation trimestrielle',
    midYearReview: 'Évaluation de mi-année',
    annualReview: 'Évaluation annuelle'
  },

  // Skill Categories
  skillCategories: {
    technical: 'Technique',
    soft: 'Compétences relationnelles',
    leadership: 'Leadership',
    communication: 'Communication'
  },

  employeePosition: {
    general_manager: 'Directeur général',
    senior_developer: 'Développeur senior',
    hr_specialist: 'Spécialiste RH',
    accountant: 'Chef comptable',
    contract_manager: 'Responsable des marchés',
    managing_director: 'Directeur (d\'Institut)',
    support_staff: 'Personnel de soutien',
  }, 

  // Notifications
  notifications: {
    title: 'Notifications',
    employeeAdded: 'Employé Ajouté',
    addedTo: 'ajouté à',
    unreadCount: '{0} non lues',
    allCaughtUp: 'Vous êtes à jour !',
    filters: 'Filtres',
    markAllRead: 'Tout marquer comme lu',
    deleteAll: 'Tout supprimer',
    confirmDeleteAll: 'Êtes-vous sûr de vouloir supprimer toutes les notifications ?',
    total: 'Total',
    unread: 'Non lues',
    errors: 'Erreurs',
    warnings: 'Avertissements',
    filterBy: 'Filtrer par',
    status: 'Statut',
    type: 'Type',
    category: 'Catégorie',
    allNotifications: 'Toutes les Notifications',
    unreadOnly: 'Non lues uniquement',
    readOnly: 'Lues uniquement',
    allTypes: 'Tous les Types',
    info: 'Info',
    success: 'Succès',
    warning: 'Avertissement',
    error: 'Erreur',
    allCategories: 'Toutes les Catégories',
    general: 'Général',
    timeTracking: 'Suivi du Temps',
    performance: 'Performance',
    employee: 'Employé',
    recruitment: 'Recrutement',
    system: 'Système',
    noNotifications: 'Aucune notification',
    noNotificationsFilter: 'Aucune notification ne correspond à vos filtres',
    noNotificationsYet: 'Vous n\'avez pas encore de notifications',
    justNow: 'À l\'instant',
    minutesAgo: 'il y a {0}m',
    hoursAgo: 'il y a {0}h',
    daysAgo: 'il y a {0}j',
    markAsRead: 'Marquer comme lu',
    delete: 'Supprimer'
  },

  // Settings
  settings: {
    title: 'Paramètres',
    subtitle: 'Gérez vos préférences et paramètres de compte',
    saved: 'Enregistré!',
    export: 'Exporter',
    import: 'Importer',
    reset: 'Réinitialiser',
    saveChanges: 'Enregistrer les modifications',
    confirmReset: 'Êtes-vous sûr de vouloir réinitialiser tous les paramètres par défaut?',
    importSuccess: 'Paramètres importés avec succès!',
    importError: 'Échec de l\'importation des paramètres',
    
    notifications: 'Notifications',
    appearance: 'Apparence',
    language: 'Langue',
    privacy: 'Confidentialité',
    work: 'Préférences de travail',
    
    notificationPreferences: 'Préférences de notification',
    emailNotifications: 'Notifications par email',
    emailNotificationsDesc: 'Recevoir des notifications par email',
    pushNotifications: 'Notifications push',
    pushNotificationsDesc: 'Recevoir des notifications push dans l\'application',
    desktopNotifications: 'Notifications de bureau',
    desktopNotificationsDesc: 'Afficher les notifications du navigateur sur le bureau',
    notificationFrequency: 'Fréquence des notifications',
    realtime: 'Temps réel',
    daily: 'Résumé quotidien',
    weekly: 'Résumé hebdomadaire',
    notifyMeAbout: 'Me notifier à propos de',
    timeTrackingNotifications: 'Suivi du temps',
    performanceNotifications: 'Évaluations de performance',
    employeeNotifications: 'Mises à jour des employés',
    recruitmentNotifications: 'Recrutement',
    systemNotifications: 'Mises à jour du système',
    
    appearanceSettings: 'Paramètres d\'apparence',
    theme: 'Thème',
    dateFormat: 'Format de date',
    timeFormat: 'Format d\'heure',
    itemsPerPage: 'Éléments par page',
    
    languageRegion: 'Langue et région',
    timezone: 'Fuseau horaire',
    timezoneNote: 'Affichage actuellement des 50 premiers fuseaux horaires',
    
    privacySettings: 'Paramètres de confidentialité',
    profileVisibility: 'Visibilité du profil',
    visibilityAll: 'Tout le monde',
    visibilityTeam: 'Mon équipe',
    visibilityManagers: 'Responsables uniquement',
    visibilityPrivate: 'Privé',
    contactVisibility: 'Visibilité des informations de contact',
    showEmail: 'Afficher l\'adresse email',
    showPhone: 'Afficher le numéro de téléphone',
    
    workPreferences: 'Préférences de travail',
    defaultDashboard: 'Vue du tableau de bord par défaut',
    overviewView: 'Vue d\'ensemble',
    detailedView: 'Détaillé',
    compactView: 'Compact',
    autoClockOut: 'Déconnexion automatique',
    autoClockOutDesc: 'Se déconnecter automatiquement à une heure spécifique',
    autoClockOutTime: 'Heure de déconnexion automatique',
    weeklyReport: 'Rapport hebdomadaire',
    weeklyReportDesc: 'Recevoir un résumé hebdomadaire de vos activités professionnelles'
  }
};
