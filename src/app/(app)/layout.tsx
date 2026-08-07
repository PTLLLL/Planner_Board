import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
