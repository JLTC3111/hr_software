module.exports = {
  appId: 'vn.icue.hr',
  productName: 'ICUE HR Manager',
  artifactName: 'ICUE-HR-Manager-${version}-${os}-${arch}.${ext}',
  // All renderer dependencies are bundled by Vite. A separate app manifest
  // prevents shipping the web app's unused Node dependency tree or secrets.
  directories: { app: 'desktop/app', output: 'artifacts/desktop' },
  files: ['package.json', 'desktop/{main,policy,smoke}.cjs', 'dist/**/*', '!**/*.map', '!**/node_modules{,/**/*}'],
  afterPack: './desktop/check-package.cjs',
  asar: true,
  npmRebuild: false,
  publish: null,
  mac: {
    category: 'public.app-category.business',
    icon: 'public/logoIcons/favicon-512x512.png',
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }, { target: 'zip', arch: ['arm64', 'x64'] }],
    hardenedRuntime: true,
  },
  win: {
    icon: 'public/logoIcons/favicon-512x512.png',
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
  },
};
