import { QueryProvider } from '@/app/providers/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { AdminLightMode } from '@/components/admin/AdminLightMode';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans" data-theme="light">
      <AdminLightMode />
      <QueryProvider>
        {children}
        <Toaster />
      </QueryProvider>
    </div>
  );
}
