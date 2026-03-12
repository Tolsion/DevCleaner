import { useEffect } from 'react';
import { useScanStore } from '../../store/scanStore';
import LoadingOverlay from '../../components/LoadingOverlay';
import ScanningPanel from './ScanningPanel';
import ScanResultsPage from '../scan-results/ScanResultsPage';

const Dashboard = () => {
  const { isScanning, progress, roots, scanError, results } = useScanStore();

  return (
    <div className="flex min-h-full flex-col gap-6 px-8 pb-10 pt-6">
      {isScanning && results.items.length === 0 ? <LoadingOverlay label="Loading scan data" /> : null}
      {scanError ? (
        <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {scanError}
        </section>
      ) : null}
      {isScanning ? (
        <ScanningPanel roots={roots} progress={progress} />
      ) : (
        <>
          <ScanResultsPage />
        </>
      )}
    </div>
  );
};

export default Dashboard;
