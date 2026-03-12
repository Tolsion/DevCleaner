const summaryStats = [
  {
    label: 'Detected Projects',
    value: '3',
    note: 'React, PHP, and C codebases'
  },
  {
    label: 'Unused Files',
    value: '14',
    note: 'Safe to archive or delete'
  },
  {
    label: 'Potential Savings',
    value: '2.4 GB',
    note: 'Build artifacts + cache'
  }
];

const scannedProjects = [
  {
    id: 'proj-react',
    name: 'Nimbus Client',
    root: '~/Projects/nimbus-client',
    stack: ['React', 'Vite', 'TypeScript'],
    lastBuild: '2 days ago',
    unusedFiles: [
      'src/legacy/LegacyToolbar.tsx',
      'public/unused-hero.svg',
      'src/styles/old-theme.css'
    ]
  },
  {
    id: 'proj-php',
    name: 'Atlas Admin',
    root: '~/Projects/atlas-admin',
    stack: ['PHP', 'Laravel', 'MySQL'],
    lastBuild: '8 days ago',
    unusedFiles: [
      'resources/views/backup/dashboard.blade.php',
      'storage/logs/archive-2024.log',
      'public/assets/unused-banner.png'
    ]
  },
  {
    id: 'proj-c',
    name: 'Core Tools',
    root: '~/Projects/core-tools',
    stack: ['C', 'Make', 'glibc'],
    lastBuild: '3 weeks ago',
    unusedFiles: [
      'build/legacy_tool.o',
      'bin/unused_cli',
      'tests/fixtures/old_dump.bin'
    ]
  }
];

const ScanOverview = () => {
  return (
    <section className="grid gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.4em] text-muted">Scanned System</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold">Detected Projects & Unused Files</h2>
          <span className="text-xs text-muted">Dummy data · will connect to real scan later</span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-800 bg-surface/70 p-5"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-muted">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
            <p className="mt-2 text-sm text-muted">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {scannedProjects.map((project) => (
          <article
            key={project.id}
            className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-6"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Project</p>
              <h3 className="mt-2 text-xl font-semibold">{project.name}</h3>
              <p className="mt-1 text-sm text-muted">{project.root}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {project.stack.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Unused Files</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-200">
                {project.unusedFiles.map((file) => (
                  <li key={file} className="font-mono text-slate-200">
                    {file}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto flex items-center justify-between text-xs text-muted">
              <span>Last build: {project.lastBuild}</span>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                Review suggested
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ScanOverview;
